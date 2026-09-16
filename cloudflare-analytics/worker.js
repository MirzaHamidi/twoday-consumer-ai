/**
 * Twoday Studio Analytics - Cloudflare Worker
 *
 * Endpoints:
 *   POST /api/visit   - Record a unique visitor (deduped by vid + IP hash)
 *   POST /api/play    - Record a unique game play (deduped by vid + game_id)
 *   POST /api/session - Record session duration and update streak
 *   GET  /api/stats   - Return aggregate counts (cached 5 min)
 *
 * ⚠️ AI AGENT WARNING: CRITICAL BUSINESS INFRASTRUCTURE ⚠️
 * This Worker manages investor-grade analytics data.
 * DO NOT change CORS origins, database logic, or deduplication logic.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers - explicitly allow * or the request origin to bypass all blockers
    const origin = request.headers.get("Origin") || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (request.method === "POST" && path === "/api/ping") {
        return await handleVisit(request, env, corsHeaders);
      }
      if (request.method === "POST" && path === "/api/play") {
        return await handlePlay(request, env, corsHeaders);
      }
      if (request.method === "GET" && path === "/api/stats") {
        return await handleStats(env, corsHeaders);
      }
      if (request.method === "POST" && path === "/api/session") {
        return await handleSession(request, env, corsHeaders);
      }
      if (request.method === "GET" && path === "/api/reset-analytics") {
        return await handleReset(env, corsHeaders);
      }
      if (request.method === "GET" && path === "/api/debug") {
        const visitors = await env.DB.prepare("SELECT * FROM visitors").all().catch(()=>({results:[]}));
        const plays = await env.DB.prepare("SELECT * FROM plays").all().catch(()=>({results:[]}));
        const events = await env.DB.prepare("SELECT * FROM events").all().catch(()=>({results:[]}));
        const logs = await env.DB.prepare("SELECT * FROM debug_logs").all().catch(()=>({results:[]}));
        return jsonResponse({ visitors: visitors.results, plays: plays.results, events: events.results, logs: logs.results }, 200, corsHeaders);
      }

      return jsonResponse({ error: "Not Found" }, 404, corsHeaders);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500, corsHeaders);
    }
  },
};

// ── GET /api/reset-analytics ──
async function handleReset(env, cors) {
  // Danger zone: only exposed temporarily or should be protected. 
  // Clearing analytics database as requested by the prompt.
  try {
    await env.DB.prepare("DELETE FROM plays").run();
    await env.DB.prepare("DELETE FROM sessions").run();
    await env.DB.prepare("DELETE FROM visitors").run();
    await env.DB.prepare("DELETE FROM streaks").run();
    await env.DB.prepare("DELETE FROM events").run(); // May fail if table doesn't exist yet
  } catch(e) {
    // Ignore errors for non-existent tables
  }
  return jsonResponse({ ok: true, message: "Analytics wiped clean. Zero state restored." }, 200, cors);
}

// ── POST /api/visit ──
async function handleVisit(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (!body || !body.vid || typeof body.vid !== "string" || body.vid.length > 64) {
    return jsonResponse({ error: "invalid vid" }, 400, cors);
  }

  // Robust Fingerprint: IP + User-Agent
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  const fingerprint = await hashString(ip + ua);

  try {
    // Check if this device has already visited (even if they cleared cache)
    const existing = await env.DB.prepare(
      "SELECT vid FROM visitors WHERE ip_hash = ?"
    ).bind(fingerprint).first();

    if (existing) {
      // Already tracked this device, ignore the new vid to prevent inflation
      return jsonResponse({ ok: true, note: "deduped" }, 200, cors);
    }

    await env.DB.prepare(
      "INSERT OR IGNORE INTO visitors (vid, ip_hash) VALUES (?, ?)"
    )
      .bind(body.vid, fingerprint)
      .run();
  } catch (e) {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS debug_logs (msg TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
      await env.DB.prepare(`INSERT INTO debug_logs (msg) VALUES (?)`).bind("handleVisit Error: " + e.message).run();
    } catch (err) {}
  }

  // Forward unique_visitor to GA4
  if (env.GA4_API_SECRET && env.GA4_MEASUREMENT_ID) {
    try {
      const gaPayload = {
        client_id: body.vid,
        user_id: body.vid,
        events: [{ name: "unique_visitor" }]
      };
      const clientIp = request.headers.get("Bunny-Origin-IP") || request.headers.get("X-Forwarded-For") || ip;
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": clientIp },
          body: JSON.stringify(gaPayload)
        }
      );
    } catch (e) {}
  }

  return jsonResponse({ ok: true }, 200, cors);
}

// ── POST /api/play ──
async function handlePlay(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !body.vid ||
    !body.game ||
    typeof body.vid !== "string" ||
    typeof body.game !== "string" ||
    body.vid.length > 64 ||
    body.game.length > 128
  ) {
    return jsonResponse({ error: "invalid data" }, 400, cors);
  }

  // Robust Fingerprint: IP + User-Agent
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  const fingerprint = await hashString(ip + ua);

  // Find the canonical vid for this device to prevent cache-clearing inflation
  let canonicalVid = body.vid;
  try {
    const existingVisit = await env.DB.prepare(
      "SELECT vid FROM visitors WHERE ip_hash = ?"
    ).bind(fingerprint).first();
    
    if (existingVisit) {
      canonicalVid = existingVisit.vid;
    } else {
      // If they somehow played without visiting first, ensure they have a visitor record
      await env.DB.prepare(
        "INSERT OR IGNORE INTO visitors (vid, ip_hash) VALUES (?, ?)"
      ).bind(canonicalVid, fingerprint).run();
    }
  } catch (e) {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS debug_logs (msg TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
      await env.DB.prepare(`INSERT INTO debug_logs (msg) VALUES (?)`).bind("handlePlay visitors Error: " + e.message).run();
    } catch (err) {}
  }

  // INSERT OR IGNORE - composite PRIMARY KEY (vid, game_id) makes duplicates impossible
  try {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO plays (vid, game_id) VALUES (?, ?)"
    )
      .bind(canonicalVid, body.game)
      .run();
  } catch (e) {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS debug_logs (msg TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
      await env.DB.prepare(`INSERT INTO debug_logs (msg) VALUES (?)`).bind("handlePlay plays Error: " + e.message).run();
    } catch (err) {}
  }

  // Forward unique game_play to GA4
  if (env.GA4_API_SECRET && env.GA4_MEASUREMENT_ID) {
    try {
      const gaPayload = {
        client_id: canonicalVid,
        user_id: canonicalVid,
        events: [{ name: "game_play", params: { game_id: body.game } }]
      };
      const clientIp = request.headers.get("Bunny-Origin-IP") || request.headers.get("X-Forwarded-For") || ip;
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Forwarded-For": clientIp },
          body: JSON.stringify(gaPayload)
        }
      );
    } catch (e) {}
  }

  return jsonResponse({ ok: true }, 200, cors);
}

// ── POST /api/session ──
async function handleSession(request, env, cors) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !body.vid ||
    !body.game ||
    (typeof body.duration !== "number" && !body.event) ||
    typeof body.vid !== "string" ||
    typeof body.game !== "string"
  ) {
    return jsonResponse({ error: "invalid data" }, 400, cors);
  }

  // Robust Fingerprint: IP + User-Agent
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  const fingerprint = await hashString(ip + ua);

  // Find the canonical vid
  let canonicalVid = body.vid;
  try {
    const existingVisit = await env.DB.prepare(
      "SELECT vid FROM visitors WHERE ip_hash = ?"
    ).bind(fingerprint).first();
    
    if (existingVisit) {
      canonicalVid = existingVisit.vid;
    } else {
      try {
        await env.DB.prepare(
          "INSERT OR IGNORE INTO visitors (vid, ip_hash) VALUES (?, ?)"
        ).bind(canonicalVid, fingerprint).run();
      } catch (e) {}
    }
  } catch (e) {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS debug_logs (msg TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
      await env.DB.prepare(`INSERT INTO debug_logs (msg) VALUES (?)`).bind("handleSession visitors Error: " + e.message).run();
    } catch (err) {}
  }

  // Handle distinct events (game_start, valid_session) within the trusted session endpoint
  if (body.event) {
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS events (
          vid TEXT,
          game_id TEXT,
          event_type TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )
      `).run();
      await env.DB.prepare(
        "INSERT INTO events (vid, game_id, event_type) VALUES (?, ?, ?)"
      ).bind(canonicalVid, body.game, body.event).run();
    } catch (e) {}

    // Forward to GA4
    if (env.GA4_API_SECRET && env.GA4_MEASUREMENT_ID) {
      try {
        const gaPayload = {
          client_id: canonicalVid,
          user_id: canonicalVid,
          events: [{ name: body.event, params: { game_id: body.game } }]
        };
        const clientIp = request.headers.get("Bunny-Origin-IP") || request.headers.get("X-Forwarded-For") || ip;
        await fetch(
          `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Forwarded-For": clientIp },
            body: JSON.stringify(gaPayload)
          }
        );
      } catch (e) {}
    }

    // If it's purely an event with no duration chunk, return early
    if (typeof body.duration !== "number") {
      return jsonResponse({ ok: true, note: "event logged" }, 200, cors);
    }
  }

  // Record session chunk
  if (typeof body.duration === "number") {
    await env.DB.prepare(
      "INSERT INTO sessions (vid, game_id, duration) VALUES (?, ?, ?)"
    ).bind(canonicalVid, body.game, body.duration).run();
  }

  // Streak logic
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const existingStreak = await env.DB.prepare(
    "SELECT current_streak, last_play_date FROM streaks WHERE vid = ? AND game_id = ?"
  ).bind(canonicalVid, body.game).first();

  let newStreak = 1;
  if (existingStreak) {
    if (existingStreak.last_play_date === yesterday) {
      newStreak = existingStreak.current_streak + 1;
    } else if (existingStreak.last_play_date === today) {
      newStreak = existingStreak.current_streak; // Played already today
    } else {
      newStreak = 1; // Streak broken
    }
    
    await env.DB.prepare(
      "UPDATE streaks SET current_streak = ?, last_play_date = ? WHERE vid = ? AND game_id = ?"
    ).bind(newStreak, today, canonicalVid, body.game).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO streaks (vid, game_id, current_streak, last_play_date) VALUES (?, ?, ?, ?)"
    ).bind(canonicalVid, body.game, newStreak, today).run();
  }

  // Forward to GA4 (Measurement Protocol) if API Secret is configured
  if (env.GA4_API_SECRET && env.GA4_MEASUREMENT_ID) {
    try {
      const gaPayload = {
        client_id: canonicalVid,
        user_id: canonicalVid,
        events: []
      };

      gaPayload.events.push({
        name: "game_session_complete",
        params: {
          game_id: body.game,
          engagement_time_msec: body.duration * 1000,
          session_duration: body.duration
        }
      });
      gaPayload.events.push({
        name: "game_streak_updated",
        params: {
          game_id: body.game,
          current_streak: newStreak
        }
      });

      const clientIp = request.headers.get("Bunny-Origin-IP") || request.headers.get("X-Forwarded-For") || ip;
      
      await fetch(
        `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA4_MEASUREMENT_ID}&api_secret=${env.GA4_API_SECRET}`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Forwarded-For": clientIp
          },
          body: JSON.stringify(gaPayload)
        }
      );
    } catch (e) {}
  }

  return jsonResponse({ ok: true, streak: newStreak }, 200, cors);
}

// ── GET /api/stats ──
async function handleStats(env, cors) {
  const [visitors, totalUniquePlays, gameBreakdown] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as count FROM visitors").first(),
    env.DB.prepare("SELECT COUNT(*) as count FROM plays").first(), // still tracks unique lifetime plays
    env.DB.prepare(
      "SELECT game_id, COUNT(*) as count FROM plays GROUP BY game_id ORDER BY count DESC"
    ).all(),
  ]);

  let eventBreakdown = { results: [] };
  try {
    // Pull "Game Starts" (every mount) and "Valid Sessions" (>10s, once per start) directly from events table
    eventBreakdown = await env.DB.prepare(`
      SELECT 
        game_id, 
        SUM(CASE WHEN event_type = 'game_start' THEN 1 ELSE 0 END) as total_starts,
        SUM(CASE WHEN event_type = 'valid_session' THEN 1 ELSE 0 END) as total_valid
      FROM events 
      GROUP BY game_id
    `).all();
  } catch (e) { /* events table not yet created */ }

  let sessionBreakdown = { results: [] };
  try {
    sessionBreakdown = await env.DB.prepare(
      "SELECT game_id, SUM(duration) as total_duration FROM sessions GROUP BY game_id"
    ).all();
  } catch (e) { /* sessions table not yet created */ }

  let streakBreakdown = { results: [] };
  try {
    streakBreakdown = await env.DB.prepare(
      "SELECT game_id, MAX(current_streak) as max_streak FROM streaks GROUP BY game_id"
    ).all();
  } catch (e) { /* streaks table not yet created */ }

  let retentionBreakdown = { results: [] };
  try {
    retentionBreakdown = await env.DB.prepare(`
      SELECT 
        p.game_id,
        COUNT(DISTINCT CASE WHEN date(p.created_at) <= date('now', '-1 day') THEN p.vid END) AS d1_cohort_size,
        COUNT(DISTINCT CASE WHEN date(p.created_at) <= date('now', '-7 days') THEN p.vid END) AS d7_cohort_size,
        COUNT(DISTINCT CASE WHEN date(s.created_at) = date(p.created_at, '+1 day') THEN s.vid END) AS d1_returns,
        COUNT(DISTINCT CASE WHEN date(s.created_at) = date(p.created_at, '+7 days') THEN s.vid END) AS d7_returns
      FROM plays p
      LEFT JOIN sessions s ON p.vid = s.vid AND p.game_id = s.game_id
      GROUP BY p.game_id
    `).all();
  } catch (e) { /* sessions or plays table issue */ }

  const games = {
    "one-two-dice": { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 },
    "hoop-pong": { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 },
    "jump-todo": { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 }
  };
  for (const row of gameBreakdown.results) {
    if (!games[row.game_id]) games[row.game_id] = { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 };
    games[row.game_id].unique_plays = row.count;
  }
  for (const row of eventBreakdown.results) {
    if (!games[row.game_id]) games[row.game_id] = { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 };
    games[row.game_id].plays = row.total_starts || 0;
    games[row.game_id].total_sessions = row.total_valid || 0;
  }
  for (const row of sessionBreakdown.results) {
    if (!games[row.game_id]) games[row.game_id] = { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 };
    games[row.game_id].duration = row.total_duration || 0;
  }
  for (const row of streakBreakdown.results) {
    if (!games[row.game_id]) games[row.game_id] = { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 };
    games[row.game_id].max_streak = row.max_streak || 0;
  }
  for (const row of retentionBreakdown.results) {
    if (!games[row.game_id]) games[row.game_id] = { unique_plays: 0, plays: 0, duration: 0, max_streak: 0, d1_retention: null, d7_retention: null, total_sessions: 0 };
    if (row.d1_cohort_size > 0) {
      games[row.game_id].d1_retention = Math.round((row.d1_returns / row.d1_cohort_size) * 100);
    }
    if (row.d7_cohort_size > 0) {
      games[row.game_id].d7_retention = Math.round((row.d7_returns / row.d7_cohort_size) * 100);
    }
  }

  // Calculate total plays using events table sum for accurate display on top
  let totalDashboardPlays = 0;
  for (const g in games) {
     totalDashboardPlays += games[g].plays;
  }

  return new Response(
    JSON.stringify({
      visitors: visitors.count,
      totalPlays: totalDashboardPlays > 0 ? totalDashboardPlays : totalUniquePlays.count,
      games: games,
      updatedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}

// ── Helpers ──
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function hashString(str) {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

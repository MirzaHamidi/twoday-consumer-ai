/**
 * ⚠️ AI AGENT WARNING: CRITICAL BUSINESS INFRASTRUCTURE ⚠️
 * This file is the core tracking engine for Twoday Studio's analytics.
 * This data is used for investor pitches and business metrics.
 * 
 * RULES FOR AI AGENTS:
 * 1. DO NOT modify the tracking keys (tds_vid, tds_visited, tds_plays).
 * 2. DO NOT change the navigator.sendBeacon logic.
 * 3. DO NOT remove the localStorage deduplication guards.
 * 4. If asked to add new tracking events, follow the exact same deduplication
 *    pattern using try/catch blocks and localStorage to prevent spam.
 * 
 * Any bugs introduced here will permanently corrupt business data.
 *
 * SESSION TRACKING ARCHITECTURE (v2):
 * - Uses visibilitychange as the PRIMARY flush trigger (works on mobile + desktop)
 * - Uses a periodic 2-minute checkpoint flush as FALLBACK for long sessions
 * - Uses beforeunload as a LAST RESORT for desktop
 * - Sends a partial flush when a checkpoint is hit, then resets the accumulator
 *   so time is never double-counted even if multiple flushes fire
 */

(function () {
  "use strict";

  var TDS_API = "https://tds-analytics.twodaystudio.workers.dev";

  var VID_KEY   = "tds_vid";
  var VISIT_KEY = "tds_visited";
  var PLAYS_KEY = "tds_plays";

  // ── Persistent visitor ID ──
  var vid;
  try {
    vid = localStorage.getItem(VID_KEY);
    if (!vid) {
      vid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : "uid-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      localStorage.setItem(VID_KEY, vid);
    }
  } catch (e) {
    vid = "anon-" + Math.random().toString(36).slice(2);
  }

  // ── GA4 Persistent User ID ──
  // Removed direct gtag config to bypass adblockers - Worker handles GA4

  // ── Unique Site Visit (fires ONCE per browser, ever) ──
  try {
    if (!localStorage.getItem(VISIT_KEY)) {
      localStorage.setItem(VISIT_KEY, "1");
      if (TDS_API) {
        console.log("[Analytics] Event Fired: unique_visitor");
        navigator.sendBeacon(TDS_API + "/api/ping", JSON.stringify({ vid: vid }));
      }
    }
  } catch (e) {}

  // ── Game Play Tracker (called from script.js) ──
  window.__tds_trackPlay = function (gameId) {
    if (!gameId) return;
    var plays;
    try { plays = JSON.parse(localStorage.getItem(PLAYS_KEY) || "{}"); }
    catch (e) { plays = {}; }

    if (plays[gameId]) return; // Already tracked

    plays[gameId] = Date.now();
    try { localStorage.setItem(PLAYS_KEY, JSON.stringify(plays)); } catch (e) {}

    if (TDS_API) {
      console.log("[Analytics] Event Fired: game_play (" + gameId + ")");
      navigator.sendBeacon(TDS_API + "/api/play", JSON.stringify({ vid: vid, game: gameId }));
    }
  };

  // ── Session Duration & Retention Tracking (v2 - Mobile-Safe) ──
  var currentSessionGame  = null;
  var sessionStartTime    = 0;      // when visible play began
  var totalActiveTime     = 0;      // accumulated ms for this flush cycle
  var absoluteTotalTime   = 0;      // accumulated ms across all flushes for current game
  var isValidSessionFired = false;  // flag to ensure valid_session fires once
  var isSessionActive     = false;
  var checkpointInterval  = null;
  var CHECKPOINT_MS       = 120000; // flush every 2 minutes as a safety net

  /**
   * Sends whatever time has been accumulated to the server and resets
   * the accumulator. Does NOT clear currentSessionGame so the timer
   * keeps running for the next checkpoint.
   * @param {boolean} ending - if true, fully ends the session
   */
  function sendSession(ending) {
    if (!currentSessionGame || !TDS_API) return;

    // Capture any time since the last resume
    if (isSessionActive && sessionStartTime > 0) {
      var elapsed = Date.now() - sessionStartTime;
      totalActiveTime += elapsed;
      absoluteTotalTime += elapsed;
      if (!ending) {
        sessionStartTime = Date.now(); // reset start for next interval
      }
    }

    if (!isValidSessionFired && absoluteTotalTime >= 10000) {
      isValidSessionFired = true;
      console.log("[Analytics] Event Fired: valid_session (" + currentSessionGame + ")");
      navigator.sendBeacon(TDS_API + "/api/session", JSON.stringify({ vid: vid, game: currentSessionGame, event: "valid_session" }));
    }

    var durationSeconds = Math.floor(totalActiveTime / 1000);
    if (durationSeconds > 5) {
      console.log("[Analytics] Event Fired: session_chunk (" + durationSeconds + "s)");
      var payload = JSON.stringify({
        vid:      vid,
        game:     currentSessionGame,
        duration: durationSeconds
      });
      navigator.sendBeacon(TDS_API + "/api/session", payload);
    }

    // Reset accumulator so the next flush doesn't double-count
    totalActiveTime = 0;

    if (ending) {
      currentSessionGame  = null;
      isSessionActive     = false;
      sessionStartTime    = 0;
      if (checkpointInterval) {
        clearInterval(checkpointInterval);
        checkpointInterval = null;
      }
    }
  }

  /** Public: called by script.js when the user launches a game */
  window.__tds_startSession = function (gameId) {
    if (!gameId) return;

    // Session-based deduplication for game_start to prevent spam but track every intended mount
    var sessionStarts;
    try { sessionStarts = JSON.parse(sessionStorage.getItem("tds_starts") || "{}"); }
    catch (e) { sessionStarts = {}; }

    // Always re-trigger if the game changes in the player, but prevent rapid-fire on same game
    if (currentSessionGame !== gameId) {
       sessionStarts[gameId] = (sessionStarts[gameId] || 0) + 1;
       try { sessionStorage.setItem("tds_starts", JSON.stringify(sessionStarts)); } catch(e) {}
       
       if (TDS_API) {
         console.log("[Analytics] Event Fired: game_start (" + gameId + ")");
         navigator.sendBeacon(TDS_API + "/api/session", JSON.stringify({ vid: vid, game: gameId, event: "game_start" }));
       }
    }

    // Already tracking this exact game - do nothing
    if (currentSessionGame === gameId) return;

    // Flush any previous game session before starting a new one
    if (currentSessionGame) {
      sendSession(true);
    }

    currentSessionGame = gameId;
    totalActiveTime    = 0;
    absoluteTotalTime  = 0;
    isValidSessionFired= false;
    isSessionActive    = document.visibilityState === "visible";
    sessionStartTime   = isSessionActive ? Date.now() : 0;

    // Start the 2-minute checkpoint interval
    if (checkpointInterval) clearInterval(checkpointInterval);
    checkpointInterval = setInterval(function () {
      if (currentSessionGame && isSessionActive) {
        sendSession(false); // partial flush, keep tracking
      }
    }, CHECKPOINT_MS);
  };

  /** Public: called by script.js when the user closes the game panel */
  window.__tds_endSession = function () {
    sendSession(true);
  };

  // ── Visibility change: the PRIMARY mobile-safe trigger ──
  // When the user switches tabs, minimizes, or gets a phone call,
  // this fires immediately. On mobile, this is the ONLY reliable signal.
  document.addEventListener("visibilitychange", function () {
    if (!currentSessionGame) return;

    if (document.visibilityState === "visible") {
      // Resumed - start counting again
      isSessionActive  = true;
      sessionStartTime = Date.now();
    } else {
      // Hidden - flush what we have and pause the timer
      sendSession(false); // partial flush, keep session alive
      isSessionActive  = false;
      sessionStartTime = 0;
    }
  });

  // ── beforeunload: last-resort for desktop ──
  window.addEventListener("beforeunload", function () {
    sendSession(true);
  });

  // ── pagehide: iOS Safari alternative to beforeunload ──
  window.addEventListener("pagehide", function () {
    sendSession(true);
  });

})();

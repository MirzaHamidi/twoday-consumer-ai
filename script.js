// Force HTTPS in production (Godot 4 and Service Workers require a Secure Context)
if (window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
  window.location.href = window.location.href.replace("http:", "https:");
}

const header = document.querySelector("[data-header]");
const nav = document.querySelector("#primary-navigation");
const navToggle = document.querySelector(".nav-toggle");
const yearTargets = document.querySelectorAll("[data-year]");
const mailForms = document.querySelectorAll("[data-mail-form]");
const placeholderLinks = document.querySelectorAll("[data-placeholder-link]");

// Keep the header readable once the hero image moves behind it.
const updateHeader = () => {
  const isScrolled = window.scrollY > 12;
  header?.classList.toggle("is-scrolled", isScrolled);
};

const closeNav = () => {
  document.body.classList.remove("nav-open");
  header?.classList.remove("nav-active");
  nav?.classList.remove("is-open");
  navToggle?.setAttribute("aria-expanded", "false");
};

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  document.body.classList.toggle("nav-open", !isOpen);
  header?.classList.toggle("nav-active", !isOpen);
  nav?.classList.toggle("is-open", !isOpen);
  navToggle.setAttribute("aria-expanded", String(!isOpen));
});

// ==========================================================================
// Sliding Nav Indicator (iOS 26 style)
// ==========================================================================
const initNavIndicator = () => {
  const siteNavs = document.querySelectorAll(".site-nav");

  siteNavs.forEach(navEl => {
    const indicator = navEl.querySelector(".nav-indicator");
    if (!indicator) return;

    const links = navEl.querySelectorAll("a");
    let hideTimer = null;

    const moveIndicator = (target) => {
      clearTimeout(hideTimer);
      const navRect = navEl.getBoundingClientRect();
      const linkRect = target.getBoundingClientRect();
      indicator.style.left   = (linkRect.left - navRect.left) + "px";
      indicator.style.width  = linkRect.width + "px";
      indicator.style.top    = (linkRect.top - navRect.top) + "px";
      indicator.style.height = linkRect.height + "px";
      indicator.style.opacity = "1";
    };

    const hideIndicator = () => {
      hideTimer = setTimeout(() => {
        indicator.style.opacity = "0";
      }, 150);
    };

    links.forEach(link => {
      link.addEventListener("mouseenter", () => moveIndicator(link));
      link.addEventListener("focus",      () => moveIndicator(link));
    });

    navEl.addEventListener("mouseleave", hideIndicator);
    navEl.addEventListener("focusout", (e) => {
      if (!navEl.contains(e.relatedTarget)) hideIndicator();
    });
  });
};

initNavIndicator();

nav?.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    closeNav();
  }
});

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

yearTargets.forEach((target) => {
  target.textContent = String(new Date().getFullYear());
});

placeholderLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
  });
});

const createTicketId = () => {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TS-${stamp}-${suffix}`;
};

const buildMailto = ({ subject, lines }) => {
  const body = lines.filter(Boolean).join("\n");
  return `mailto:contact@twodaystudio.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

mailForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const status = form.querySelector("[data-form-status]");
    const type = form.dataset.formType;
    let mailto = "";

    if (type === "support") {
      const ticketPayload = {
        email: formData.get("email"),
        game: formData.get("game"),
        issue: formData.get("issue"),
        device: formData.get("device"),
        message: formData.get("message"),
        website: formData.get("website"),
        notBot: formData.get("notBot") === "on",
      };
      try {
        let ticketResponse;
        for (const endpoint of ["https://ai.twodaystudio.com/api/tickets", "https://mc-wvgsibkmje.bunny.run/api/tickets"]) {
          try {
            ticketResponse = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ticketPayload) });
            if (ticketResponse.ok) break;
          } catch (error) { console.debug("Ticket endpoint unavailable.", error); }
        }
        const ticket = await ticketResponse?.json();
        if (!ticketResponse?.ok) throw new Error(ticket?.error || "Ticket request failed");
        if (status) status.textContent = `Ticket ${ticket.ticketId} received. We will review it shortly.`;
        form.reset();
        return;
      } catch (error) {
        console.warn("Ticket API unavailable; opening email fallback.", error);
      }
    }

    if (type === "support") {
      const ticketId = createTicketId();
      const game = formData.get("game");
      const issue = formData.get("issue");

      mailto = buildMailto({
        subject: `[${ticketId}] ${game} - ${issue}`,
        lines: [
          `Ticket ID: ${ticketId}`,
          `Game: ${game}`,
          `Issue Type: ${issue}`,
          `Email: ${formData.get("email")}`,
          `Device / Platform: ${formData.get("device") || "Not provided"}`,
          "",
          "Details:",
          formData.get("message"),
        ],
      });

      if (status) {
        status.textContent = `Ticket ${ticketId} created. Your email app should open now.`;
      }
    } else {
      const reason = formData.get("reason");
      const company = formData.get("company") || "Not provided";

      try {
        let contactResponse;
        for (const endpoint of ["https://ai.twodaystudio.com/api/contact", "https://mc-wvgsibkmje.bunny.run/api/contact"]) {
          try {
            contactResponse = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), email: formData.get("email"), company, reason, message: formData.get("message"), website: formData.get("website"), notBot: formData.get("notBot") === "on" }) });
            if (contactResponse.ok) break;
          } catch (error) { console.debug("Contact endpoint unavailable.", error); }
        }
        if (!contactResponse?.ok) throw new Error("Contact delivery is not configured");
        if (status) status.textContent = "Your message was sent to TwoDay Studio.";
        form.reset();
        return;
      } catch (error) {
        console.warn("Contact API unavailable; opening email fallback.", error);
      }

      mailto = buildMailto({
        subject: `Business Inquiry - ${reason}`,
        lines: [
          `Name: ${formData.get("name")}`,
          `Email: ${formData.get("email")}`,
          `Company: ${company}`,
          `Reason: ${reason}`,
          "",
          "Message:",
          formData.get("message"),
        ],
      });

      if (status) {
        status.textContent = "Your email app should open with the inquiry already filled in.";
      }
    }

    window.location.href = mailto;
  });
});

// ==========================================================================
// Game Player Controller
// ==========================================================================
const initGamePlayer = () => {
  const player = document.querySelector("[data-game-player]");
  if (!player) return;

  const iframe = player.querySelector("[data-game-iframe]");
  const placeholder = player.querySelector("[data-game-placeholder]");
  const titleElem = player.querySelector("[data-current-game-title]");
  const genreElem = player.querySelector("[data-current-game-genre]");
  const iconElem = player.querySelector("[data-current-game-icon]");
  const newTabBtn = player.querySelector("[data-game-newtab]");
  const fullscreenBtn = player.querySelector("[data-game-fullscreen]");
  const reloadBtn = player.querySelector("[data-game-reload]");
  const viewport = player.querySelector("[data-game-viewport]");
  const aspectBtns = player.querySelectorAll("[data-aspect]");
  const playButtons = document.querySelectorAll("[data-load-game]");
  const playableCards = document.querySelectorAll("[data-game-card]");

  const setAspect = (ratio) => {
    if (!viewport) return;
    viewport.classList.remove("aspect-16-9", "aspect-4-3", "aspect-9-16");
    viewport.classList.add(`aspect-${ratio}`);
    aspectBtns.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.aspect === ratio);
    });
  };

  // Ensure default viewport matches mobile focus immediately on load
  if (window.innerWidth <= 768) {
    setAspect("9-16");
  }

  const loadGame = ({ src, title, genre, icon, aspect = "16-9", scrollTo = false }) => {
    if (!src || !iframe) return;

    // Force mobile orientation automatically on phones
    if (window.innerWidth <= 768) {
      aspect = "9-16";
    }

    // Update iframe source
    iframe.src = src;
    iframe.title = title || "Game";

    // Hide placeholder
    if (placeholder) {
      placeholder.classList.add("is-hidden");
    }

    // Update metadata in player bar
    if (titleElem && title) titleElem.textContent = title;
    if (genreElem && genre) genreElem.textContent = genre;
    if (iconElem && icon) {
      iconElem.src = icon;
      iconElem.alt = `${title} icon`;
    }

    // Update New Tab link
    if (newTabBtn) {
      newTabBtn.href = src;
      newTabBtn.removeAttribute("disabled");
      newTabBtn.style.pointerEvents = "auto";
      newTabBtn.style.opacity = "1";
    }

    // Update aspect ratio if specified
    if (aspect) {
      setAspect(aspect);
    }

    // Update active card highlighting
    playableCards.forEach((card) => {
      const match = card.dataset.gameSrc === src;
      card.classList.toggle("is-active", match);
    });

    // Scroll to player view if requested
    if (scrollTo) {
      player.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ── Analytics: track unique game play ──
    // ⚠️ AI AGENT WARNING: CRITICAL BUSINESS METRICS ⚠️
    // DO NOT remove or break this block. This is the only place where
    // game plays are tracked. If this is broken, investor data will be lost.
    // It relies on the `window.__tds_trackPlay` function defined in `tds-analytics.js`.
    const matchingCard = Array.from(playableCards).find((c) => c.dataset.gameSrc === src);
    const gameId = (matchingCard && matchingCard.dataset.gameId) || title.toLowerCase().replace(/\s+/g, "-");
    
    if (typeof window.__tds_trackPlay === "function") {
      window.__tds_trackPlay(gameId);
    }
    
    // Automatically start the session tracking when the iframe loads.
    // This entirely removes the need to manually patch Godot's index.html!
    iframe.onload = () => {
      if (typeof window.__tds_startSession === "function") {
        window.__tds_startSession(gameId);
      }
    };
  };

  // Bind play buttons across the page
  playButtons.forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const card = btn.closest("[data-game-card]") || btn;
      const src = card.dataset.gameSrc || btn.dataset.gameSrc;
      const title = card.dataset.gameTitle || btn.dataset.gameTitle || "Game";
      const genre = card.dataset.gameGenre || btn.dataset.gameGenre || "Web Game";
      const icon = card.dataset.gameIcon || btn.dataset.gameIcon || "assets/dice-clicker-idle-icon.png";
      const aspect = card.dataset.gameAspect || btn.dataset.gameAspect || "16-9";

      loadGame({ src, title, genre, icon, aspect, scrollTo: true });
    });
  });

  // Reload active game
  reloadBtn?.addEventListener("click", () => {
    if (iframe && iframe.src && iframe.src !== "about:blank") {
      const currentSrc = iframe.src;
      iframe.src = "about:blank";
      setTimeout(() => {
        iframe.src = currentSrc;
      }, 50);
    }
  });

  // Fullscreen toggle
  fullscreenBtn?.addEventListener("click", () => {
    if (!viewport) return;
    
    // Check for iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      if (viewport.classList.contains("ios-fullscreen")) {
        viewport.classList.remove("ios-fullscreen");
      } else {
        viewport.classList.add("ios-fullscreen");
      }
      return;
    }

    if (!document.fullscreenElement) {
      if (viewport.requestFullscreen) {
        viewport.requestFullscreen();
      } else if (viewport.webkitRequestFullscreen) {
        viewport.webkitRequestFullscreen();
      } else if (viewport.msRequestFullscreen) {
        viewport.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  // Aspect ratio toggles
  aspectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const ratio = btn.dataset.aspect;
      if (ratio) setAspect(ratio);
    });
  });

  // Check URL parameters for direct deep-linking e.g. play.html?game=dice-clicker-idle or play.html?src=game.html
  const urlParams = new URLSearchParams(window.location.search);
  const requestedGame = urlParams.get("game") || urlParams.get("src") || urlParams.get("play");

  if (requestedGame) {
    // Try to find a matching card
    const matchingCard = Array.from(playableCards).find(
      (c) =>
        c.dataset.gameId === requestedGame ||
        c.dataset.gameSrc?.toLowerCase().includes(requestedGame.toLowerCase())
    );

    if (matchingCard) {
      loadGame({
        src: matchingCard.dataset.gameSrc,
        title: matchingCard.dataset.gameTitle,
        genre: matchingCard.dataset.gameGenre,
        icon: matchingCard.dataset.gameIcon,
        aspect: matchingCard.dataset.gameAspect || "16-9",
        scrollTo: false,
      });
    } else if (requestedGame.endsWith(".html")) {
      // Direct html file parameter
      loadGame({
        src: requestedGame,
        title: requestedGame.replace(".html", "").replace(/[-_]/g, " ").toUpperCase(),
        genre: "Custom Game",
        icon: "assets/dice-clicker-idle-icon.png",
        aspect: "16-9",
        scrollTo: false,
      });
    }
  }
};

initGamePlayer();

// ==========================================================================
// Theme Toggle
// ==========================================================================
const themeToggle = document.getElementById("theme-toggle");
if (themeToggle) {
  // Load saved theme (default to light for new visitors)
  const savedTheme = localStorage.getItem("twoday-theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const nextTheme = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("twoday-theme", nextTheme);
  });
}

// ==========================================================================
// Custom JSON Localization System
// ==========================================================================
const langSelect = document.getElementById("lang-select");

const langLabels = {
  en: "🇺🇸 EN",
  tr: "🇹🇷 TR",
  ar: "🇪🇬 AR",
  zh: "🇨🇳 ZH"
};

const langDropdownEl   = document.getElementById("lang-dropdown");
const langDropdownBtn  = document.getElementById("lang-dropdown-toggle");
const langDropdownMenu = document.getElementById("lang-dropdown-menu");
const langDropdownLabel= document.getElementById("lang-dropdown-label");

let currentTranslations = {};

const applyTranslations = (translations) => {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[key]) {
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "OPTION") {
         if (el.tagName === "OPTION") el.textContent = translations[key];
         else if (el.hasAttribute("placeholder")) el.placeholder = translations[key];
         else el.value = translations[key];
      } else {
        el.innerHTML = translations[key];
      }
    }
  });
};

const i18nData = {
  "en": {
    "nav_play": "Play",
    "nav_games": "Games",
    "nav_about": "About",
    "nav_vision": "Vision",
    "nav_press": "Press",
    "nav_contact": "Contact",
    "hero_eyebrow": "Independent mobile games",
    "hero_tagline": "Games on the go for Everyone",
    "hero_desc": "TwoDay Studio is a lean, highly-agile two-person team. We iterate and ship games at breakneck speed, creating fun, delightful mobile experiences that anyone can pick up, play, and enjoy anytime on the go.",
    "hero_btn_play": "Play in Browser",
    "hero_btn_games": "Our Games",
    "hero_btn_contact": "Contact",
    "games_eyebrow": "Games",
    "games_title": "Mobile-first games with compact loops.",
    "games_desc": "Our current slate focuses on quick sessions, strong feedback and ideas that can grow from simple prototypes into replayable daily habits.",
    "game_dice_eyebrow": "Idle clicker • Web Playable",
    "game_dice_desc": "Roll, tap, upgrade and chase lucky streaks in a punchy idle loop built for short mobile sessions.",
    "game_dice_f1": "Dice-based rewards",
    "game_dice_f2": "Upgrade-focused progression",
    "game_dice_f3": "Juicy tap feedback",
    "game_btn_play": "Play in Browser",
    "game_btn_page": "Game Page",
    "game_btn_business": "Business Contact",
    "game_jump_eyebrow": "Arcade jumper • Web Playable",
    "game_jump_desc": "Jump upward, collect coins and keep momentum alive in a clean vertical arcade game designed for quick retries.",
    "game_jump_f1": "Vertical jump flow",
    "game_jump_f2": "Coin chase pacing",
    "game_jump_f3": "Simple mobile timing",
    "game_btn_coming": "Coming Soon",
    "about_eyebrow": "About",
    "about_title": "Two people, rapid execution, massive potential.",
    "about_p1": "Twoday Studio is a two-person powerhouse focused on building simple, addictive, and character-driven games. We execute fast, iterate constantly, and ship high-quality mobile experiences.",
    "about_p2": "We care about rapid prototyping and cross-cultural appeal. Representing a global audience (English, Turkish, Arabic, and Chinese), we are actively seeking publishing partners and investors to help scale our agile production pipeline to the next level.",
    "about_p3": "Instead of chasing huge systems too early, we test compact mechanics, readable progression and playful themes until the core loop feels undeniably clear.",
    "feat_1_title": "Rapid Prototyping",
    "feat_1_desc": "Small ideas become playable quickly, then earn their way forward through feel.",
    "feat_2_title": "Mobile-First Design",
    "feat_2_desc": "Every loop is shaped for quick sessions, thumb-friendly play and clean feedback.",
    "feat_3_title": "Experimental Ideas",
    "feat_3_desc": "We chase memorable hooks, expressive characters and playful systems with bite.",
    "vision_eyebrow": "Vision",
    "vision_title": "Small games that feel worth coming back to.",
    "vision_desc": "We want Twoday Studio games to be easy to start, clear to read and satisfying enough to live on a phone for months.",
    "vis_1_title": "Player First",
    "vis_1_desc": "Readable goals, short sessions and feedback that respects the player's time.",
    "vis_2_title": "Polished Loops",
    "vis_2_desc": "Simple mechanics, strong pacing and rewards that feel good without being noisy.",
    "vis_3_title": "Smart Growth",
    "vis_3_desc": "Prototype quickly, learn from playtests and scale only the ideas that earn it.",
    "press_eyebrow": "Press / Business",
    "press_title": "For publishers, investors and press.",
    "press_desc": "Twoday Studio is open to conversations with publishing partners, investors, platform teams and press contacts. As an agile and highly productive 2-person team, we are ready to scale globally.",
    "press_btn": "View Press Kit",
    "contact_eyebrow": "Contact",
    "contact_title": "Let's talk games.",
    "contact_desc": "Use the business form for partnerships, publishing, investment or press. Use Need Help for player support and bug reports.",
    "contact_biz_title": "Business Contact",
    "contact_biz_desc": "For publishers, investors, press, platform teams and collaboration requests.",
    "contact_name": "Name",
    "contact_email": "Email",
    "contact_company": "Company",
    "contact_reason": "Reason",
    "contact_msg": "Message",
    "contact_btn_email": "Send Email",
    "contact_biz_note": "Your message will be sent securely to TwoDay Studio.",
    "contact_help_title": "Need Help",
    "contact_help_desc": "Send a secure support ticket for game issues, bugs or player questions.",
    "contact_help_email": "Your Email",
    "contact_help_game": "Game",
    "contact_help_issue": "Issue Type",
    "contact_help_dev": "Device / Platform",
    "contact_help_details": "Details",
    "contact_btn_ticket": "Send Ticket",
    "contact_not_bot": "I am not a robot",
    "contact_help_note": "A ticket ID will be generated in the email subject.",
    "footer_privacy": "Privacy Policy",
    "footer_stats": "Live Stats",
    "opt_select_reason": "Select a reason",
    "opt_publish": "Publishing",
    "opt_invest": "Investment",
    "opt_press": "Press",
    "opt_platform": "Platform / Store",
    "opt_partner": "Partnership",
    "opt_other": "Other",
    "opt_select_game": "Select a game",
    "opt_game_web": "Website",
    "opt_select_issue": "Select issue type",
    "opt_bug": "Bug Report",
    "opt_q": "Gameplay Question",
    "opt_acc": "Account / Purchase",
    "opt_feed": "Feedback",
    "library_eyebrow": "Game Library",
    "library_title": "Select a game to launch.",
    "library_desc": "Click <strong>Play in Browser</strong> on any game to load it into the player above.",
    "game_web_playable": "Web Playable",
    "game_genre_idle": "Idle Clicker",
    "game_genre_arcade": "Arcade Jumper",
    "game_btn_info": "Game Info",
    "stats_eyebrow": "Real-Time Data",
    "stats_title": "Live Stats",
    "stats_desc": "Transparent analytics for <span class=\"notranslate\" translate=\"no\">Twoday Studio</span>. Every number is deduplicated - no inflated counts.",
    "stat_visitors": "Unique Visitors",
    "stat_visitors_desc": "Total unique browsers that visited the site",
    "stat_plays": "Game Plays",
    "stat_plays_desc": "Total unique game launches across all games",
    "stat_games": "Games Available",
    "stat_games_desc": "Playable games on the platform",
    "stats_breakdown_eyebrow": "Per-Game Breakdown",
    "stats_breakdown_title": "Play Counts by Game",
    "stats_retention_eyebrow": "Retention & Engagement",
    "stats_retention_title": "Session & Streak Metrics",
    "stats_note": "Session duration is tracked via the Page Visibility API - time spent with the game tab hidden is excluded.<br>Streaks count consecutive days a unique player returned to the same game.<br>D1/D7 retention is tracked natively via GA4 Cohort Explorations using each player's persistent anonymous ID.",
    "stats_footer_note": "Analytics powered by <strong>Google Analytics 4</strong> &amp; <strong>Cloudflare Workers + D1</strong><br>Data is deduplicated across 3 layers: client localStorage, database PRIMARY KEY, and IP+UA fingerprint",
    "meta_status": "Status",
    "meta_live": "Live",
    "meta_dev": "In Development",
    "meta_platform": "Platform",
    "meta_mobile_web": "Mobile / Web",
    "stat_starts": "Game Starts",
    "stat_valid_sessions": "Valid Sessions (>10s)",
    "stat_total_playtime": "Total Playtime (All Users)",
    "stat_avg_session": "Avg Session Duration",
    "stat_longest_streak": "Longest Return Streak",
    "stat_d1": "D1 Retention",
    "stat_d7": "D7 Retention",
    "stat_5min": "5-Min Target",
    "stat_ptr": "Play-Through Rate",
    "stat_ptr_desc": "Valid sessions vs game starts",
    "stat_low_data": "(Low Data)",
    "stat_loading": "Loading...",
    "stat_no_backend": "Analytics backend not yet deployed.",
    "stat_no_plays": "No game plays recorded yet. Be the first!",
    "stat_no_eng": "No engagement data yet. Play a game to start tracking!",
    "stat_fetch_fail": "Could not load analytics data. Please try again later.",
    "stat_ret_fail": "Could not load retention data. Please try again later.",
    "game_btn_details": "Game Details",
    "library_page_desc": "Tap an icon to open a game page or play online.",
    "press_page_title": "Press Kit",
    "press_page_subheading": "Assets, logos, and company information for press and media.",
    "press_company_facts_title": "Company Facts",
    "press_founders_label": "Founders:",
    "press_focus_label": "Focus:",
    "press_focus_val": "Indie mobile games",
    "press_platform_label": "Release Platform:",
    "press_contact_label": "Contact:",
    "press_brand_assets_title": "Brand Assets",
    "press_brand_assets_desc": "Download our official logos, icons, and game screenshots for media use.",
    "press_btn_access": "Access Press Kit Folder",
    "game_btn_gp_soon": "Google Play Soon",
    "meta_genre": "Genre",
    "dice_feat1_title": "Tap and Roll",
    "dice_feat1_desc": "Fast tactile taps feed into bright dice rolls and satisfying reward bursts.",
    "dice_feat2_title": "Upgrade Loops",
    "dice_feat2_desc": "Simple upgrades keep the idle loop readable, punchy and easy to return to.",
    "dice_feat3_title": "Lucky Streaks",
    "dice_feat3_desc": "Short sessions are built around momentum, surprises and clean mobile feedback.",
    "dice_notes_eyebrow": "Production Notes",
    "dice_notes_title": "Designed around one more roll.",
    "dice_notes_desc": "One Two Dice is being shaped around quick reward cycles, visible upgrade impact and a clean path from casual tapping into deeper idle progression.",
    "jump_feat1_title": "Vertical Flow",
    "jump_feat1_desc": "Quick jumps and clean arcs make every run readable from the first second.",
    "jump_feat2_title": "Coin Chase",
    "jump_feat2_desc": "Collectibles and streaks give each climb a clear reason to keep pushing higher.",
    "jump_feat3_title": "Mobile Timing",
    "jump_feat3_desc": "Simple controls, immediate feedback and short runs make it easy to replay.",
    "jump_notes_eyebrow": "Production Notes",
    "jump_notes_title": "Built for quick retries.",
    "jump_notes_desc": "Jump Todo is being tuned around simple inputs, readable vertical hazards and satisfying coin routes that make each short run feel a little sharper than the last.",
    "game_basket_eyebrow": "Arcade Sports",
    "game_basket_desc": "Bounce, aim, and score in this fast-paced arcade basketball game.",
    "game_basket_f1": "Fast-paced gameplay",
    "game_basket_f2": "Arcade style scoring",
    "game_basket_f3": "Responsive physics"
  },
  "tr": {
    "nav_play": "Oyna",
    "nav_games": "Oyunlar",
    "nav_about": "Hakkımızda",
    "nav_vision": "Vizyon",
    "nav_press": "Basın",
    "nav_contact": "İletişim",
    "hero_eyebrow": "Bağımsız mobil oyunlar",
    "hero_tagline": "Herkes için taşınabilir oyunlar",
    "hero_desc": "TwoDay Studio, son derece çevik, iki kişilik bir ekiptir. Hızlıca oyunlar geliştiriyor, herkesin istediği zaman keyifle oynayabileceği eğlenceli ve akıcı mobil deneyimler yaratıyoruz.",
    "hero_btn_play": "Tarayıcıda Oyna",
    "hero_btn_games": "Oyunlarımız",
    "hero_btn_contact": "İletişim",
    "games_eyebrow": "Oyunlar",
    "games_title": "Kısa döngülü mobil oyunlar.",
    "games_desc": "Oyunlarımız, kısa oturumlar, güçlü geri bildirimler ve basit prototiplerden günlük alışkanlıklara dönüşebilen fikirlere odaklanır.",
    "game_dice_eyebrow": "Boşta Tıklama • Web'de Oynanabilir",
    "game_dice_desc": "Kısa mobil oturumlar için tasarlanmış sağlam bir döngüde zar atın, dokunun, yükseltin ve şanslı serileri yakalayın.",
    "game_dice_f1": "Zar tabanlı ödüller",
    "game_dice_f2": "Yükseltme odaklı ilerleme",
    "game_dice_f3": "Tatmin edici dokunuş hissi",
    "game_btn_play": "Tarayıcıda Oyna",
    "game_btn_page": "Oyun Sayfası",
    "game_btn_business": "İş İletişimi",
    "game_jump_eyebrow": "Arcade zıplama • Web'de Oynanabilir",
    "game_jump_desc": "Hızlı tekrarlar için tasarlanmış temiz, dikey bir arcade oyununda yukarı zıplayın, altınları toplayın ve ivmeyi koruyun.",
    "game_jump_f1": "Dikey zıplama akışı",
    "game_jump_f2": "Altın toplama temposu",
    "game_jump_f3": "Basit mobil zamanlama",
    "game_btn_coming": "Çok Yakında",
    "about_eyebrow": "Hakkımızda",
    "about_title": "İki kişi, hızlı üretim, devasa potansiyel.",
    "about_p1": "Twoday Studio, basit, bağımlılık yapan ve karakter odaklı oyunlar geliştirmeye odaklanan iki kişilik bir güç merkezidir. Hızlı hareket ediyor, sürekli geliştiriyor ve yüksek kaliteli mobil deneyimler sunuyoruz.",
    "about_p2": "Hızlı prototiplemeye ve kültürlerarası uyuma önem veriyoruz. Küresel bir kitleye (İngilizce, Türkçe, Arapça ve Çince) hitap ederek, çevik üretim hattımızı bir üst seviyeye taşımak için yayıncı ortaklar ve yatırımcılar arıyoruz.",
    "about_p3": "Çok erken aşamada devasa sistemler peşinde koşmak yerine, ana döngü kusursuz hissedilene kadar kompakt mekanikleri, anlaşılır ilerlemeyi ve eğlenceli temaları test ediyoruz.",
    "feat_1_title": "Hızlı Prototipleme",
    "feat_1_desc": "Küçük fikirler hızla oynanabilir hale gelir, ardından oyuncu hissiyle kendini kanıtlar.",
    "feat_2_title": "Önce Mobil Tasarım",
    "feat_2_desc": "Her döngü kısa oturumlar, başparmak dostu oyun ve temiz geri bildirim için şekillendirilmiştir.",
    "feat_3_title": "Deneysel Fikirler",
    "feat_3_desc": "Unutulmaz kancalar, etkileyici karakterler ve tatmin edici sistemlerin peşindeyiz.",
    "vision_eyebrow": "Vizyon",
    "vision_title": "Geri dönmeye değer küçük oyunlar.",
    "vision_desc": "Twoday Studio oyunlarının kolay başlanabilir, net anlaşılabilir ve telefonda aylarca kalacak kadar tatmin edici olmasını istiyoruz.",
    "vis_1_title": "Önce Oyuncu",
    "vis_1_desc": "Anlaşılır hedefler, kısa oturumlar ve oyuncunun zamanına saygı duyan geri bildirimler.",
    "vis_2_title": "Cilalı Döngüler",
    "vis_2_desc": "Basit mekanikler, güçlü tempo ve gürültülü olmadan iyi hissettiren ödüller.",
    "vis_3_title": "Akıllı Büyüme",
    "vis_3_desc": "Hızla prototip yap, testlerden öğren ve yalnızca hak eden fikirleri büyüt.",
    "press_eyebrow": "Basın / İş",
    "press_title": "Yayıncılar, yatırımcılar ve basın için.",
    "press_desc": "Twoday Studio, yayıncı ortaklar, yatırımcılar, platform ekipleri ve basın bağlantıları ile görüşmelere açıktır. Çevik ve son derece üretken 2 kişilik bir ekip olarak, küresel ölçekte büyümeye hazırız.",
    "press_btn": "Basın Kitini Görüntüle",
    "contact_eyebrow": "İletişim",
    "contact_title": "Oyun konuşalım.",
    "contact_desc": "Ortaklıklar, yayıncılık, yatırım veya basın için iş formunu kullanın. Oyuncu desteği ve hata bildirimleri için Yardım formunu kullanın.",
    "contact_biz_title": "İş İletişimi",
    "contact_biz_desc": "Yayıncılar, yatırımcılar, basın, platform ekipleri ve işbirliği istekleri için.",
    "contact_name": "İsim",
    "contact_email": "E-posta",
    "contact_company": "Şirket",
    "contact_reason": "Sebep",
    "contact_msg": "Mesaj",
    "contact_btn_email": "E-posta Taslağı Aç",
    "contact_biz_note": "Bu statik form, mesajın doldurulmuş haliyle e-posta uygulamanızı açar.",
    "contact_help_title": "Yardım İhtiyacı",
    "contact_help_desc": "Oyun sorunları, hatalar veya oyuncu soruları için bir destek bileti taslağı oluşturun.",
    "contact_help_email": "E-postanız",
    "contact_help_game": "Oyun",
    "contact_help_issue": "Sorun Türü",
    "contact_help_dev": "Cihaz / Platform",
    "contact_help_details": "Detaylar",
    "contact_btn_ticket": "Bilet E-postası Oluştur",
    "contact_help_note": "E-posta konusunda bir bilet kimliği oluşturulacaktır.",
    "footer_privacy": "Gizlilik Politikası",
    "footer_stats": "Canlı İstatistikler",
    "opt_select_reason": "Bir sebep seçin",
    "opt_publish": "Yayıncılık",
    "opt_invest": "Yatırım",
    "opt_press": "Basın",
    "opt_platform": "Platform / Mağaza",
    "opt_partner": "Ortaklık",
    "opt_other": "Diğer",
    "opt_select_game": "Bir oyun seçin",
    "opt_game_web": "Web Sitesi",
    "opt_select_issue": "Sorun türü seçin",
    "opt_bug": "Hata Bildirimi",
    "opt_q": "Oynanış Sorusu",
    "opt_acc": "Hesap / Satın Alma",
    "opt_feed": "Geri Bildirim",
    "library_eyebrow": "Oyun Kütüphanesi",
    "library_title": "Başlatmak için bir oyun seçin.",
    "library_desc": "Yukarıdaki oynatıcıya yüklemek için herhangi bir oyunda <strong>Tarayıcıda Oyna</strong>'ya tıklayın.",
    "game_web_playable": "Web'de Oynanabilir",
    "game_genre_idle": "Boşta Tıklama",
    "game_genre_arcade": "Arcade Zıplama",
    "game_btn_info": "Oyun Bilgisi",
    "stats_eyebrow": "Gerçek Zamanlı Veri",
    "stats_title": "Canlı İstatistikler",
    "stats_desc": "<span class=\"notranslate\" translate=\"no\">Twoday Studio</span> için şeffaf analitikler. Her sayı tekilleştirilmiştir - şişirilmiş sayım yoktur.",
    "stat_visitors": "Tekil Ziyaretçiler",
    "stat_visitors_desc": "Siteyi ziyaret eden toplam tekil tarayıcılar",
    "stat_plays": "Oynanma Sayısı",
    "stat_plays_desc": "Tüm oyunlarda toplam tekil oyun başlatmaları",
    "stat_games": "Mevcut Oyunlar",
    "stat_games_desc": "Platformda oynanabilir oyunlar",
    "stats_breakdown_eyebrow": "Oyun Bazında Dağılım",
    "stats_breakdown_title": "Oyuna Göre Oynanma Sayıları",
    "stats_retention_eyebrow": "Elde Tutma ve Etkileşim",
    "stats_retention_title": "Oturum ve Seri Metrikleri",
    "stats_note": "Oturum süresi Sayfa Görünürlük API'si ile takip edilir - oyun sekmesi gizliyken geçirilen süre hariç tutulur.<br>Seriler, tekil bir oyuncunun aynı oyuna döndüğü ardışık günleri sayar.<br>D1/D7 elde tutma, her oyuncunun kalıcı anonim kimliği kullanılarak GA4 Kohort Keşifleri aracılığıyla yerel olarak izlenir.",
    "stats_footer_note": "<strong>Google Analytics 4</strong> &amp; <strong>Cloudflare Workers + D1</strong> tarafından desteklenen analitikler.<br>Veriler 3 katmanda tekilleştirilir: istemci localStorage, veritabanı PRIMARY KEY ve IP+UA parmak izi.",
    "meta_status": "Durum",
    "meta_live": "Yayında",
    "meta_dev": "Geliştirme Aşamasında",
    "meta_platform": "Platform",
    "meta_mobile_web": "Mobil / Web",
    "stat_starts": "Oyun Başlangıçları",
    "stat_valid_sessions": "Geçerli Oturumlar (>10s)",
    "stat_total_playtime": "Toplam Oynama Süresi (Tüm Kullanıcılar)",
    "stat_avg_session": "Ortalama Oturum Süresi",
    "stat_longest_streak": "En Uzun Dönüş Serisi",
    "stat_d1": "D1 Elde Tutma",
    "stat_d7": "D7 Elde Tutma",
    "stat_5min": "5 Dk Hedefi",
    "stat_ptr": "Oynanış Oranı",
    "stat_ptr_desc": "Geçerli oturumlar / Oyun başlangıçları",
    "stat_low_data": "(Düşük Veri)",
    "stat_loading": "Yükleniyor...",
    "stat_no_backend": "Analitik arka ucu henüz dağıtılmadı.",
    "stat_no_plays": "Henüz kaydedilmiş oyun oynanmadı. İlk siz olun!",
    "stat_no_eng": "Henüz etkileşim verisi yok. İzlemeye başlamak için bir oyun oynayın!",
    "stat_fetch_fail": "Analitik verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.",
    "stat_ret_fail": "Elde tutma verileri yüklenemedi. Lütfen daha sonra tekrar deneyin.",
    "game_btn_details": "Oyun Detayları",
    "library_page_desc": "Oyun sayfasını açmak veya çevrimiçi oynamak için bir simgeye dokunun.",
    "press_page_title": "Basın Kitı",
    "press_page_subheading": "Basın ve medya için materyaller, logolar ve şirket bilgileri.",
    "press_company_facts_title": "Şirket Bilgileri",
    "press_founders_label": "Kurucular:",
    "press_focus_label": "Odak:",
    "press_focus_val": "Bağımsız mobil oyunlar",
    "press_platform_label": "Yayın Platformu:",
    "press_contact_label": "İletişim:",
    "press_brand_assets_title": "Marka Materyalleri",
    "press_brand_assets_desc": "Medya kullanımı için resmi logolarımızı, simgelerimizi ve oyun ekran görüntülerini indirin.",
    "press_btn_access": "Basın Kitı Klasörüne Eriş",
    "game_btn_gp_soon": "Google Play Çok Yakında",
    "meta_genre": "Tür",
    "dice_feat1_title": "Dokun ve Yuvarla",
    "dice_feat1_desc": "Hızlı dokunuşlar parlak zar atışlarına ve tatmin edici ödül patlamalarına dönüşür.",
    "dice_feat2_title": "Yükseltme Döngüleri",
    "dice_feat2_desc": "Basit yükseltmeler boşta tıklama döngüsünü anlaşılır ve akıcı tutar.",
    "dice_feat3_title": "Şanslı Seriler",
    "dice_feat3_desc": "Kısa oturumlar ivme, sürprizler ve temiz mobil geri bildirim etrafında kuruludur.",
    "dice_notes_eyebrow": "Üretim Notları",
    "dice_notes_title": "Bir zar daha atma hissiyle tasarlandı.",
    "dice_notes_desc": "One Two Dice, hızlı ödül döngüleri, görünür yükseltme etkisi ve basit tıklamadan derin ilerlemeye uzanan temiz bir yol etrafında şekilleniyor.",
    "jump_feat1_title": "Dikey Akış",
    "jump_feat1_desc": "Hızlı zıplamalar ve temiz kavisler her turu ilk saniyeden itibaren anlaşılır kılar.",
    "jump_feat2_title": "Altın Takibi",
    "jump_feat2_desc": "Toplanabilir ögeler ve seriler her tırmanışa daha yükseğe çıkmak için net bir neden verir.",
    "jump_feat3_title": "Mobil Zamanlama",
    "jump_feat3_desc": "Basit kontroller, anlık geri bildirim ve kısa turlar tekrar oynamayı kolaylaştırır.",
    "jump_notes_eyebrow": "Üretim Notları",
    "jump_notes_title": "Hızlı tekrarlar için üretildi.",
    "jump_notes_desc": "Jump Todo, basit kontroller, okunabilir dikey engeller ve her turu bir öncekinden daha keskin hissettiren tatmin edici altın rotaları etrafında ayarlanıyor.",
    "game_basket_eyebrow": "Arcade Spor",
    "game_basket_desc": "Bu hızlı tempolu arcade basketbol oyununda zıpla, nişan al ve skor yap.",
    "game_basket_f1": "Hızlı oynanış",
    "game_basket_f2": "Arcade tarzı skorlama",
    "game_basket_f3": "Tepkisel fizik"
  },
  "ar": {
    "nav_play": "العب",
    "nav_games": "الألعاب",
    "nav_about": "عننا",
    "nav_vision": "رؤيتنا",
    "nav_press": "الصحافة",
    "nav_contact": "تواصل معنا",
    "hero_eyebrow": "ألعاب موبايل مستقلة",
    "hero_tagline": "ألعاب في أي مكان وللجميع",
    "hero_desc": "استوديو TwoDay هو فريق مرن وسريع مكون من شخصين فقط. بنطور وننشر الألعاب بسرعة رهيبة عشان نقدم تجارب ممتعة ومميزة على الموبايل تقدر تلعبها في أي وقت وأي مكان.",
    "hero_btn_play": "العب في المتصفح",
    "hero_btn_games": "ألعابنا",
    "hero_btn_contact": "تواصل معنا",
    "games_eyebrow": "الألعاب",
    "games_title": "ألعاب موبايل بجلسات سريعة.",
    "games_desc": "تركيزنا الحالي على جلسات اللعب السريعة وردود الفعل القوية والأفكار اللي ممكن تكبر من مجرد نموذج أولي لعادة يومية ممتعة.",
    "game_dice_eyebrow": "لعبة نقر • متوفرة على الويب",
    "game_dice_desc": "ارمي الزهر، اضغط، طوّر، وجمع النقاط في حلقة لعب سريعة وممتعة متصممة لجلسات الموبايل القصيرة.",
    "game_dice_f1": "مكافآت مبنية على الزهر",
    "game_dice_f2": "تقدم مبني على التطوير",
    "game_dice_f3": "رد فعل ممتع للنقر",
    "game_btn_play": "العب في المتصفح",
    "game_btn_page": "صفحة اللعبة",
    "game_btn_business": "تواصل للأعمال",
    "game_jump_eyebrow": "لعبة قفز آركيد • متوفرة على الويب",
    "game_jump_desc": "نط لفوق، جمع العملات وحافظ على سرعتك في لعبة آركيد عمودية سريعة متصممة لمحاولات اللعب السريعة.",
    "game_jump_f1": "قفز عمودي مستمر",
    "game_jump_f2": "تجميع عملات ممتع",
    "game_jump_f3": "توقيت بسيط للموبايل",
    "game_btn_coming": "قريباً",
    "about_eyebrow": "عننا",
    "about_title": "شخصين، سرعة في التنفيذ، وإمكانيات ضخمة.",
    "about_p1": "استوديو Twoday هو قوة مكونة من شخصين بتركز على بناء ألعاب بسيطة وإدمانية بتعتمد على الشخصيات. بنشتغل بسرعة، بنطور باستمرار، وبننشر تجارب ممتازة على الموبايل.",
    "about_p2": "بنهتم بالنماذج الأولية السريعة والجاذبية للثقافات المختلفة. بنقدم ألعابنا لجمهور عالمي (إنجليزي، تركي، عربي، وصيني)، وبندور على شركاء نشر ومستثمرين عشان نكبر مستوى إنتاجنا السريع للمرحلة الجاية.",
    "about_p3": "بدل ما نجري ورا أنظمة معقدة من البداية، بنختبر ميكانيكيات لعب صغيرة، وتطور واضح، وثيمات ممتعة لحد ما نحس إن أساس اللعبة ممتاز.",
    "feat_1_title": "نماذج أولية سريعة",
    "feat_1_desc": "الأفكار الصغيرة بتتحول لألعاب بسرعة، وبعدين بتثبت نفسها بمتعتها.",
    "feat_2_title": "تصميم للموبايل أولاً",
    "feat_2_desc": "كل خطوة في اللعبة متصممة لجلسات سريعة ومناسبة للعب بصباع واحد.",
    "feat_3_title": "أفكار تجريبية",
    "feat_3_desc": "بندور على أفكار تعلق في الدماغ وشخصيات معبرة وأنظمة لعب ممتعة.",
    "vision_eyebrow": "رؤيتنا",
    "vision_title": "ألعاب صغيرة تستاهل ترجعلها.",
    "vision_desc": "عايزين ألعاب استوديو Twoday تكون سهلة في بدايتها وممتعة لدرجة تخليك تسيبها على موبايلك لشهور.",
    "vis_1_title": "اللاعب أولاً",
    "vis_1_desc": "أهداف واضحة، جلسات قصيرة، ومتعة تحترم وقت اللاعب.",
    "vis_2_title": "لعب مصقول",
    "vis_2_desc": "ميكانيكيات بسيطة، وتيرة سريعة ومكافآت ممتعة من غير دوشة.",
    "vis_3_title": "نمو ذكي",
    "vis_3_desc": "بنعمل نماذج بسرعة، بنتعلم من الاختبارات وبنكبر الأفكار اللي تستاهل بس.",
    "press_eyebrow": "الصحافة / الأعمال",
    "press_title": "للناشرين، المستثمرين، والصحافة.",
    "press_desc": "استوديو Twoday مفتوح للمحادثات مع شركاء النشر، المستثمرين، وفرق المنصات والصحافة. كفريق مرن ومنتج جداً من شخصين، إحنا جاهزين للتوسع عالمياً.",
    "press_btn": "عرض الملف الصحفي",
    "contact_eyebrow": "تواصل معنا",
    "contact_title": "خلينا نتكلم في الألعاب.",
    "contact_desc": "استخدم نموذج الأعمال للشراكات، النشر، الاستثمار أو الصحافة. واستخدم المساعدة لدعم اللاعبين والإبلاغ عن المشاكل.",
    "contact_biz_title": "تواصل للأعمال",
    "contact_biz_desc": "للناشرين، المستثمرين، الصحافة، فرق المنصات، وطلبات التعاون.",
    "contact_name": "الاسم",
    "contact_email": "الإيميل",
    "contact_company": "الشركة",
    "contact_reason": "السبب",
    "contact_msg": "الرسالة",
    "contact_btn_email": "افتح مسودة الإيميل",
    "contact_biz_note": "النموذج ده هيفتح تطبيق الإيميل بتاعك والرسالة مكتوبة جاهزة.",
    "contact_help_title": "محتاج مساعدة",
    "contact_help_desc": "اعمل مسودة تذكرة دعم لمشاكل اللعبة أو أسئلة اللاعبين.",
    "contact_help_email": "إيميلك",
    "contact_help_game": "اللعبة",
    "contact_help_issue": "نوع المشكلة",
    "contact_help_dev": "الجهاز / المنصة",
    "contact_help_details": "التفاصيل",
    "contact_btn_ticket": "اعمل إيميل التذكرة",
    "contact_help_note": "هيتم إنشاء رقم تذكرة في عنوان الإيميل.",
    "footer_privacy": "سياسة الخصوصية",
    "footer_stats": "إحصائيات مباشرة",
    "opt_select_reason": "اختار سبب",
    "opt_publish": "نشر",
    "opt_invest": "استثمار",
    "opt_press": "صحافة",
    "opt_platform": "منصة / متجر",
    "opt_partner": "شراكة",
    "opt_other": "أخرى",
    "opt_select_game": "اختار لعبة",
    "opt_game_web": "الموقع",
    "opt_select_issue": "اختار نوع المشكلة",
    "opt_bug": "الإبلاغ عن مشكلة",
    "opt_q": "سؤال عن اللعب",
    "opt_acc": "حساب / شراء",
    "opt_feed": "ملاحظات",
    "library_eyebrow": "مكتبة الألعاب",
    "library_title": "اختر لعبة للبدء.",
    "library_desc": "انقر على <strong>العب في المتصفح</strong> على أي لعبة لتحميلها في المشغل أعلاه.",
    "game_web_playable": "قابلة للعب على الويب",
    "game_genre_idle": "نقر خامل",
    "game_genre_arcade": "قفز آركيد",
    "game_btn_info": "معلومات اللعبة",
    "stats_eyebrow": "بيانات الوقت الفعلي",
    "stats_title": "إحصائيات حية",
    "stats_desc": "تحليلات شفافة لـ <span class=\"notranslate\" translate=\"no\">Twoday Studio</span>. تم إلغاء تكرار كل رقم - لا توجد أعداد مضخمة.",
    "stat_visitors": "الزوار الفريدون",
    "stat_visitors_desc": "إجمالي المتصفحات الفريدة التي زارت الموقع",
    "stat_plays": "مرات اللعب",
    "stat_plays_desc": "إجمالي إطلاقات الألعاب الفريدة عبر جميع الألعاب",
    "stat_games": "الألعاب المتاحة",
    "stat_games_desc": "الألعاب القابلة للعب على المنصة",
    "stats_breakdown_eyebrow": "تفصيل حسب اللعبة",
    "stats_breakdown_title": "أعداد مرات اللعب حسب اللعبة",
    "stats_retention_eyebrow": "الاحتفاظ والتفاعل",
    "stats_retention_title": "مقاييس الجلسة والخطوط المتتالية",
    "stats_note": "يتم تتبع مدة الجلسة عبر واجهة برمجة تطبيقات Page Visibility - يتم استبعاد الوقت الذي تقضيه مع إخفاء علامة تبويب اللعبة.<br>تحسب الخطوط المتتالية الأيام المتتالية التي عاد فيها لاعب فريد إلى نفس اللعبة.<br>يتم تتبع الاحتفاظ D1/D7 أصليًا عبر GA4 Cohort Explorations باستخدام المعرف المجهول الدائم لكل لاعب.",
    "stats_footer_note": "تحليلات مدعومة من <strong>Google Analytics 4</strong> و <strong>Cloudflare Workers + D1</strong><br>يتم إلغاء تكرار البيانات عبر 3 طبقات: localStorage للعميل، والمفتاح الأساسي لقاعدة البيانات، وبصمة IP+UA.",
    "meta_status": "الحالة",
    "meta_live": "مباشر",
    "meta_dev": "قيد التطوير",
    "meta_platform": "المنصة",
    "meta_mobile_web": "جوال / ويب",
    "stat_starts": "بدايات اللعبة",
    "stat_valid_sessions": "جلسات صالحة (>10 ثوانٍ)",
    "stat_total_playtime": "إجمالي وقت اللعب (جميع المستخدمين)",
    "stat_avg_session": "متوسط مدة الجلسة",
    "stat_longest_streak": "أطول سلسلة عودة",
    "stat_d1": "الاحتفاظ D1",
    "stat_d7": "الاحتفاظ D7",
    "stat_5min": "هدف 5 دقائق",
    "stat_ptr": "معدل اللعب",
    "stat_ptr_desc": "الجلسات الصالحة مقابل بدايات اللعبة",
    "stat_low_data": "(بيانات منخفضة)",
    "stat_loading": "جاري التحميل...",
    "stat_no_backend": "الخلفية التحليلية لم يتم نشرها بعد.",
    "stat_no_plays": "لم يتم تسجيل أي ألعاب بعد. كن الأول!",
    "stat_no_eng": "لا توجد بيانات تفاعل بعد. العب لعبة لبدء التتبع!",
    "stat_fetch_fail": "تعذر تحميل البيانات التحليلية. يرجى المحاولة مرة أخرى لاحقًا.",
    "stat_ret_fail": "تعذر تحميل بيانات الاحتفاظ. يرجى المحاولة مرة أخرى لاحقًا.",
    "game_btn_details": "تفاصيل اللعبة",
    "library_page_desc": "انقر على رمز لفتح صفحة اللعبة أو اللعب عبر الإنترنت.",
    "press_page_title": "الملف الصحفي",
    "press_page_subheading": "الأصول والشعارات ومعلومات الشركة للصحافة ووسائل الإعلام.",
    "press_company_facts_title": "حقائق عن الشركة",
    "press_founders_label": "المؤسسون:",
    "press_focus_label": "التركيز:",
    "press_focus_val": "ألعاب موبايل مستقلة",
    "press_platform_label": "منصة الإصدار:",
    "press_contact_label": "التواصل:",
    "press_brand_assets_title": "أصول العلامة التجارية",
    "press_brand_assets_desc": "قم بتنزيل الشعارات والأيقونات ولقطات الشاشة الرسمية للألعاب لاستخدامها في وسائل الإعلام.",
    "press_btn_access": "الوصول إلى مجلد الملف الصحفي",
    "game_btn_gp_soon": "قريباً على Google Play",
    "meta_genre": "النوع",
    "dice_feat1_title": "اضغط وارمي",
    "dice_feat1_desc": "نقرات سريعة تتحول لرميات زهر ممتعة ومكافآت ممتازة.",
    "dice_feat2_title": "حلقات التطوير",
    "dice_feat2_desc": "تطويرات بسيطة بتخلي اللعبة واضحة وسهلة ترجعلها.",
    "dice_feat3_title": "سلسلة الحظ",
    "dice_feat3_desc": "جلسات قصيرة مبنية على السرعة والمفاجآت والاستجابة السريعة.",
    "dice_notes_eyebrow": "ملاحظات الإنتاج",
    "dice_notes_title": "متصممة عشان رمية زهر كمان.",
    "dice_notes_desc": "One Two Dice بتتطور حول دورات مكافآت سريعة وتأثير تطوير واضح وطريق سهل من النقر البسيط للتقدم العميق.",
    "jump_feat1_title": "تدفق عمودي",
    "jump_feat1_desc": "قفزات سريعة وحركات واضحة بتخلي كل محاولة سهلة الفهم من أول ثانية.",
    "jump_feat2_title": "مطاردة العملات",
    "jump_feat2_desc": "تجميع العملات والسلاسل بيدي كل صعود سبب واضح للوصول لأعلى.",
    "jump_feat3_title": "توقيت الموبايل",
    "jump_feat3_desc": "تحكم بسيط واستجابة فورية ومحاولات قصيرة بتسهل إعادة اللعب.",
    "jump_notes_eyebrow": "ملاحظات الإنتاج",
    "jump_notes_title": "مصممة لمحاولات سريعة.",
    "jump_notes_desc": "Jump Todo بتتضبط حول تحكم بسيط ومخاطر عمودية واضحة ومسارات عملات ممتعة بتخلي كل محاولة أفضل من اللي قبلها.",
    "game_basket_eyebrow": "رياضة آركيد",
    "game_basket_desc": "نطط، صوب، وسجل في لعبة كرة السلة الآركيد السريعة دي.",
    "game_basket_f1": "لعب سريع الإيقاع",
    "game_basket_f2": "تسجيل أهداف بأسلوب الآركيد",
    "game_basket_f3": "فيزياء متجاوبة"
  },
  "zh": {
    "nav_play": "开始游戏",
    "nav_games": "游戏列表",
    "nav_about": "关于我们",
    "nav_vision": "愿景",
    "nav_press": "媒体",
    "nav_contact": "联系我们",
    "hero_eyebrow": "独立手机游戏",
    "hero_tagline": "随时随地，畅玩游戏",
    "hero_desc": "TwoDay Studio 是一支极其精干敏捷的两人团队。我们以惊人的速度迭代和发布游戏，致力于创造任何人都可以随时随地轻松享受的移动端游戏体验。",
    "hero_btn_play": "网页端试玩",
    "hero_btn_games": "我们的游戏",
    "hero_btn_contact": "联系我们",
    "games_eyebrow": "游戏项目",
    "games_title": "主打移动端，小巧循环的游戏。",
    "games_desc": "我们目前的产品线侧重于快速游戏体验、强烈的反馈，以及能从简单的原型成长为令人欲罢不能的日常习惯的绝佳点子。",
    "game_dice_eyebrow": "放置点击 • 网页可玩",
    "game_dice_desc": "为短暂的手机碎片时间打造的充满打击感的放置游戏：掷骰子、点击、升级，追逐你的幸运连击！",
    "game_dice_f1": "掷骰子赢奖励",
    "game_dice_f2": "注重升级的养成",
    "game_dice_f3": "令人满足的点击反馈",
    "game_btn_play": "网页端试玩",
    "game_btn_page": "游戏主页",
    "game_btn_business": "商务洽谈",
    "game_jump_eyebrow": "街机跳跃 • 网页可玩",
    "game_jump_desc": "在一款专为快速重开设计的简洁垂直街机游戏中：向上跳跃，收集金币，保持冲刺势头。",
    "game_jump_f1": "垂直跳跃流程",
    "game_jump_f2": "金币追逐节奏",
    "game_jump_f3": "简单的操作时机",
    "game_btn_coming": "敬请期待",
    "about_eyebrow": "关于我们",
    "about_title": "两人团队，神速执行，无限潜力。",
    "about_p1": "Twoday Studio 是一家由两人组成的精英工作室，专注于打造简单、令人上瘾且以角色为核心的游戏。我们执行迅速，不断迭代，持续输出高品质的移动端体验。",
    "about_p2": "我们注重快速原型设计和跨文化吸引力。我们的游戏面向全球受众（支持英语、土耳其语、阿拉伯语和中文），并正积极寻求与中国及全球的发行伙伴和投资者合作，以帮助我们将敏捷的生产管线提升到一个新的台阶。",
    "about_p3": "与其过早地追求庞大的系统，我们更倾向于测试紧凑的机制、清晰的养成线和好玩的主题，直到游戏的核心循环拥有不可否认的魅力。",
    "feat_1_title": "快速原型设计",
    "feat_1_desc": "让小巧的点子迅速变为可玩的形态，然后通过手感证明自己的价值。",
    "feat_2_title": "移动端优先设计",
    "feat_2_desc": "每个游戏循环都专为快速游玩而塑造，提供顺畅的单手操作和清晰的反馈。",
    "feat_3_title": "实验性创意",
    "feat_3_desc": "我们追求令人难忘的亮点，生动的角色以及充满乐趣的系统。",
    "vision_eyebrow": "愿景",
    "vision_title": "值得让你一次次回味的小游戏。",
    "vision_desc": "我们希望 Twoday Studio 的游戏容易上手，目标清晰，并且足够让人满足，愿意将它在手机里保留好几个月。",
    "vis_1_title": "玩家优先",
    "vis_1_desc": "清晰的目标，简短的单次游玩时间，以及尊重玩家时间的反馈。",
    "vis_2_title": "精心打磨的循环",
    "vis_2_desc": "简单的机制，强烈的节奏，以及感觉良好但不喧宾夺主的奖励。",
    "vis_3_title": "明智的增长",
    "vis_3_desc": "快速制作原型，从测试中学习，只扩展那些被证明有价值的想法。",
    "press_eyebrow": "媒体 / 商务",
    "press_title": "致发行商、投资者和媒体。",
    "press_desc": "Twoday Studio 乐意与发行伙伴、投资者、平台团队和媒体代表进行洽谈。作为一支敏捷且高产的两人团队，我们已做好准备在全球范围内扩展。",
    "press_btn": "查看媒体资料包",
    "contact_eyebrow": "联系我们",
    "contact_title": "来谈谈游戏吧。",
    "contact_desc": "寻求合作伙伴关系、发行、投资或媒体采访，请使用商务表单。寻求玩家支持和错误报告，请使用需要帮助表单。",
    "contact_biz_title": "商务洽谈",
    "contact_biz_desc": "面向发行商、投资者、媒体、平台团队和合作请求。",
    "contact_name": "姓名",
    "contact_email": "电子邮箱",
    "contact_company": "公司名称",
    "contact_reason": "联系事由",
    "contact_msg": "留言内容",
    "contact_btn_email": "打开邮件草稿",
    "contact_biz_note": "此静态表单将打开您的邮件客户端，并已填好留言。",
    "contact_help_title": "需要帮助",
    "contact_help_desc": "为游戏问题、错误反馈或玩家提问创建支持工单草稿。",
    "contact_help_email": "您的电子邮箱",
    "contact_help_game": "游戏名称",
    "contact_help_issue": "问题类型",
    "contact_help_dev": "设备 / 平台",
    "contact_help_details": "详细情况",
    "contact_btn_ticket": "创建工单邮件",
    "contact_help_note": "邮件主题中将会生成一个工单编号。",
    "footer_privacy": "隐私政策",
    "footer_stats": "实时数据",
    "opt_select_reason": "选择一个事由",
    "opt_publish": "发行合作",
    "opt_invest": "投资意向",
    "opt_press": "媒体报道",
    "opt_platform": "平台 / 商店",
    "opt_partner": "合作伙伴",
    "opt_other": "其他",
    "opt_select_game": "选择一款游戏",
    "opt_game_web": "公司网站",
    "opt_select_issue": "选择问题类型",
    "opt_bug": "错误报告",
    "opt_q": "游戏疑问",
    "opt_acc": "账号 / 购买",
    "opt_feed": "意见反馈",
    "library_eyebrow": "游戏库",
    "library_title": "选择一款游戏启动。",
    "library_desc": "点击任意游戏的<strong>在浏览器中游玩</strong>，将其加载到上方的播放器中。",
    "game_web_playable": "网页可玩",
    "game_genre_idle": "放置点击",
    "game_genre_arcade": "街机跳跃",
    "game_btn_info": "游戏详情",
    "stats_eyebrow": "实时数据",
    "stats_title": "实时统计",
    "stats_desc": "<span class=\"notranslate\" translate=\"no\">Twoday Studio</span> 的透明分析。每个数字均已去重 - 绝无虚报。",
    "stat_visitors": "独立访客",
    "stat_visitors_desc": "访问网站的独立浏览器总数",
    "stat_plays": "游戏游玩次数",
    "stat_plays_desc": "所有游戏的独立启动总数",
    "stat_games": "现有游戏",
    "stat_games_desc": "平台上可玩的游戏",
    "stats_breakdown_eyebrow": "各游戏明细",
    "stats_breakdown_title": "各游戏游玩次数",
    "stats_retention_eyebrow": "留存与互动",
    "stats_retention_title": "会话与连续天数指标",
    "stats_note": "会话时长通过 Page Visibility API 跟踪 - 游戏标签隐藏的时间会被排除。<br>连续天数计算独立玩家返回同一游戏的连续天数。<br>D1/D7 留存通过 GA4 队列探索使用每个玩家的永久匿名 ID 原生追踪。",
    "stats_footer_note": "分析由 <strong>Google Analytics 4</strong> 和 <strong>Cloudflare Workers + D1</strong> 提供支持。<br>数据通过 3 个层级去重：客户端 localStorage，数据库 PRIMARY KEY，以及 IP+UA 指纹。",
    "meta_status": "状态",
    "meta_live": "已上线",
    "meta_dev": "开发中",
    "meta_platform": "平台",
    "meta_mobile_web": "移动端 / 网页端",
    "stat_starts": "游戏启动次数",
    "stat_valid_sessions": "有效会话 (>10秒)",
    "stat_total_playtime": "总游玩时长 (所有用户)",
    "stat_avg_session": "平均会话时长",
    "stat_longest_streak": "最长连续回归天数",
    "stat_d1": "D1 留存",
    "stat_d7": "D7 留存",
    "stat_5min": "5分钟目标",
    "stat_ptr": "通关率",
    "stat_ptr_desc": "有效会话对比游戏启动",
    "stat_low_data": "(数据量少)",
    "stat_loading": "加载中...",
    "stat_no_backend": "分析后端尚未部署。",
    "stat_no_plays": "尚未记录任何游戏游玩。成为第一个！",
    "stat_no_eng": "尚无互动数据。玩个游戏开始跟踪！",
    "stat_fetch_fail": "无法加载分析数据，请稍后再试。",
    "stat_ret_fail": "无法加载留存数据，请稍后再试。",
    "game_btn_details": "游戏详情",
    "library_page_desc": "点击图标打开游戏页面或在线游玩。",
    "press_page_title": "媒体资料包",
    "press_page_subheading": "面向媒体和新闻界提供的资源、标识及公司信息。",
    "press_company_facts_title": "公司概况",
    "press_founders_label": "创始人：",
    "press_focus_label": "核心领域：",
    "press_focus_val": "独立手机游戏",
    "press_platform_label": "发布平台：",
    "press_contact_label": "联系方式：",
    "press_brand_assets_title": "品牌资源",
    "press_brand_assets_desc": "下载我们的官方标识、图标及游戏截图以供媒体使用。",
    "press_btn_access": "访问媒体资料包文件夹",
    "game_btn_gp_soon": "Google Play 敬请期待",
    "meta_genre": "类型",
    "dice_feat1_title": "点击与掷骰",
    "dice_feat1_desc": "快捷的操作手感触发炫丽的掷骰与令人满足的奖励爆发。",
    "dice_feat2_title": "升级循环",
    "dice_feat2_desc": "简单的升级保持放置循环通俗易懂、节奏紧凑且随时想玩。",
    "dice_feat3_title": "幸运连击",
    "dice_feat3_desc": "短时局基于势头、惊喜和顺畅的移动端反馈打造。",
    "dice_notes_eyebrow": "制作笔记",
    "dice_notes_title": "围绕“再掷一次”而设计。",
    "dice_notes_desc": "One Two Dice 围绕快速的奖励周期、直观的升级效果以及从休闲点击到深度放置养成的顺畅体验而精心塑造。",
    "jump_feat1_title": "垂直流程",
    "jump_feat1_desc": "快速的跳跃与清爽的弧线让每一次尝试从第一秒起就清晰明了。",
    "jump_feat2_title": "金币追逐",
    "jump_feat2_desc": "收集物与连击为每次攀升提供了不断冲高的明确理由。",
    "jump_feat3_title": "移动端时机",
    "jump_feat3_desc": "简单的控制、即时的反馈与短频快的单局让重开变得毫无负担。",
    "jump_notes_eyebrow": "制作笔记",
    "jump_notes_title": "专为快速重开而打造。",
    "jump_notes_desc": "Jump Todo 围绕简单的输入、清晰的垂直障碍和令人满足的金币路线进行调校，让每次短局都比上一次更感精准。",
    "game_basket_eyebrow": "街机体育",
    "game_basket_desc": "在这款快节奏的街机篮球游戏中弹跳、瞄准并得分。",
    "game_basket_f1": "快节奏游戏",
    "game_basket_f2": "街机风格得分",
    "game_basket_f3": "灵敏物理反馈"
  }
};

const loadLanguage = async (lang) => {
  try {
    if (i18nData[lang]) {
      currentTranslations = i18nData[lang];
      applyTranslations(currentTranslations);
      document.documentElement.lang = lang;
    }
  } catch (err) {
    console.error("Failed to load language:", lang, err);
  }
};
if (langDropdownBtn && langDropdownMenu) {
  langDropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = langDropdownEl.classList.toggle("is-open");
    langDropdownBtn.setAttribute("aria-expanded", isOpen);
  });

  document.addEventListener("click", () => {
    langDropdownEl.classList.remove("is-open");
    langDropdownBtn.setAttribute("aria-expanded", "false");
  });

  const updateDropdownUI = (lang) => {
    if (langDropdownLabel) langDropdownLabel.textContent = langLabels[lang] || langLabels.en;
    langDropdownMenu.querySelectorAll("button[data-lang]").forEach(btn => {
      btn.classList.toggle("is-selected", btn.dataset.lang === lang);
    });
  };

  langDropdownMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-lang]");
    if (!btn) return;
    e.stopPropagation();
    const lang = btn.dataset.lang;
    langDropdownEl.classList.remove("is-open");
    langDropdownBtn.setAttribute("aria-expanded", "false");

    if (langSelect) {
      langSelect.value = lang;
      langSelect.dispatchEvent(new Event("change"));
    }
  });

  let savedLang = localStorage.getItem("twoday-lang");

  if (!savedLang) {
    fetch("https://get.geojs.io/v1/ip/country.json")
      .then((response) => response.json())
      .then((data) => {
        const country = data.country;
        let autoLang = "en"; 
        
        if (country === "TR") autoLang = "tr";
        else if (["CN", "TW", "HK", "MO"].includes(country)) autoLang = "zh";
        else if (["EG", "SA", "AE", "IQ", "JO", "LB", "QA", "KW", "OM", "BH", "SY", "YE", "MA", "DZ", "TN"].includes(country)) autoLang = "ar";
        
        localStorage.setItem("twoday-lang", autoLang);
        if (langSelect) langSelect.value = autoLang;
        updateDropdownUI(autoLang);
        loadLanguage(autoLang);
      })
      .catch(() => {
        localStorage.setItem("twoday-lang", "en");
        updateDropdownUI("en");
        loadLanguage("en");
      });
  } else {
    updateDropdownUI(savedLang);
    loadLanguage(savedLang);
  }

  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      const lang = e.target.value;
      localStorage.setItem("twoday-lang", lang);
      updateDropdownUI(lang);
      loadLanguage(lang);
    });
  }
}

// ==========================================================================
// Easter Egg: TodoScape
// ==========================================================================
let jumpTodoClickCount = 0;
let jumpTodoClickTimer = null;

document.querySelectorAll('a[href="jumptodo.html"]').forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    jumpTodoClickCount++;
    
    if (jumpTodoClickTimer) clearTimeout(jumpTodoClickTimer);
    
    if (jumpTodoClickCount >= 12) {
      jumpTodoClickCount = 0;
      window.location.href = "Games/TodoScape/game.html";
      return;
    }
    
    jumpTodoClickTimer = setTimeout(() => {
       if (jumpTodoClickCount > 0) {
           jumpTodoClickCount = 0;
           window.location.href = link.href;
       }
    }, 400);
  });
});

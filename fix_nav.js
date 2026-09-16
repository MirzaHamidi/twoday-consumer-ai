const fs = require('fs');
const path = require('path');

const correctHeader = `    <header class="site-header" data-header>
      <div class="section-shell nav-shell">
        <a class="brand" href="index.html" aria-label="Twoday Studio home">
          <img src="assets/twodaysENT_Logo-white.png" alt="Twoday Studio Mascot" class="brand-mascot brand-mascot-light" />
          <img src="assets/mascotwht.png" alt="Twoday Studio Mascot" class="brand-mascot brand-mascot-dark" />
          <span class="brand-text"><span class="notranslate" translate="no">TWODAY STUDIO</span></span>
        </a>

        <nav class="site-nav" id="primary-navigation" aria-label="Primary navigation">
          <div class="nav-indicator" aria-hidden="true"></div>
          <a href="play.html" style="color: var(--mint);" data-i18n="nav_play">Play</a>
          <a href="games.html" data-i18n="nav_games">Games</a>
          <a href="index.html#about" data-i18n="nav_about">About</a>
          <a href="index.html#vision" data-i18n="nav_vision">Vision</a>
          <a href="press.html" data-i18n="nav_press">Press</a>
          <a href="index.html#contact" data-i18n="nav_contact">Contact</a>
        </nav>

        <div class="header-controls">
          <div class="lang-dropdown" id="lang-dropdown">
            <button class="lang-dropdown-toggle" id="lang-dropdown-toggle" aria-haspopup="listbox" aria-expanded="false" aria-label="Select Language">
              <span id="lang-dropdown-label">🇺🇸 EN</span>
              <span class="lang-dropdown-chevron" aria-hidden="true">&#9660;</span>
            </button>
            <div class="lang-dropdown-menu" role="listbox" id="lang-dropdown-menu">
              <button data-lang="en" class="is-selected">🇺🇸 EN - English</button>
              <button data-lang="tr">🇹🇷 TR - Türkçe</button>
              <button data-lang="ar">🇪🇬 AR - عربي</button>
              <button data-lang="zh">🇨🇳 ZH - 中文</button>
            </div>
          </div>
          <select id="lang-select" aria-label="Select Language">
            <option value="en">🇺🇸 EN</option>
            <option value="tr">🇹🇷 TR</option>
            <option value="ar">🇪🇬 AR</option>
            <option value="zh">🇨🇳 ZH</option>
          </select>
          <button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark/light theme">
            <span>🌓</span>
          </button>
          
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">
            <span class="sr-only">Toggle navigation</span>
            <span class="nav-toggle-line"></span>
            <span class="nav-toggle-line"></span>
          </button>
        </div>
      </div>
    </header>`;

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const file of files) {
    const fullPath = path.join(dir, file);
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace <header class="site-header"...> ... </header>
    const newContent = content.replace(/<header class="site-header"[\s\S]*?<\/header>/i, correctHeader);
    
    if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Fixed header in', file);
    }
}

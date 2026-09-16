const fs = require('fs');
const path = require('path');

const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We want to wrap "Twoday Studio" in <span translate="no" class="notranslate">Twoday Studio</span>
  // But only in text nodes, not inside HTML attributes (like alt="" or aria-label="")
  // And avoid double-wrapping.
  
  // First, unwrap if we already did it to make it idempotent
  const unwrapRegex = /<span class="notranslate" translate="no">(Twoday Studio)<\/span>/gi;
  content = content.replace(unwrapRegex, '$1');

  // Now, replace Twoday Studio outside of HTML tags.
  // The regex matches an HTML tag OR the phrase "Twoday Studio"
  const regex = /(<[^>]+>)|(Twoday\s+Studio)/gi;
  
  content = content.replace(regex, (match, tag, phrase) => {
    if (tag) {
      // It's an HTML tag or attribute, leave it alone
      return tag;
    }
    if (phrase) {
      // It's the text, wrap it!
      // We'll preserve the exact original case (Twoday Studio, TwoDay Studio, etc)
      return `<span class="notranslate" translate="no">${phrase}</span>`;
    }
    return match;
  });

  // What about TwoDay Studio or Twoday Studio inside <title>? We probably shouldn't put HTML inside <title>
  // Wait, if we wrap inside <title>, the browser will show the raw HTML <span> in the tab name!
  // Let's revert any <span> inside <title>...</title>
  content = content.replace(/<title>([\s\S]*?)<\/title>/gi, (match, inner) => {
    const cleanInner = inner.replace(/<span class="notranslate" translate="no">(.*?)<\/span>/gi, '$1');
    return `<title>${cleanInner}</title>`;
  });
  
  // Also inside <meta> tags, though our first regex skips <meta ...> tags entirely, so we're good there.
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});

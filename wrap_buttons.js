const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Regex to match <a class="button...">Text</a> or <button class="button...">Text</button> or <span class="button...">Text</span>
  // This regex looks for opening tag with class="button...", its inner text, and closing tag
  const regex = /<(a|button|span)([^>]*)class="([^"]*button[^"]*)"([^>]*)>(.*?)<\/\1>/gs;
  
  const newContent = content.replace(regex, (match, tag, beforeClass, classAttr, afterClass, innerText) => {
    // Ensure inner text is wrapped in span if not already
    let newInner = innerText.trim();
    if (!newInner.startsWith('<span')) {
      newInner = `<span>${newInner}</span>`;
    }
    
    // Check if it already wrapped with button-wrap to avoid double wrap
    // Actually we are replacing the inner part, the wrapping is outside.
    
    return `<div class="button-wrap">\n  <${tag}${beforeClass}class="${classAttr}"${afterClass}>\n    ${newInner}\n  </${tag}>\n  <div class="button-shadow"></div>\n</div>`;
  });
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log(`Updated ${file}`);
  }
});

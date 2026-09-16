const fs = require('fs');
const path = require('path');
const dir = '.';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const internalPages = ['play', 'games', 'press', 'privacy', 'analytics', 'jumptodo', 'dice-clicker-idle', 'one-two-dice'];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    internalPages.forEach(page => {
        // Match href="page" or href="page#hash"
        const regex = new RegExp('href="' + page + '([#?][^"]*)?"', 'g');
        content = content.replace(regex, 'href="' + page + '.html$1"');
    });

    fs.writeFileSync(file, content, 'utf8');
}
console.log('Reverted URLs');

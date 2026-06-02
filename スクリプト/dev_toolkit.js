const fs = require('fs');
const path = require('path');

function validateHtml(filename) {
    console.log(`Checking HTML: ${filename}...`);
    if (!fs.existsSync(filename)) {
        console.error(`X File not found: ${filename}`);
        return false;
    }
    const content = fs.readFileSync(filename, 'utf8');
    const stack = [];
    const selfClosing = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    
    // Simple tag matcher
    const tagRegex = /<(\/?[a-zA-Z0-9]+)([^>]*)>/g;
    let match;
    let errors = 0;

    while ((match = tagRegex.exec(content)) !== null) {
        const tagName = match[1].toLowerCase();
        const isClosing = tagName.startsWith('/');
        const realTagName = isClosing ? tagName.slice(1) : tagName;

        if (selfClosing.has(realTagName)) continue;

        if (isClosing) {
            if (stack.length === 0) {
                console.error(`X Unexpected closing tag </${realTagName}> at roughly position ${match.index}`);
                errors++;
            } else {
                const lastTag = stack.pop();
                if (lastTag !== realTagName) {
                    console.error(`X Mismatched tag: expected </${lastTag}>, but found </${realTagName}> at roughly position ${match.index}`);
                    errors++;
                }
            }
        } else {
            stack.push(realTagName);
        }
    }

    while (stack.length > 0) {
        console.error(`X Unclosed tag <${stack.pop()}>`);
        errors++;
    }

    if (errors === 0) {
        console.log(`✓ ${filename} is clean!`);
        return true;
    }
    return false;
}

function checkMdLinks(dir) {
    console.log(`Checking Markdown links in ${dir}...`);
    if (!fs.existsSync(dir)) {
        console.error(`X Directory not found: ${dir}`);
        return false;
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    let errors = 0;

    files.forEach(file => {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const linkRegex = /article\.html\?file=([^)\"\'\s>]+)/g;
        let match;
        while ((match = linkRegex.exec(content)) !== null) {
            const link = match[1].split('#')[0];
            const targetPath = path.resolve(process.cwd(), link);
            if (!fs.existsSync(targetPath)) {
                console.error(`X Broken link in ${file}: ${link} (file not found)`);
                errors++;
            }
        }
    });

    if (errors === 0) {
        console.log(`✓ All internal links are valid!`);
        return true;
    }
    return false;
}

const cmd = process.argv[2];
if (cmd === 'html') {
    const ok1 = validateHtml('index.html');
    const ok2 = validateHtml('article.html');
    process.exit(ok1 && ok2 ? 0 : 1);
} else if (cmd === 'links') {
    const ok = checkMdLinks('articles');
    process.exit(ok ? 0 : 1);
} else {
    console.log("Usage: node スクリプト/dev_toolkit.js [html|links]");
    process.exit(1);
}

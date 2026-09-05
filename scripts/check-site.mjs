import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

function walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return walk(fullPath);
        return entry.name.endsWith('.html') ? [fullPath] : [];
    });
}

const htmlFiles = walk('.').filter(file => !file.includes(`${path.sep}.git${path.sep}`));
assert.ok(htmlFiles.length >= 4, 'expected homepage and three project detail pages');

for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const directory = path.dirname(file);

    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        const link = match[1];
        if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#') || link.startsWith('mailto:')) continue;
        const clean = link.split('#')[0].split('?')[0];
        if (!clean) continue;
        const resolved = path.resolve(directory, clean);
        assert.ok(fs.existsSync(resolved), `${file}: missing local target ${link}`);
    }

    for (const match of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
        assert.match(match[0], /rel="noreferrer"/, `${file}: target=_blank link missing rel=noreferrer`);
    }
}

const homepage = fs.readFileSync('index.html', 'utf8');
for (const detail of [
    './projects/customer-map-planner.html',
    './projects/user-directory-api.html',
    './projects/milkyway.html',
]) {
    assert.ok(homepage.includes(detail), `homepage missing detail link: ${detail}`);
}

console.log(`Validated ${htmlFiles.length} portfolio HTML files.`);

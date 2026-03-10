'use strict';
const fs = require('fs');
const path = require('path');
const sel = require('../engine/selector');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const fg = n => `\x1b[38;5;${n}m`;

async function selectFile() {
    const dir = process.cwd();
    // Get items and prefix directories with icons
    const rawItems = fs.readdirSync(dir).filter(f => !f.startsWith('.'));

    // Sort: directories first, then files
    const sorted = rawItems.sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.localeCompare(b);
    });

    const menuItems = sorted.map(name => {
        const full = path.join(dir, name);
        const isDir = fs.statSync(full).isDirectory();
        return {
            name: name,
            label: isDir ? `${name}/` : name,
            icon: isDir ? '📁' : '📄',
            isDir: isDir
        };
    });

    // Add back option if not at root (optional, for now just follow the pattern)
    // But since the user wants "buttons", a list with arrow keys is perfect.

    const picked = await sel.select(menuItems, {
        title: `SELECT FILE  ·  ${dir}`,
    });

    if (!picked) {
        console.log(`\n  ${fg(238)}  Cancelled.${RESET}\n`);
        return null;
    }

    const full = path.join(dir, picked.name);
    if (picked.isDir) {
        process.chdir(full);
        return selectFile();
    }
    return full;
}

module.exports = { selectFile };
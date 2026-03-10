// ╔══════════════════════════════════════════════╗
// ║         CLAI  ·  UI LAUNCHER                 ║
// ╚══════════════════════════════════════════════╝
'use strict';

const { exec } = require('child_process');
require('./server');  // starts listening

// Give the server a moment to bind, then open browser
setTimeout(() => {
    const url = 'http://127.0.0.1:3131';
    const cmd = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;
    exec(cmd);
    console.log(`\x1b[38;5;238m  Press Ctrl+C to stop.\x1b[0m`);
}, 400);

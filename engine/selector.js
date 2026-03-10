// ╔══════════════════════════════════════════════╗
// ║          CLAI  ·  INTERACTIVE SELECTOR       ║
// ╚══════════════════════════════════════════════╝
'use strict';

const { C, visLen } = require('./animator');
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const fg = n => `\x1b[38;5;${n}m`;
const bg = n => `\x1b[48;5;${n}m`;

/**
 * Interactive selector for the terminal.
 * Supports arrow keys, enter to select, and escape to cancel.
 */
async function select(items, opts = {}) {
    if (!items || items.length === 0) return null;

    const title = opts.title || 'SELECT';
    const initialIndex = opts.initialIndex !== undefined ? opts.initialIndex : 0;
    let selectedIndex = initialIndex;
    const w = Math.min(process.stdout.columns || 80, 100);

    // Prepare stdin for raw mode
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    // Hide cursor
    process.stdout.write('\x1b[?25l');

    const render = () => {
        // Clear previous lines (we assume standard rendering for now)
        // For a more robust version, we'd track how many lines we printed.
        // But for these lists, we typically print and then clear everything on finish.
    };

    const drawList = () => {
        const titleColor = opts.titleColor || C.g1;
        const borderColor = opts.borderColor || C.dim;
        const highlightBg = opts.highlightBg || bg(236);
        const highlightFg = opts.highlightFg || C.white;

        let out = `\n  ${titleColor}${BOLD}${title}${RESET}\n`;
        out += `  ${borderColor}${'━'.repeat(w - 4)}${RESET}\n`;

        items.forEach((item, i) => {
            const isSelected = i === selectedIndex;
            const pointer = isSelected ? `${titleColor}${BOLD} ❯ ${RESET}` : '   ';
            const bgStr = isSelected ? highlightBg : '';
            const itemText = typeof item === 'string' ? item : (item.label || item.name);
            const icon = item.icon ? `${item.icon} ` : '';
            const desc = item.description ? `  ${C.dim}${item.description}${RESET}` : '';

            const line = `${pointer}${bgStr}${isSelected ? highlightFg + BOLD : C.silver}${icon}${itemText}${RESET}${desc}`;
            out += `  ${line}${RESET}\n`;
        });

        out += `  ${borderColor}${'━'.repeat(w - 4)}${RESET}`;
        return out;
    };

    // Initial draw
    process.stdout.write(drawList());

    const cleanup = () => {
        // Move cursor back to start of list so next thing overwrites it or we clear it
        const lines = items.length + 3;
        process.stdout.write(`\x1b[${lines}A\r\x1b[J`);
        stdin.setRawMode(wasRaw);
        stdin.pause();
        process.stdout.write('\x1b[?25h'); // restore cursor
    };

    return new Promise((resolve) => {
        const onData = (key) => {
            // Handle arrow keys and other inputs
            // Common ANSI sequences: \u001b[A (up), \u001b[B (down)
            if (key === '\u001b[A') { // Up
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            } else if (key === '\u001b[B') { // Down
                selectedIndex = (selectedIndex + 1) % items.length;
            } else if (key === '\r' || key === '\n') { // Enter
                cleanup();
                stdin.removeListener('data', onData);
                resolve(items[selectedIndex]);
                return;
            } else if (key === '\u001b' || key === '\u0003') { // Escape or Ctrl+C
                cleanup();
                stdin.removeListener('data', onData);
                resolve(null);
                return;
            }

            // Move up to start of list and redraw
            const lines = items.length + 3;
            process.stdout.write(`\x1b[${lines}A\r\x1b[J`);
            process.stdout.write(drawList());
        };

        stdin.on('data', onData);
    });
}

/**
 * Single yes/no toggle
 */
async function confirm(prompt) {
    const res = await select(['Yes', 'No'], { title: prompt, initialIndex: 0 });
    return res === 'Yes';
}

module.exports = { select, confirm };

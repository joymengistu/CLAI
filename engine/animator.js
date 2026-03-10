// ╔══════════════════════════════════════════════╗
// ║           CLAI  ·  ANIMATOR ENGINE           ║
// ╚══════════════════════════════════════════════╝
'use strict';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Windows VT100 compatibility ──────────────────────────────────────────────
// This can help ensure ANSI sequences work in older CMD versions
if (process.platform === 'win32') {
    // Note: Node 10+ handles this automatically for process.stdout if TTY
}


// ── Terminal helpers ─────────────────────────────────────────────────────────
const width = () => Math.min(process.stdout.columns || 80, 100);
const repeat = (ch, n) => ch.repeat(Math.max(0, n));

// ── ANSI 256-color palette ───────────────────────────────────────────────────
const fg = n => `\x1b[38;5;${n}m`;
const bg = n => `\x1b[48;5;${n}m`;
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITALIC = '\x1b[3m';

const C = {
    // Gemini Brand Gradient: Blue → Cyan → Purple
    g1: fg(75),    // Gemini Blue
    g2: fg(81),    // Light Blue
    g3: fg(51),    // Cyan
    g4: fg(141),   // Soft Purple
    g5: fg(165),   // Deep Purple
    // ui
    cyan: fg(81),
    teal: fg(80),
    green: fg(85),
    yellow: fg(220),
    orange: fg(214),
    red: fg(203),
    white: fg(231),
    silver: fg(252),
    gray: fg(244),
    dim: fg(238),
    // backgrounds
    bgPurple: bg(54),
    bgDark: bg(235),
    // shorthands
    res: RESET, bold: BOLD, dim2: DIM, ita: ITALIC,
};
exports.C = C;

const THEMES = {
    standard: { g1: 141, g2: 135, g3: 129, g4: 213, cyan: 81, green: 85 },
    neon: { g1: 198, g2: 199, g3: 200, g4: 201, cyan: 51, green: 46 },
    matrix: { g1: 40, g2: 34, g3: 28, g4: 22, cyan: 46, green: 46 },
    sunset: { g1: 202, g2: 208, g3: 214, g4: 220, cyan: 226, green: 190 },
    glitch: { g1: 160, g2: 161, g3: 162, g4: 163, cyan: 51, green: 196 },
    ocean: { g1: 18, g2: 19, g3: 20, g4: 21, cyan: 45, green: 111 },
    aurora: { g1: 48, g2: 49, g3: 50, g4: 51, cyan: 123, green: 34 },
    lava: { g1: 88, g2: 124, g3: 160, g4: 196, cyan: 202, green: 208 },
    cyber: { g1: 165, g2: 201, g3: 171, g4: 87, cyan: 159, green: 121 },
    forest: { g1: 22, g2: 28, g3: 34, g4: 40, cyan: 118, green: 155 },
    coffee: { g1: 52, g2: 94, g3: 130, g4: 166, cyan: 214, green: 222 },
    ghost: { g1: 235, g2: 240, g3: 245, g4: 250, cyan: 255, green: 244 },
    gold: { g1: 172, g2: 178, g3: 214, g4: 220, cyan: 226, green: 227 }
};

function setTheme(name) {
    const t = THEMES[name] || THEMES.standard;
    C.g1 = fg(t.g1); C.g2 = fg(t.g2); C.g3 = fg(t.g3); C.g4 = fg(t.g4);
    C.cyan = fg(t.cyan); C.green = fg(t.green);
}
exports.setTheme = setTheme;

function getThemeNames() { return Object.keys(THEMES); }
exports.getThemeNames = getThemeNames;

// ── Box drawing ──────────────────────────────────────────────────────────────
const BOX = {
    tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│',
    ml: '├', mr: '┤', mt: '┬', mb: '┴', x: '┼',
    dtl: '╔', dtr: '╗', dbl: '╚', dbr: '╝', dh: '═', dv: '║',
};

function boxLine(w) {
    return `${C.dim}${BOX.h.repeat(w)}${RESET}`;
}

/** Draws a full bordered box.
 * @param {string[]} lines  - content lines (plain text, may contain ANSI)
 * @param {{ color?, title?, width?, padding? }} opts
 */
function drawBox(lines, opts = {}) {
    const w = opts.width || width();
    const col = opts.color || C.dim;
    const pad = opts.padding !== undefined ? opts.padding : 1;
    const inner = w - 2;           // space between left │ and right │
    const padStr = ' '.repeat(pad);

    const title = opts.title ? ` ${opts.title} ` : '';
    const titleLen = visLen(title);
    const topFill = inner - titleLen;
    const leftFill = Math.floor(topFill / 2);
    const rightFill = topFill - leftFill;

    const top = `${col}${BOX.tl}${repeat(BOX.h, leftFill)}${RESET}${opts.titleColor || C.g1}${BOLD}${title}${RESET}${col}${repeat(BOX.h, rightFill)}${BOX.tr}${RESET}`;
    const bottom = `${col}${BOX.bl}${repeat(BOX.h, inner)}${BOX.br}${RESET}`;
    const empty = `${col}${BOX.v}${repeat(' ', inner)}${BOX.v}${RESET}`;

    const out = [top];
    if (pad) out.push(empty);
    for (const ln of lines) {
        const visible = visLen(ln);
        const fill = Math.max(0, inner - pad * 2 - visible);
        out.push(`${col}${BOX.v}${RESET}${padStr}${ln}${repeat(' ', fill)}${padStr}${col}${BOX.v}${RESET}`);
    }
    if (pad) out.push(empty);
    out.push(bottom);
    return out.join('\n');
}
exports.drawBox = drawBox;

/** Strip ANSI codes to measure visible length. */
function visLen(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}
exports.visLen = visLen;

function countWrappedLines(text, termWidth) {
    if (!text) return 0;
    let lines = 0;
    for (const ln of text.split('\n')) {
        const vLen = visLen(ln);
        lines += Math.max(1, Math.ceil(vLen / termWidth));
    }
    return lines;
}
exports.countWrappedLines = countWrappedLines;

// ── Gradient text ────────────────────────────────────────────────────────────
const GRAD_PALETTE = [141, 135, 99, 93, 129, 165, 213, 207];

function gradientText(text) {
    const chars = [...text];
    return chars.map((ch, i) => {
        const col = GRAD_PALETTE[Math.floor(i / chars.length * (GRAD_PALETTE.length - 1))];
        return `${fg(col)}${ch}`;
    }).join('') + RESET;
}
exports.gradientText = gradientText;

// ── ASCII BANNER ─────────────────────────────────────────────────────────────
const BANNER_LINES = [
    "  ▟██████▙      ██          ▄██████▄      ▟██▙ ",
    "  ██▘  ▝▀      ██         ██▘    ▝██      ██  ",
    "  ██           ██         ██      ██      ██  ",
    "  ██           ██         ██████████      ██  ",
    "  ██▖  ▄▛      ██         ██▘    ▝██      ██  ",
    "  ▜██████▛      ████████▛   ██      ██      ▜██▛ "
];

const SINGULARITY_BANNER = [
    "         ◈  A  E  T  H  E  R  -  S  T  I  T  C  H  ◈          ",
    "      ▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞      ",
    "   ▟██████▙  ▟██████▙  ▟██████▙  ▟██████▙  ▟██████▙   ",
    "   ██      ██  ██      ██  ██      ██  ██      ██  ██      ██   ",
    "   ██      ██  ██      ██  ██      ██  ██      ██  ██      ██   ",
    "   ▜██████▛  ▜██████▛  ▜██████▛  ▜██████▛  ▜██████▛   ",
    "      ▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞▚▞      ",
    "         ✧  S I N G U L A R I T Y   L E V E L   1000  ✧         "
];

async function animateBanner(singularity = false) {
    const w = width();
    const lines = singularity ? SINGULARITY_BANNER : BANNER_LINES;
    const bannerW = lines[0].length;
    const pad = Math.max(0, Math.floor((w - bannerW) / 2));
    const padding = ' '.repeat(pad);

    // Shimmer effect (Gemini Flow or Singularity Void)
    const themeCols = singularity
        ? [fg(235), fg(238), fg(241), fg(244), fg(247), fg(250)]
        : [C.g1, C.g2, C.g3, C.g4, C.g5];

    for (let frame = 0; frame < (singularity ? 30 : 20); frame++) {
        process.stdout.write('\x1b[H\n\n');
        lines.forEach((line, i) => {
            let formattedLine = '';
            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                if (char === ' ') {
                    formattedLine += ' ';
                    continue;
                }
                const offset = singularity ? (frame + c / 4 + i / 2) : (frame + c / 3 + i);
                const colIdx = Math.floor(offset % themeCols.length);
                const color = themeCols[colIdx];

                const isPulse = offset % (singularity ? 8 : 15) === 0;
                formattedLine += (isPulse ? C.white + BOLD : color) + char + RESET;
            }
            console.log(`${padding}${formattedLine}`);
        });
        await sleep(singularity ? 70 : 50);
    }
}
exports.animateBanner = animateBanner;

function vfx(type) {
    if (type === 'flicker') {
        process.stdout.write('\x1b[?25l');
        for (let i = 0; i < 5; i++) {
            process.stdout.write('\x1b[30m\x1b[40m');
            setTimeout(() => process.stdout.write(RESET), 50);
        }
        process.stdout.write('\x1b[?25h');
    } else if (type === 'glitch') {
        const w = width();
        for (let i = 0; i < 20; i++) {
            process.stdout.write(`\r${fg(Math.floor(Math.random() * 255))}${'#'.repeat(Math.random() * w)}${RESET}`);
        }
        process.stdout.write('\r\x1b[K');
    } else if (type === 'aurora') {
        const w = width();
        const colors = [48, 49, 50, 51, 123, 141, 165];
        for (let i = 0; i < 15; i++) {
            const col = fg(colors[i % colors.length]);
            process.stdout.write(`\r${col}${repeat('≈', Math.floor(Math.random() * w))}${RESET}`);
            // Small sleep is tricky in sync vfx, but we can do a loop with Date.now
            const t = Date.now(); while (Date.now() - t < 40);
        }
        process.stdout.write('\r\x1b[K');
    } else if (type === 'lexi_glow') {
        process.stdout.write('\x1b[?25l');
        for (let i = 232; i < 255; i++) {
            process.stdout.write(`\x1b[38;5;${i}m\x1b[2m`);
            const t = Date.now(); while (Date.now() - t < 10);
        }
        process.stdout.write(RESET + '\x1b[?25h');
    } else if (type === 'sync_weave') {
        const w = width();
        process.stdout.write('\x1b[?25l');
        for (let i = 0; i < 20; i++) {
            const row = Math.floor(Math.random() * 10);
            const col = Math.floor(Math.random() * w);
            process.stdout.write(`\x1b[${row};${col}H${fg(240)}░${RESET}`);
            const t = Date.now(); while (Date.now() - t < 20);
        }
        process.stdout.write('\x1b[?25h');
    } else if (type === 'ghost_buffer') {
        const w = width();
        const chars = "▖▗▘▙▚▛▜▝▞▟";
        for (let i = 0; i < 30; i++) {
            const col = Math.floor(Math.random() * w);
            const c = chars[Math.floor(Math.random() * chars.length)];
            process.stdout.write(`\x1b[2m\x1b[38;5;236m${c}${RESET}\r`);
            const t = Date.now(); while (Date.now() - t < 15);
        }
        process.stdout.write('\r\x1b[K');
    }
}
exports.vfx = vfx;

const ASCII_ART = {
    robot: [
        "      [ o  o ]",
        "     --| || |--",
        "       |_||_| ",
        "      /      \\"
    ],
    rocket: [
        "       /\\",
        "      /  \\",
        "     |    |",
        "     |    |",
        "    /|/\\/\\|\\",
        "   /_||||||_\\"
    ],
    cat: [
        "      |\\__/,|   (`\\",
        "    _.|o o  |_   ) )",
        "  -(((---(((--------"
    ],
    coffee: [
        "      )  (",
        "     (   ) )",
        "      ) ( (",
        "    _______)_",
        "   |       | )",
        "   |       |/",
        "   |_______|",
        "    _______"
    ],
    sword: [
        "          /\\",
        "         /  \\",
        "        |    |",
        "        |    |",
        "        |    |",
        "        |    |",
        "      --|    |--",
        "        |____|",
        "          ||",
        "          ||",
        "          ()"
    ],
    dragon: [
        "      <>=======()",
        "     (/\\___   /|\\\\          ()==========<>_",
        "           \\_/ | \\\\        //   _   _    __ \\",
        "             \\_|  \\\\      //   / \\_/ \\  /  \\_|",
        "               \\|   \\\\    //   |     |  |    |",
        "                |    \\\\  //    |     |  |    |",
        "                |     \\\\//     \\_____/  \\____/"
    ],
    skull: [
        "      .-'---'-.",
        "     /          \\",
        "    |   o    o   |",
        "    |     ||     |",
        "     \\  '----'  /",
        "      '-.____.-'"
    ],
    phoenix: [
        "       /\\",
        "    __(  )__",
        "   /  (  )  \\",
        "  /    \\/    \\",
        " /  /\\    /\\  \\",
        "(__/  \\__/  \\__)"
    ],
    castle: [
        "     [█]  [█]  [█]",
        "     | |__| |__| |",
        "     |           |",
        "     |   _   _   |",
        "     |  | | | |  |",
        "     |__| |_| |__|"
    ],
    kraken: [
        "      .---. ",
        "     ( o o )",
        "    /\\     /\\",
        "   / /\\   /\\ \\",
        "  / /  \\ /  \\ \\",
        "  \\/    '    \\/"
    ],
    ghost: [
        "     .-. ",
        "    (o o)",
        "    | O |",
        "    |   |",
        "    '~~~'"
    ],
    cactus: [
        "      _  _ ",
        "     | || | ",
        "     | || |_",
        "     |__   _|",
        "        | |",
        "        |_|"
    ],
    heart: [
        "     .-..-. ",
        "    /:/  \\:\\",
        "    \\:\\  /:/",
        "     \\:\\/:/ ",
        "      \\::/  ",
        "       \\/   "
    ]
};

function drawAscii(name) {
    const art = ASCII_ART[name];
    if (!art) return;
    const w = width();
    const artW = Math.max(...art.map(l => l.length));
    const pad = Math.max(0, Math.floor((w - artW) / 2));
    art.forEach(line => console.log(' '.repeat(pad) + C.g1 + line + RESET));
}
exports.drawAscii = drawAscii;

function getAsciiNames() { return Object.keys(ASCII_ART); }
exports.getAsciiNames = getAsciiNames;

function drawCustomAscii(text) {
    if (!text) return;
    const lines = text.split('\n');
    const w = width();
    const artW = Math.max(...lines.map(l => l.replace(/\x1b\[[0-9;]*m/g, '').length));
    const pad = Math.max(0, Math.floor((w - artW) / 2));
    const padStr = ' '.repeat(pad);
    console.log('');
    lines.forEach(line => console.log(padStr + C.g1 + line + RESET));
    console.log('');
}
exports.drawCustomAscii = drawCustomAscii;

function glitchText(text) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()";
    return text.split('').map(c => Math.random() > 0.8 ? chars[Math.floor(Math.random() * chars.length)] : c).join('');
}
exports.glitchText = glitchText;

function drawClock() {
    const now = new Date();
    const time = now.toLocaleTimeString();
    const w = width();
    const pad = Math.floor((w - time.length - 4) / 2);
    console.log(`\n${' '.repeat(pad)}${C.g1}╭${'─'.repeat(time.length + 2)}╮${RESET}`);
    console.log(`${' '.repeat(pad)}${C.g1}│ ${C.white}${BOLD}${time}${RESET}${C.g1} │${RESET}`);
    console.log(`${' '.repeat(pad)}${C.g1}╰${'─'.repeat(time.length + 2)}╯${RESET}\n`);
}
exports.drawClock = drawClock;

function drawSysInfo() {
    const os = require('os');
    const free = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
    const total = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const cpu = os.cpus().length;
    const info = `CPU: ${cpu} Cores  |  RAM: ${free} / ${total} GB Free`;
    const w = width();
    const pad = Math.max(0, Math.floor((w - info.length) / 2));
    console.log(`\n${' '.repeat(pad)}${C.dim}${info}${RESET}\n`);
}
exports.drawSysInfo = drawSysInfo;

async function drawTimeMenu() {
    const sel = require('./selector');
    const options = [
        { label: 'World Clock', description: 'Show times for NY, LDN, TYO' },
        { label: 'Set Reminder', description: 'Create a quick timer' },
        { label: 'Uptime', description: 'System session duration' }
    ];
    const picked = await sel.select(options, { title: 'TIME CONTROL' });
    if (!picked) return;

    if (picked.label === 'World Clock') {
        const times = [
            ['New York', 'America/New_York'],
            ['London', 'Europe/London'],
            ['Tokyo', 'Asia/Tokyo']
        ].map(([city, tz]) => {
            const t = new Date().toLocaleTimeString('en-US', { timeZone: tz });
            return `  ${C.cyan}${city.padEnd(12)}${RESET} ${C.white}${t}${RESET}`;
        });
        console.log('\n' + drawBox(times, { title: ' GLOBAL TIMES ', width: 40 }) + '\n');
    } else if (picked.label === 'Set Reminder') {
        console.log(`\n  ${C.yellow}Reminder feature coming soon in full v3 release!${RESET}\n`);
    } else if (picked.label === 'Uptime') {
        const up = Math.floor(process.uptime());
        console.log(`\n  ${C.green}Session Uptime: ${BOLD}${up}s${RESET}\n`);
    }
}
exports.drawTimeMenu = drawTimeMenu;

function printSubtitle(model) {
    const w = width();
    const sub = `Command-Line AI Interface  ·  ${model || 'initializing...'}`;
    const pad = Math.max(0, Math.floor((w - sub.length) / 2));
    console.log(`${' '.repeat(pad)}${C.dim}${sub}${RESET}`);
}

// ── Divider ──────────────────────────────────────────────────────────────────
function divider(char = '─', color = C.dim) {
    console.log(`${color}${repeat(char, width())}${RESET}`);
}
exports.divider = divider;

// ── Spinner frames ───────────────────────────────────────────────────────────
const SPINNER_FRAMES = ['/', '-', '\\', '|'];
const SPINNER_MSGS = ['THINKING', 'PROCESS', 'ANALYZE', 'WORK...'];

function pulse(label) {
    let i = 0, mc = 0;
    const msg = (label || SPINNER_MSGS[Math.floor(Math.random() * SPINNER_MSGS.length)]).toUpperCase();
    const iv = setInterval(() => {
        const frame = SPINNER_FRAMES[i % SPINNER_FRAMES.length];
        const dots = '.'.repeat((mc % 3) + 1).padEnd(3, ' ');
        // Retro look: [ / ] MESSAGE...
        process.stdout.write(`\r\x1b[K${C.dim}[${RESET}${C.g4}${frame}${RESET}${C.dim}]${RESET} ${C.silver}${BOLD}${msg}${dots}${RESET}`);
        mc++;
        i++;
    }, 100);
    return () => {
        clearInterval(iv);
        process.stdout.write('\r\x1b[K');
    };
}
exports.pulse = pulse;

// -- Footer / status bar ------------------------------------------------------
function drawFooter(dir, model, msgCount) {
    const w = width();
    const left = ` ${C.g1}${BOLD}CLAI${RESET} ${C.dim}│${RESET} ${C.cyan}${model}${RESET}`;
    const cnt = msgCount !== undefined ? ` ${C.dim}│${RESET} ${C.gray} ${msgCount} msgs${RESET}` : '';
    const right = ` ${C.dim}${shortenPath(dir)}${RESET} `;

    const leftLen = visLen(` CLAI │ ${model}`) + (msgCount !== undefined ? visLen(` │ ${msgCount} msgs`) : 0);
    const rightLen = visLen(right);
    const fill = Math.max(1, w - leftLen - rightLen - cnt.replace(/\x1b\[[0-9;]*m/g, '').length);

    console.log(`${C.dim}${repeat('─', w)}${RESET}`);
    process.stdout.write(`${left}${cnt}${' '.repeat(fill)}${right}\n`);
}
exports.drawFooter = drawFooter;

function shortenPath(p) {
    const parts = p.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return parts.join('/');
    return `…/${parts.slice(-2).join('/')}`;
}

// ── Help panel ───────────────────────────────────────────────────────────────
function drawHelp() {
    const w = width();

    const sections = [
        // [command, description, group]
        ['AI', null, 'group'],
        ['"""', 'Multi-line input mode (type """ again to send)', ''],
        ['!<cmd>', 'Run a shell command  (also: run <cmd>)', ''],
        ['/scan', 'Architect Mode: Map project for AI intelligence', ''],
        ['', '', 'sep'],
        ['HISTORY', null, 'group'],
        ['history', 'View conversation history with timestamps', ''],
        ['clearhistory', 'Wipe conversation history', ''],
        ['/compact', 'Summarize & compress history (saves tokens)', ''],
        ['/redo', 'Re-send your last message', ''],
        ['', '', 'sep'],
        ['FILES', null, 'group'],
        ['selectfile', 'Load a file into AI context', ''],
        ['clearfile', 'Remove the loaded file context', ''],
        ['copy', 'Copy last AI response to clipboard', ''],
        ['export', 'Save conversation as Markdown file', ''],
        ['', '', 'sep'],
        ['MODELS', null, 'group'],
        ['models', 'List all installed Ollama models', ''],
        ['use <model>', 'Switch active model', ''],
        ['', '', 'sep'],
        ['SESSION', null, 'group'],
        ['status', 'Show model, token count, session info', ''],
        ['/forget', 'Wipe all persistent brain memory', ''],
        ['help / ?', 'Show this panel', ''],
        ['exit / q', 'Quit CLAI', ''],
    ];

    const boxW = Math.min(w, 70);
    const inner = boxW - 4;
    const lines = sections.map(([cmd, desc, type]) => {
        if (type === 'group') return `${C.g4}${BOLD}  ${cmd}${RESET}`;
        if (type === 'sep') return `${C.dim}  ${'·'.repeat(inner - 4)}${RESET}`;
        return `  ${C.g1}${BOLD}${cmd.padEnd(18)}${RESET}${C.silver}${desc}${RESET}`;
    });

    console.log('\n' + drawBox(
        lines,
        { title: '  CLAI COMMANDS  ', titleColor: C.g1, color: C.dim, width: boxW, padding: 1 }
    ) + '\n');
}
exports.drawHelp = drawHelp;

// ── Boot sequence ────────────────────────────────────────────────────────────
async function boot(model, meta = '') {
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');
    await sleep(200);

    // Initial "CRT Flicker"
    for (let j = 0; j < 5; j++) {
        process.stdout.write('\x1b[48;5;232m' + ' '.repeat(width() * 5) + RESET + '\r');
        await sleep(40);
        process.stdout.write('\r\x1b[K');
        await sleep(20);
    }

    const w = width();
    console.log('\n');
    await animateBanner();
    console.log('');
    printSubtitle(model);

    if (meta) {
        console.log('');
        const pad = Math.max(0, Math.floor((w - meta.length) / 2));
        console.log(`${' '.repeat(pad)}${C.gray}${meta}${RESET}`);
    }

    console.log('');

    // ASCII Divider
    console.log(`${C.dim}${repeat('=', w)}${RESET}`);

    console.log(`${C.dim}${repeat('=', w)}${RESET}`);

    // Animated system-check lines
    const os = require('os');
    const cpu = os.cpus()[0].model.split(' ')[0];
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(0);

    const checks = [
        [`${C.cyan}  ENGINE   ${C.dim}▗${RESET}`, `${C.green} STABLE${RESET}`, ` v2.5.0-opt`],
        [`${C.cyan}  HYPER    ${C.dim}▗${RESET}`, `${C.green} ACTIVE${RESET}`, ` ${cpu}`],
        [`${C.cyan}  MEMORY   ${C.dim}▗${RESET}`, `${C.green} CACHED${RESET}`, ` ${ram}GB ADDR`],
        [`${C.cyan}  NEURAL   ${C.dim}▗${RESET}`, `${C.green} SYNCED${RESET}`, ` ${model.toUpperCase()}`],
    ];

    for (const [label, status, meta] of checks) {
        process.stdout.write('  ' + label);
        await sleep(150);
        process.stdout.write(status + C.dim + meta + RESET + '\n');
        await sleep(50);
    }

    console.log(`${C.dim}${repeat('=', w)}${RESET}`);
    await sleep(200);

    process.stdout.write('\x1b[?25h'); // restore cursor
}
exports.boot = boot;
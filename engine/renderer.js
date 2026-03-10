// ╔══════════════════════════════════════════════╗
// ║          CLAI  ·  RESPONSE RENDERER          ║
// ╚══════════════════════════════════════════════╝
'use strict';

const { C, drawBox, visLen, divider } = require('./animator');
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const ITAL = '\x1b[3m';
const fg = n => `\x1b[38;5;${n}m`;
const bg = n => `\x1b[48;5;${n}m`;

const EXT_MAP = {
    // JavaScript / TypeScript
    js: { icon: '[JS]', color: 81 }, ts: { icon: '[TS]', color: 81 },
    py: { icon: '[PY]', color: 220 }, html: { icon: '[HTM]', color: 202 },
    css: { icon: '[CSS]', color: 141 }, json: { icon: '[JSO]', color: 214 },
    md: { icon: '[DOC]', color: 252 }, sh: { icon: '[SH]', color: 85 },
    ps1: { icon: '[PS]', color: 81 }, exe: { icon: '[EXE]', color: 203 },
    zip: { icon: '[ZIP]', color: 244 },
};

function fileTag(filename) {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const info = EXT_MAP[ext] || { icon: '[FILE]', color: 252 };
    const col = fg(info.color);
    const bgCol = bg(236); // very dark bg for pill
    return `${bgCol}${col}${BOLD} ${info.icon} ${filename} ${RESET}`;
}
exports.fileTag = fileTag;

// ── URL tag ───────────────────────────────────────────────────────────────────
function urlTag(url) {
    const shortUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${bg(17)}${fg(81)}${BOLD} @ ${shortUrl} ${RESET}`;
}

// ── Shell command tag ─────────────────────────────────────────────────────────
function cmdTag(cmd) {
    return `${bg(234)}${fg(85)}${BOLD} $ ${RESET}${bg(234)}${fg(150)} ${cmd} ${RESET}`;
}

// ── Callout box detector ───────────────────────────────────────────────────────
// Matches lines like: > [!NOTE], > [!TIP], > [!WARNING], > [!CAUTION]
const CALLOUT_RE = /^>\s*\[!(NOTE|TIP|WARNING|CAUTION|INFO|IMPORTANT)\]([\s\S]*?)(?=\n(?!>)|$)/gim;
const CALLOUT_STYLES = {
    NOTE: { icon: 'NOTE', color: 75, border: 75 },
    INFO: { icon: 'INFO', color: 81, border: 81 },
    TIP: { icon: 'TIP', color: 85, border: 85 },
    IMPORTANT: { icon: 'IMPORTANT', color: 141, border: 141 },
    WARNING: { icon: 'WARNING', color: 220, border: 220 },
    CAUTION: { icon: 'CAUTION', color: 203, border: 203 },
};

function renderCallout(type, body) {
    const style = CALLOUT_STYLES[type.toUpperCase()] || CALLOUT_STYLES.NOTE;
    const w = Math.min(process.stdout.columns || 80, 80);
    const inner = w - 4;
    const lines = body.trim().split('\n').map(l => l.replace(/^>\s?/, '').trim()).filter(Boolean);
    const header = ` ${style.icon} `;
    const fillW = inner - header.length;

    let out = `\n  ${fg(style.border)}╭─${BOLD}${header}${RESET}${fg(style.border)}${'─'.repeat(fillW)}╮${RESET}\n`;
    for (const ln of lines) {
        const content = renderInline(ln);
        const padded = ln.padEnd(inner - 2);
        out += `  ${fg(style.border)}│${RESET} ${fg(style.color)}${content}${RESET}\n`;
    }
    out += `  ${fg(style.border)}╰${'─'.repeat(inner + 1)}╯${RESET}\n`;
    return out;
}

// ── Code block syntax highlighter ─────────────────────────────────────────────
const LANG_KEYWORDS = {
    js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'import', 'export', 'default', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'this', 'null', 'undefined', 'true', 'false', 'switch', 'case', 'break', 'continue', 'of', 'in', 'from', 'require', 'module', 'exports', 'Promise', 'console', 'process'],
    python: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'class', 'import', 'from', 'as', 'with', 'try', 'except', 'raise', 'lambda', 'None', 'True', 'False', 'in', 'not', 'and', 'or', 'pass', 'break', 'continue', 'global', 'yield', 'async', 'await', 'print', 'len', 'range', 'self'],
    bash: ['echo', 'cd', 'ls', 'cat', 'grep', 'sed', 'awk', 'if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'function', 'return', 'export', 'source', 'alias', 'mkdir', 'rm', 'mv', 'cp', 'chmod', 'sudo', 'curl', 'wget'],
    default: ['if', 'else', 'for', 'while', 'return', 'class', 'function', 'import', 'export', 'const', 'let', 'var', 'true', 'false', 'null'],
};

function highlightCode(code, lang = 'default') {
    const keywords = new Set(LANG_KEYWORDS[lang] || LANG_KEYWORDS.default);
    let out = '';
    let i = 0;
    const src = code;

    while (i < src.length) {
        // Single-line comment
        if ((src[i] === '/' && src[i + 1] === '/') ||
            ((lang === 'python' || lang === 'bash') && src[i] === '#')) {
            const end = src.indexOf('\n', i);
            const slice = end === -1 ? src.slice(i) : src.slice(i, end);
            out += `${fg(244)}${DIM}${slice}${RESET}`;
            i += slice.length;
            continue;
        }
        // Multi-line comment /* */
        if (src[i] === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            const slice = end === -1 ? src.slice(i) : src.slice(i, end + 2);
            out += `${fg(244)}${DIM}${slice}${RESET}`;
            i += slice.length;
            continue;
        }
        // String (single, double, backtick)
        if (src[i] === '"' || src[i] === "'" || src[i] === '`') {
            const q = src[i]; let j = i + 1;
            while (j < src.length && !(src[j] === q && src[j - 1] !== '\\')) j++;
            out += `${fg(150)}${src.slice(i, j + 1)}${RESET}`;
            i = j + 1;
            continue;
        }
        // Number
        if (/[0-9]/.test(src[i]) && (i === 0 || !/\w/.test(src[i - 1]))) {
            let j = i;
            while (j < src.length && /[\d._xXa-fA-F]/.test(src[j])) j++;
            out += `${fg(215)}${src.slice(i, j)}${RESET}`;
            i = j;
            continue;
        }
        // Word
        if (/[a-zA-Z_$]/.test(src[i])) {
            let j = i;
            while (j < src.length && /\w/.test(src[j])) j++;
            const word = src.slice(i, j);
            if (keywords.has(word)) out += `${fg(141)}${BOLD}${word}${RESET}`;
            else if (/^[A-Z]/.test(word)) out += `${fg(81)}${word}${RESET}`;
            else out += `${fg(252)}${word}${RESET}`;
            i = j;
            continue;
        }
        // Punctuation
        if (/[{}[\]()=+\-*/<>!&|;,.]/.test(src[i])) {
            out += `${fg(213)}${src[i]}${RESET}`;
            i++;
            continue;
        }
        out += src[i++];
    }
    return out;
}

function mapLang(fence) {
    const f = (fence || '').toLowerCase().trim();
    if (['js', 'javascript', 'ts', 'typescript', 'node'].includes(f)) return 'js';
    if (['py', 'python'].includes(f)) return 'python';
    if (['sh', 'bash', 'shell', 'zsh'].includes(f)) return 'bash';
    return 'default';
}

// ── Render a code block ────────────────────────────────────────────────────────
function renderCodeBlock(code, lang) {
    const termW = Math.min(process.stdout.columns || 80, 100);
    const langLabel = lang && lang !== 'default' ? lang : 'code';
    const label = ` ${langLabel} `;
    const inner = termW - 4;

    const lf = Math.floor((inner - label.length) / 2);
    const rf = inner - label.length - lf;

    const hdr = `  ${fg(237)}${bg(237)}${'─'.repeat(lf)}${RESET}${bg(237)}${fg(220)}${BOLD}${label}${RESET}${bg(237)}${fg(237)}${'─'.repeat(rf)}${RESET}`;
    const ftr = `  ${fg(237)}${'─'.repeat(inner)}${RESET}`;

    // Line numbers
    const lines = code.split('\n');
    const lineNumW = String(lines.length).length;

    let out = '\n' + hdr + '\n';
    lines.forEach((ln, idx) => {
        const lineNum = `${fg(240)}${String(idx + 1).padStart(lineNumW, ' ')}${RESET}`;
        const highlighted = mapLang(lang) !== 'default'
            ? highlightCode(ln, mapLang(lang))
            : `${fg(252)}${ln}${RESET}`;
        out += `  ${fg(238)}│${RESET} ${lineNum} ${fg(238)}│${RESET} ${highlighted}\n`;
    });
    out += ftr;
    return out;
}

/** Remove all procedural/functional tags from the response for a clean look. */
function stripProceduralTags(text) {
    return text
        // Block tags
        .replace(/\[WRITE:.*?\][\s\S]*?\[\/WRITE\]/gi, '')
        .replace(/\[DRAW\][\s\S]*?\[\/DRAW\]/gi, '')
        .replace(/\[MENU:.*?\][\s\S]*?\[\/MENU\]/gi, '')
        // Single tags
        .replace(/\[ASCII:.*?\]/gi, '')
        .replace(/\[VFX:.*?\]/gi, '')
        .replace(/\[THEME:.*?\]/gi, '')
        .replace(/\[MOOD:.*?\]/gi, '')
        .replace(/\[REMEMBER:.*?\]/gi, '')
        .replace(/\[READ:.*?\]/gi, '')
        .replace(/\[CLOCK\]/gi, '')
        .replace(/\[SYSINFO\]/gi, '')
        .replace(/\[TIME\]/gi, '')
        .trim();
}
exports.stripProceduralTags = stripProceduralTags;

// ── Inline element renderer ────────────────────────────────────────────────────
// FILE_RE: matches filenames like  foo.js  /path/to/foo.js  ./foo/bar.json
// but NOT things inside backticks (handled separately).
const FILE_EXTS = Object.keys(EXT_MAP).join('|');
const FILE_RE = new RegExp(
    `(?<!['\`\\w])([\\w.\\-/\\\\]+\\.(?:${FILE_EXTS}))(?![\\w])`,
    'gi'
);
const URL_RE = /https?:\/\/[^\s)\]'"]+/g;
const CMD_RE = /(?:^|\s)((?:npm|npx|node|git|python|pip|cargo|go|docker|kubectl|yarn|pnpm)\s[^\n`]+)/gm;

function renderInline(text) {
    // 1. Inline code `…` — do first so file/url regexes don't match inside
    const CODE_PLACEHOLDER = '\x00CODE\x00';
    const codeParts = [];
    let processed = text.replace(/`([^`\n]+)`/g, (_, inner) => {
        codeParts.push(`${bg(236)}${fg(220)} ${inner} ${RESET}`);
        return CODE_PLACEHOLDER + (codeParts.length - 1) + '\x00';
    });

    // 2. URLs → URL tags
    processed = processed.replace(URL_RE, m => urlTag(m));

    // 3. File mentions → file tags
    processed = processed.replace(FILE_RE, (_, fname) => fileTag(fname));

    // 4. Restore inline code
    processed = processed.replace(new RegExp(`${CODE_PLACEHOLDER}(\\d+)\x00`, 'g'),
        (_, i) => codeParts[parseInt(i)]);

    return processed;
}

// ── Render plain text (markdown-lite) ─────────────────────────────────────────
function renderPlainText(text) {
    // Callout blocks first (multi-line)
    text = text.replace(CALLOUT_RE, (_, type, body) => renderCallout(type, body));

    // Line-by-line transformations
    const lines = text.split('\n');
    const out = lines.map(line => {
        // H1/H2/H3 headings
        const h3 = line.match(/^### (.+)/);
        const h2 = line.match(/^## (.+)/);
        const h1 = line.match(/^# (.+)/);
        if (h1) return `\n${fg(141)}${BOLD}  ${h1[1].toUpperCase()}${RESET}\n  ${fg(238)}${'─'.repeat(Math.min(h1[1].length + 2, 60))}${RESET}`;
        if (h2) return `\n${fg(135)}${BOLD}  ${h2[1]}${RESET}`;
        if (h3) return `\n${fg(99)}${BOLD}  ${h3[1]}${RESET}`;

        // Horizontal rule ---
        if (/^[-─]{3,}$/.test(line.trim())) {
            return `${fg(238)}${'─'.repeat(Math.min(process.stdout.columns || 80, 100))}${RESET}`;
        }

        // Bullet  - or *
        const bullet = line.match(/^(\s*)[-*] (.+)/);
        if (bullet) {
            const indent = bullet[1].length;
            const icons = ['•', '◦', '▹'];
            const icon = icons[Math.min(Math.floor(indent / 2), 2)];
            const iconColor = [213, 141, 99][Math.min(Math.floor(indent / 2), 2)];
            return `${bullet[1]}  ${fg(iconColor)}${icon}${RESET} ${renderInline(bullet[2])}`;
        }

        // Numbered list  1. 
        const numbered = line.match(/^(\s*)(\d+)\. (.+)/);
        if (numbered) {
            return `${numbered[1]}  ${fg(81)}${BOLD}${numbered[2]}.${RESET} ${renderInline(numbered[3])}`;
        }

        // **bold** and *italic*
        let l = line
            .replace(/\*\*(.*?)\*\*/g, `${BOLD}$1${RESET}`)
            .replace(/\*(.*?)\*/g, `${ITAL}${fg(252)}$1${RESET}`);

        // Inline elements (files, URLs, code)
        return renderInline(l);
    });

    return out.join('\n');
}

// ── Parse full AI response ─────────────────────────────────────────────────────
function renderResponse(text) {
    // 0. Strip procedural tags for the clean UX
    const cleanText = stripProceduralTags(text);

    const codeBlockRe = /```(\w*)\n?([\s\S]*?)(?:```|$)/g;
    let last = 0;
    let out = '';
    let match;

    while ((match = codeBlockRe.exec(cleanText)) !== null) {
        const plain = cleanText.slice(last, match.index);
        if (plain) out += renderPlainText(plain);
        out += renderCodeBlock(match[2].trimEnd(), match[1] || 'default');
        last = match.index + match[0].length;
    }
    const tail = cleanText.slice(last);
    if (tail) out += renderPlainText(tail);
    return out;
}
exports.renderResponse = renderResponse;

// ── Response header ────────────────────────────────────────────────────────────
function printResponseHeader() {
    const w = Math.min(process.stdout.columns || 80, 100);
    const tag = `${BOLD} ✦ CLAI `;
    const vis = ' ✦ CLAI ';
    const fill = w - vis.length - 1;
    console.log(`\n${fg(141)}${tag}${RESET}${fg(238)}${'─'.repeat(fill)}${RESET}`);
}
exports.printResponseHeader = printResponseHeader;

// ── User message bubble ────────────────────────────────────────────────────────
function printUserBubble(text) {
    const w = Math.min(process.stdout.columns || 80, 100);
    const tag = ` YOU `;
    const fill = w - tag.length - 1;
    console.log(`\n${fg(238)}${'─'.repeat(w)}${RESET}`);
    console.log(`${bg(24)}${fg(231)}${BOLD}${tag}${RESET} ${fg(252)}${text}${RESET}`);
}
exports.printUserBubble = printUserBubble;

// ── History viewer ─────────────────────────────────────────────────────────────
function renderHistory(messages) {
    if (!messages || messages.length === 0) {
        console.log(`\n  ${fg(238)}No conversation history yet. Start chatting!${RESET}\n`);
        return;
    }
    const w = Math.min(process.stdout.columns || 80, 100);
    const pairs = Math.ceil(messages.length / 2);
    console.log(`\n${fg(141)}${BOLD}  CONVERSATION HISTORY${RESET}  ${fg(238)}${pairs} exchange${pairs !== 1 ? 's' : ''} · ${messages.length} messages${RESET}`);
    console.log(`${fg(238)}${'─'.repeat(w)}${RESET}`);

    messages.forEach((m, i) => {
        const isUser = m.role === 'user';
        const roleTag = isUser
            ? `${bg(24)}${fg(231)}${BOLD} YOU  ${RESET}`
            : `${bg(54)}${fg(213)}${BOLD} CLAI ${RESET}`;
        const num = `${fg(238)}[${String(i + 1).padStart(2, '0')}]${RESET}`;

        // Add timestamp if available
        const time = m.ts ? `${fg(240)} ${new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${RESET}` : '';

        const preview = m.content.replace(/\n/g, ' ').replace(/`/g, '').slice(0, 80);
        const ellipsis = m.content.length > 80 ? `${fg(238)}…${RESET}` : '';
        console.log(`  ${num} ${roleTag}${time} ${fg(252)}${preview}${ellipsis}${RESET}`);
    });
    console.log(`${fg(238)}${'─'.repeat(w)}${RESET}\n`);
}
exports.renderHistory = renderHistory;

// ── Models table ───────────────────────────────────────────────────────────────
function renderModels(models, activeModel) {
    if (!models || models.length === 0) {
        console.log(`\n  ${fg(203)}  No models found. Run: ollama pull <model>${RESET}\n`);
        return;
    }
    const w = Math.min(process.stdout.columns || 80, 100);
    console.log(`\n${fg(141)}${BOLD}  INSTALLED MODELS${RESET}  ${fg(238)}${models.length} total${RESET}`);
    console.log(`${fg(238)}${'─'.repeat(w)}${RESET}`);
    models.forEach((m, i) => {
        const active = m === activeModel;
        const tick = active ? `${fg(85)}${BOLD} * ${RESET}` : `${fg(238)}   `;
        const name = active ? `${fg(85)}${BOLD}${m}${RESET}` : `${fg(252)}${m}${RESET}`;
        const badge = active ? ` ${bg(22)}${fg(85)} ACTIVE ${RESET}` : '';
        const num = `${fg(238)}[${i + 1}]${RESET}`;
        console.log(`${tick}${num} ${name}${badge}`);
    });
    console.log(`${fg(238)}${'─'.repeat(w)}${RESET}\n`);
}
exports.renderModels = renderModels;

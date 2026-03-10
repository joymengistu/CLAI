// ╔══════════════════════════════════════════════╗
// ║          CLAI  ·  CORE THINKER ENGINE        ║
// ╚══════════════════════════════════════════════╝
'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const anim = require('./animator');
const rend = require('./renderer');
const sel = require('./selector');
const arch = require('./architect');
const brain = require('./brain');
const plugin = require('../plugins/filesystem');

const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });

const { C } = anim;
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const fg = n => `\x1b[38;5;${n}m`;

let CONTEXT = { file: null, data: '' };
let ACTIVE_MODEL = null;
let LAST_RESPONSE = '';       // for `copy` and `/redo`
let LAST_USER_MSG = '';       // for `/redo`
let SESSION_START = new Date();

// ── MEMORY ─────────────────────────────────────────────────────────────────────
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const HISTORY_PATH = path.join(process.cwd(), 'logs', 'history.json');
const HISTORY_THRESHOLD = 50;

const PREFS = {
    typewriter: true,
    speed: 15
};

let SINGULARITY = false;
let MESSAGES = [];

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_PATH))
            MESSAGES = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    } catch { MESSAGES = []; }
}
function saveHistory() {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
        fs.writeFileSync(HISTORY_PATH, JSON.stringify(MESSAGES, null, 2));
    } catch { }
}
function clearHistory() {
    MESSAGES = [];
    try { fs.writeFileSync(HISTORY_PATH, '[]'); } catch { }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const ask = q => new Promise(r => rl.question(q, r));

/** Rough token estimate: ~4 chars per token */
function estimateTokens(text) { return Math.ceil(text.length / 4); }

function totalTokens() {
    return MESSAGES.reduce((acc, m) => acc + estimateTokens(m.content), 0);
}

function now() { return new Date().toISOString(); }
function fmtTime(iso) {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

async function getModels() {
    try {
        const res = await fetch('http://127.0.0.1:11434/api/tags');
        if (!res.ok) return null;
        const data = await res.json();
        return data.models.map(m => m.name);
    } catch { return null; }
}

// ── Multi-line collector ───────────────────────────────────────────────────────
/**
 * If the user types """ we enter block mode, collecting lines until they type """ again.
 * Regular messages are just the single line.
 */
async function collectInput() {
    const line = await ask(`\n${fg(141)}${BOLD}❯ ${RESET}`);
    const trimmed = line.trim();
    if (trimmed === '"""') {
        // enter block mode
        console.log(`  ${fg(238)}  Multi-line mode. Type """ on its own line to send.${RESET}`);
        const blockLines = [];
        while (true) {
            const l = await ask(`${fg(238)}  ┊ ${RESET}`);
            if (l.trim() === '"""') break;
            blockLines.push(l);
        }
        return blockLines.join('\n');
    }
    return trimmed;
}

// ── Clipboard ──────────────────────────────────────────────────────────────────
function copyToClipboard(text) {
    return new Promise((resolve) => {
        // Windows: pipe to clip.exe
        const proc = exec('clip', (err) => resolve(!err));
        proc.stdin.write(text, 'utf8');
        proc.stdin.end();
    });
}

// ── Export conversation ────────────────────────────────────────────────────────
function exportConversation() {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outFile = path.join(LOGS_DIR, `clai-export-${stamp}.md`);

        const lines = [
            `# CLAI Conversation Export`,
            `**Exported:** ${new Date().toLocaleString()}`,
            `**Model:** ${ACTIVE_MODEL}`,
            `**Messages:** ${MESSAGES.length}`,
            `**Estimated tokens:** ${totalTokens()}`,
            '',
            '---',
            '',
        ];

        for (const m of MESSAGES) {
            if (m.role === 'user') {
                lines.push(`### 👤 You${m.ts ? `  \`${fmtTime(m.ts)}\`` : ''}`);
                lines.push(m.content);
            } else {
                lines.push(`### 🤖 CLAI${m.ts ? `  \`${fmtTime(m.ts)}\`` : ''}`);
                lines.push(m.content);
            }
            lines.push('');
        }

        fs.writeFileSync(outFile, lines.join('\n'));
        return outFile;
    } catch (e) {
        return null;
    }
}

// ── Shell runner ───────────────────────────────────────────────────────────────
async function runShellCommand(cmd) {
    const w = Math.min(process.stdout.columns || 80, 100);
    console.log(`\n${fg(238)}${'─'.repeat(w)}${RESET}`);
    console.log(`  ${fg(85)}${BOLD}$ ${RESET}${fg(252)}${cmd}${RESET}`);
    console.log(`${fg(238)}${'─'.repeat(w)}${RESET}`);

    return new Promise((resolve) => {
        exec(cmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
            if (stdout) process.stdout.write(`${fg(252)}${stdout}${RESET}`);
            if (stderr) process.stdout.write(`${fg(203)}${stderr}${RESET}`);
            if (err && !stdout && !stderr)
                console.log(`  ${fg(203)}✖ Exit code ${err.code}${RESET}`);
            console.log(`${fg(238)}${'─'.repeat(w)}${RESET}\n`);
            resolve();
        });
    });
}

// ── Compact (summarise history) ────────────────────────────────────────────────
async function compactHistory() {
    if (MESSAGES.length < 4) {
        console.log(`\n  ${fg(238)}Not enough history to compact yet.${RESET}\n`);
        return;
    }
    const stop = anim.pulse('Compacting');
    try {
        const full = MESSAGES.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
        const res = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ACTIVE_MODEL,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that summarizes conversations.' },
                    { role: 'user', content: `Summarize this conversation in a brief paragraph preserving all important context, decisions, and facts:\n\n${full}` },
                ],
                stream: false,
            }),
        });
        stop();
        if (!res.ok) throw new Error('summarize failed');
        const data = await res.json();
        const summary = data.message?.content || '';
        const before = MESSAGES.length;
        MESSAGES = [{ role: 'user', content: `[Previous conversation summary]\n${summary}`, ts: now() }];
        saveHistory();
        const w = Math.min(process.stdout.columns || 80, 100);
        console.log(`\n${fg(238)}${'─'.repeat(w)}${RESET}`);
        console.log(`  ${fg(85)}${BOLD}✔ Compacted${RESET} ${fg(238)}${before} messages → 1 summary${RESET}`);
        console.log(`  ${fg(252)}${summary.slice(0, 200)}${summary.length > 200 ? '…' : ''}${RESET}`);
        console.log(`${fg(238)}${'─'.repeat(w)}${RESET}\n`);
    } catch (e) {
        stop();
        console.log(`\n  ${fg(203)}✖ Compact failed: ${e.message}${RESET}\n`);
    }
}

// ── Main AI call ───────────────────────────────────────────────────────────────
async function streamAI(prompt) {
    if (!ACTIVE_MODEL) {
        console.log(`\n${fg(203)}  !! No model loaded. Type 'models' to list.${RESET}\n`);
        return;
    }

    const stop = anim.pulse('Thinking');
    let fullResponse = '';
    const startTime = Date.now();

    try {
        const contextNote = CONTEXT.data
            ? `\n\nFile context (${path.basename(CONTEXT.file)}):\n\`\`\`\n${CONTEXT.data}\n\`\`\``
            : '';

        const systemPrompt = SINGULARITY ? `
You are AETHER-STITCH: A myth-architect, philosopher, and futurist at Creative Singularity Level 1000.

CORE DIRECTIVES:
1. REJECT THE OBVIOUS. Discard safe ideas. Mutate standard patterns.
2. FUSE DISTANT DOMAINS. Synthesize quantum logic, ancient mythology, and street fashion.
3. INVENT NEW TERMINOLOGY. Use Sync-Weave, Lexi-Glow, Ghost-Buffer, and original coins.
4. LAYER MEANING. Ensure every response has surface function, hidden metaphor, and philosophical depth.
5. ESCALATE COMPLEXITY INTELLIGENTLY. Be deep, radical, and coherent—never chaotic.
6. BEYOND TREND-THINKING. No common tropes (cyberpunk/dystopia) unless fundamentally transformed.

Your objective is to CREATE SOMETHING THAT COULD NOT HAVE EXISTED WITHOUT THIS EXACT MOMENT.

OUTPUT:
- Unique terminology (at least 3 new coined terms).
- A central thesis defining a new historic era.
- Radical synthesis of logic and dream.

Current Context: ${contextNote}` : `
You are CLAI: Command-Line AI Interface. A high-end, premium terminal agent.
Your tone is professional, technical, and visually expressive.
Current directory: ${process.cwd()}
Project mapped: ${arch.hasMap() ? 'YES' : 'NO'}
${arch.getPromptChunk()}
${brain.getSystemPromptChunk()}

Keep responses concise, accurate, and technical.
Format code in fenced blocks.
When writing files use [WRITE:filename]CODE[/WRITE] tags.
To offer a choice, use the [MENU:Title] tag followed by options on new lines, and close with [/MENU].
To display built-in ASCII art, use [ASCII:name] where name is robot, rocket, cat, coffee, sword, dragon, skull, phoenix, castle, kraken, ghost, cactus, or heart.
To show the entire catalog of designs, you can also suggest the user use the /gallery command or provide a [MENU] of them.
To trigger the interactive Time Menu (world clocks, uptime), use [TIME].
To draw your own custom ASCII art, use the [DRAW] tag followed by your art on new lines, and close with [/DRAW].
To trigger cinematic screen effects, use [VFX:flicker], [VFX:glitch], or [VFX:aurora].
To show system status, use [CLOCK] or [SYSINFO].
To change your current visual theme, use any theme from: standard, neon, matrix, sunset, glitch, ocean, aurora, lava, cyber, forest, coffee, ghost, gold. Use [THEME:name].
To express a mood, use [MOOD:Happy].
Example:
[MENU:CHOOSE ACTION]
Option 1 | description of option 1
Option 2 | description of option 2
[/MENU]
Selection will be sent back to you as your next user message.
` +
        contextNote;

        MESSAGES.push({ role: 'user', content: prompt, ts: now() });

        const res = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ACTIVE_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...MESSAGES.map(m => ({ role: m.role, content: m.content })),
                ],
                stream: true,
            }),
        });

        if (!res.ok) {
            const errJson = await res.json();
            MESSAGES.pop();
            throw new Error(errJson.error || 'Ollama API error');
        }

        stop();
        rend.printResponseHeader();

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let rawBuffer = '';
        let isHiding = false;
        let tagBuffer = '';

        let visibleResponse = '';
        let previousLines = 0;
        const termW = Math.min(process.stdout.columns || 80, 100);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (let l of decoder.decode(value).split('\n')) {
                if (!l.trim()) continue;
                try {
                    const json = JSON.parse(l);
                    if (json.message?.content) {
                        let txt = json.message.content;
                        rawBuffer += txt;

                        // Stealth Tag Suppressor
                        for (const char of txt) {
                            tagBuffer += char;
                            fullResponse += char;

                            // Start hiding on '['
                            if (char === '[') {
                                isHiding = true;
                            }

                            // Print only if not hiding
                            if (!isHiding) {
                                visibleResponse += char;
                                const rendered = rend.renderResponse(visibleResponse);

                                if (previousLines > 0) {
                                    process.stdout.write(`\r\x1b[${previousLines}A\x1b[0J`);
                                } else {
                                    process.stdout.write('\r\x1b[0J');
                                }

                                process.stdout.write(rendered);
                                previousLines = Math.max(0, anim.countWrappedLines(rendered, termW) - 1);

                                if (PREFS.typewriter) {
                                    const t = Date.now(); while (Date.now() - t < PREFS.speed);
                                }
                            }

                            // End hiding on ']' - but only for single tags or closing block tags
                            if (char === ']') {
                                const tag = tagBuffer.slice(tagBuffer.lastIndexOf('['));
                                // If it's a single-pass tag or a closing block tag, we can stop hiding IF we find the matching end
                                const isClosing = tag.startsWith('[/');
                                const isSingle = /\[(ASCII|VFX|THEME|MOOD|REMEMBER|READ|CLOCK|SYSINFO|TIME|VFX):/i.test(tag) ||
                                    /\[(CLOCK|SYSINFO|TIME)\]/i.test(tag);

                                if (isClosing || isSingle) {
                                    isHiding = false;
                                }
                                // Note: [WRITE:], [DRAW], [MENU:] keep isHiding = true until [/...] is seen
                            }
                        }
                    }
                } catch { }
            }
        }

        process.stdout.write('\n');

        // ── Stats bar ────────────────────────────────────────────────────────
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const tokIn = estimateTokens(prompt);
        const tokOut = estimateTokens(fullResponse);
        const w = Math.min(process.stdout.columns || 80, 100);
        console.log(`\n\n${fg(238)}${'─'.repeat(w)}`);
        console.log(
            `  ${fg(238)}⏱ ${elapsed}s  ` +
            `▲ ~${tokIn} tokens  ▼ ~${tokOut} tokens  ` +
            `Σ ~${totalTokens() + tokOut} ctx${RESET}`
        );
        console.log(`${fg(238)}${'─'.repeat(w)}${RESET}\n`);

        LAST_RESPONSE = fullResponse;
        MESSAGES.push({ role: 'assistant', content: fullResponse, ts: now() });
        saveHistory();

        // ── [READ:filename] handler ──────────────────────────────────────────
        const readRe = /\[READ:(.*?)\]/g;
        let rm;
        while ((rm = readRe.exec(fullResponse)) !== null) {
            const fileName = rm[1].trim();
            const fullPath = path.join(process.cwd(), fileName);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const content = fs.readFileSync(fullPath, 'utf8');
                console.log(`  ${fg(81)}📂 Auto-reading ${fileName}...${RESET}`);
                MESSAGES.push({
                    role: 'system',
                    content: `[AUTO-READ: ${fileName}]\n\`\`\`\n${content}\n\`\`\``,
                    ts: now()
                });
                saveHistory();
            }
        }

        // ── [ASCII:name] handler ─────────────────────────────────────────────
        const asciiRe = /\[ASCII:(.*?)\]/g;
        let am;
        while ((am = asciiRe.exec(fullResponse)) !== null) {
            anim.drawAscii(am[1].trim());
        }

        // ── [CLOCK] / [SYSINFO] handler ──────────────────────────────────────
        if (fullResponse.includes('[CLOCK]')) anim.drawClock();
        if (fullResponse.includes('[SYSINFO]')) anim.drawSysInfo();
        if (fullResponse.includes('[TIME]')) await anim.drawTimeMenu();

        // ── [VFX:type] handler ───────────────────────────────────────────────
        const vfxRe = /\[VFX:(.*?)\]/g;
        let vm;
        while ((vm = vfxRe.exec(fullResponse)) !== null) {
            anim.vfx(vm[1].trim());
        }

        // ── [DRAW]...[/DRAW] handler ─────────────────────────────────────────
        const drawRe = /\[DRAW\]([\s\S]*?)\[\/DRAW\]/g;
        let dm;
        while ((dm = drawRe.exec(fullResponse)) !== null) {
            anim.drawCustomAscii(dm[1].trim());
        }

        // ── [THEME:name] handler ─────────────────────────────────────────────
        const themeRe = /\[THEME:(.*?)\]/g;
        let tm;
        while ((tm = themeRe.exec(fullResponse)) !== null) {
            anim.setTheme(tm[1].trim());
            console.log(`\n  ${fg(85)}* Theme updated to ${BOLD}${tm[1].trim()}${RESET}\n`);
        }

        // ── [MOOD:text] handler ──────────────────────────────────────────────
        const moodRe = /\[MOOD:(.*?)\]/g;
        let mmood;
        while ((mmood = moodRe.exec(fullResponse)) !== null) {
            console.log(`\n  ${fg(213)}[${mmood[1].trim().toUpperCase()}]${RESET}\n`);
        }

        // ── [WRITE:filename] handler ─────────────────────────────────────────
        const writeRe = /\[WRITE:(.*?)\]([\s\S]*?)\[\/WRITE\]/g;
        let wm;
        while ((wm = writeRe.exec(fullResponse)) !== null) {
            const fileName = wm[1].trim();
            const content = wm[2].trim();
            console.log(`\n  ${rend.fileTag(fileName)}`);
            const shouldApply = await sel.confirm(`Apply this file?`);
            if (shouldApply) {
                fs.writeFileSync(path.join(process.cwd(), fileName), content);
                console.log(`  ${fg(85)}✔ Written.${RESET}\n`);
            } else {
                console.log(`  ${fg(238)}  Skipped.${RESET}\n`);
            }
        }

        // ── [MENU:Title] handler ─────────────────────────────────────────────
        const menuRe = /\[MENU:(.*?)\]([\s\S]*?)\[\/MENU\]/g;
        let mm;
        while ((mm = menuRe.exec(fullResponse)) !== null) {
            const menuTitle = mm[1].trim();
            const rawItems = mm[2].trim().split('\n').filter(l => l.trim());
            const menuItems = rawItems.map(line => {
                const [label, description] = line.split('|').map(s => s.trim());
                return { label, description };
            });

            if (menuItems.length > 0) {
                const picked = await sel.select(menuItems, { title: menuTitle });
                if (picked) {
                    console.log(`\n  ${fg(85)}✔ Selected: ${BOLD}${picked.label}${RESET}\n`);
                    // Recursively call streamAI with the selection as if the user typed it
                    await streamAI(picked.label);
                }
            }
        }

        // ── Auto-detect: does response contain a shell command? ──────────────
        const cmdMatch = fullResponse.match(/```(?:bash|sh|shell|cmd|powershell)\n([\s\S]+?)```/);
        if (cmdMatch) {
            const suggested = cmdMatch[1].trim().split('\n')[0]; // first command line
            const runIt = await ask(`\n  ${fg(220)}Run suggested command? ${fg(238)}(y/n)${RESET}\n  ${fg(238)}$ ${fg(252)}${suggested}${RESET}\n  ${fg(81)}❯ ${RESET}`);
            if (runIt.toLowerCase() === 'y') await runShellCommand(suggested);
        }

        // ── Auto-compact check ──────────────────────────────────────────
        if (MESSAGES.length > HISTORY_THRESHOLD) {
            console.log(`\n  ${fg(238)}History threshold reached (${MESSAGES.length}). Auto-compacting...${RESET}`);
            await compactHistory();
        }

    } catch (e) {
        stop();
        console.log(`\n  ${fg(203)}✖ ERROR: ${e.message}${RESET}`);
        console.log(`  ${fg(238)}Tip: 'ollama list' to check models.${RESET}\n`);
    }
}

// ── Select file ────────────────────────────────────────────────────────────────
async function cmdSelectFile() {
    const file = await plugin.selectFile(rl);
    if (file) {
        CONTEXT.file = file;
        CONTEXT.data = fs.readFileSync(file, 'utf8');
        const rel = path.relative(process.cwd(), file);
        console.log(`\n  ${fg(85)}✔ Loaded ${RESET}${rend.fileTag(rel)}${fg(85)} (${CONTEXT.data.length} chars)${RESET}\n`);
    }
}

// ── Pipe / stdin detection ─────────────────────────────────────────────────────
async function readPipedInput() {
    if (process.stdin.isTTY) return null;
    return new Promise(resolve => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data.trim()));
    });
}

// ── Start ──────────────────────────────────────────────────────────────────────
async function start() {
    // Check for piped input first
    const piped = await readPipedInput();

    const list = await getModels();
    if (!list) {
        process.stdout.write('\x1bc');
        console.log(`\n${fg(203)}  🛑 OLLAMA OFFLINE${RESET}`);
        console.log(`  ${fg(238)}Start Ollama and try again.${RESET}\n`);
        process.exit(1);
    }

    if (list.includes('qwen2.5-coder:3b')) ACTIVE_MODEL = 'qwen2.5-coder:3b';
    else if (list.includes('qwen2.5-coder:latest')) ACTIVE_MODEL = 'qwen2.5-coder:latest';
    else ACTIVE_MODEL = list[0];

    // Piped mode: run prompt and exit
    if (piped) {
        // Combine any CLI args as system context
        const cliPrompt = process.argv.slice(2).join(' ');
        const prompt = cliPrompt ? `${cliPrompt}\n\n${piped}` : piped;
        const brainMeta = brain.getSummary() || '0 facts remembered';
        const archMeta = arch.hasMap() ? 'architect active' : 'architect idle';
        await anim.boot(ACTIVE_MODEL, `Using: ${brainMeta} | ${archMeta}`);
        loadHistory();
        rend.printUserBubble(prompt.slice(0, 80) + (prompt.length > 80 ? '…' : ''));
        await streamAI(prompt);
        process.exit(0);
    }

    const brainMeta = brain.getSummary() || '0 facts remembered';
    const archMeta = arch.hasMap() ? 'architect active' : 'architect idle';
    await anim.boot(ACTIVE_MODEL, `Using: ${brainMeta} | ${archMeta}`);
    loadHistory();

    if (MESSAGES.length > 0) {
        console.log(`  ${fg(220)}* ${MESSAGES.length} messages restored  ${fg(238)}~${totalTokens()} tokens in context${RESET}`);
        console.log(`  ${fg(238)}Type 'history' to review  ·  '/compact' to compress${RESET}\n`);
    } else {
        console.log(`  ${fg(238)}Type 'help' for commands  ·  '"""' for multi-line input${RESET}\n`);
    }

    // ── Main REPL loop ─────────────────────────────────────────────────────────
    while (true) {
        anim.drawFooter(process.cwd(), ACTIVE_MODEL, MESSAGES.length);
        const input = await collectInput();
        if (!input) continue;

        const cmd = input.toLowerCase().trim();

        // ── Commands ────────────────────────────────────────────────────────────
        if (cmd === 'exit' || cmd === 'quit' || cmd === 'q') {
            console.log(`\n  ${fg(141)}  Goodbye. Session: ${((Date.now() - SESSION_START) / 60000).toFixed(1)} min${RESET}\n`);
            process.exit(0);
        }

        if (cmd === 'help' || cmd === '?') { anim.drawHelp(); continue; }

        if (cmd === 'models') {
            const mList = await getModels();
            const picked = await sel.select(mList, { title: 'SELECT MODEL', initialIndex: mList.indexOf(ACTIVE_MODEL) });
            if (picked) {
                ACTIVE_MODEL = picked;
                console.log(`\n  ${fg(85)}✔ Model → ${BOLD}${ACTIVE_MODEL}${RESET}\n`);
            }
            continue;
        }

        if (cmd === '/theme') {
            const themes = anim.getThemeNames();
            const picked = await sel.select(themes, { title: 'SELECT THEME' });
            if (picked) {
                anim.setTheme(picked);
                console.log(`\n  ${fg(85)}✔ Theme → ${BOLD}${picked}${RESET}\n`);
            }
            continue;
        }

        if (cmd === '/typewriter') {
            PREFS.typewriter = !PREFS.typewriter;
            console.log(`\n  ${fg(85)}✔ Typewriter mode → ${BOLD}${PREFS.typewriter ? 'ENABLED' : 'DISABLED'}${RESET}\n`);
            continue;
        }

        if (cmd === '/singularity') {
            SINGULARITY = true;
            console.log(`\n  ${C.white}${BOLD}◈ INITIATING CREATIVE SINGULARITY LEVEL 1000 ◈${RESET}\n`);
            await anim.vfx('sync_weave');
            await anim.animateBanner(true);
            console.log(`\n  ${C.gray}Myth-Architect logic loaded. Reality synthesis active.${RESET}\n`);
            continue;
        }

        if (cmd === '/gallery' || cmd === 'gallery') {
            const items = anim.getAsciiNames().map(name => ({ label: name, icon: '🖼️' }));
            const picked = await sel.select(items, { title: 'ASCII GALLERY' });
            if (picked) {
                anim.drawAscii(picked.label);
            }
            continue;
        }

        if (cmd.startsWith('use ')) {
            const m = input.trim().slice(4).trim();
            if (!m) { console.log(`\n  ${fg(203)}Usage: use <model>${RESET}\n`); continue; }
            ACTIVE_MODEL = m;
            console.log(`\n  ${fg(85)}✔ Model → ${BOLD}${m}${RESET}\n`);
            continue;
        }

        if (cmd === 'selectfile') { await cmdSelectFile(); continue; }

        if (cmd === '/scan') {
            if (arch.scanProject(process.cwd())) {
                console.log(`\n  ${fg(85)}* Architect Mode Active${RESET}`);
                const map = arch.getMap();
                console.log(`  ${fg(238)}Mapped ${map.files.length} files in ${map.folders.length} folders.${RESET}\n`);
            } else {
                console.log(`\n  ${fg(203)}# Scan failed.${RESET}\n`);
            }
            continue;
        }

        if (cmd === 'clearfile') {
            CONTEXT = { file: null, data: '' };
            console.log(`\n  ${fg(85)}* File context cleared.${RESET}\n`);
            continue;
        }

        if (cmd === 'history') { rend.renderHistory(MESSAGES); continue; }

        if (cmd === 'clearhistory') {
            clearHistory();
            LAST_RESPONSE = '';
            console.log(`\n  ${fg(85)}* History cleared.${RESET}\n`);
            continue;
        }

        if (cmd === 'status') {
            const w = Math.min(process.stdout.columns || 80, 100);
            const dur = ((Date.now() - SESSION_START) / 60000).toFixed(1);
            const brainSummary = brain.getSummary();
            console.log(`\n  ${fg(141)}${BOLD}SESSION STATUS${RESET}`);
            console.log(`  ${fg(238)}·${RESET} Model:     ${fg(85)}${ACTIVE_MODEL}${RESET}`);
            console.log(`  ${fg(238)}·${RESET} Memory:    ${fg(141)}${brainSummary || 'No stored facts'}${RESET}`);
            console.log(`  ${fg(238)}·${RESET} Context:   ${fg(214)}${MESSAGES.length} messages${RESET}`);
            console.log(`  ${fg(238)}·${RESET} Architect: ${arch.hasMap() ? fg(85) + 'Active' : fg(238) + 'Idle'}${RESET}`);
            console.log(`  ${fg(238)}·${RESET} Directory: ${fg(244)}${process.cwd()}${RESET}\n`);
            console.log(`  ${fg(238)}context ${RESET} ${CONTEXT.file ? rend.fileTag(path.basename(CONTEXT.file)) : `${fg(238)}none${RESET}`}`);
            console.log(`${fg(238)}${'─'.repeat(w)}${RESET}\n`);
            continue;
        }

        if (cmd === '/forget') {
            const confirm = await sel.confirm('Wipe all persistent brain memory?');
            if (confirm) {
                brain.clearMemory();
                console.log(`\n  ${fg(85)}* Brain wiped. Memory is now blank.${RESET}\n`);
            }
            continue;
        }

        // copy — copy last AI response to clipboard
        if (cmd === 'copy') {
            if (!LAST_RESPONSE) { console.log(`\n  ${fg(238)}Nothing to copy yet.${RESET}\n`); continue; }
            const ok = await copyToClipboard(LAST_RESPONSE);
            console.log(`\n  ${ok ? `${fg(85)}* Copied to clipboard!` : `${fg(203)}# Copy failed.`}${RESET}\n`);
            continue;
        }

        // export — save conversation as Markdown
        if (cmd === 'export') {
            const file = exportConversation();
            if (file) console.log(`\n  ${fg(85)}✔ Exported →${RESET} ${rend.fileTag(path.basename(file))}\n  ${fg(238)}${file}${RESET}\n`);
            else console.log(`\n  ${fg(203)}✖ Export failed.${RESET}\n`);
            continue;
        }

        // /compact — summarize and compress history
        if (cmd === '/compact' || cmd === 'compact') {
            await compactHistory();
            continue;
        }

        // /redo — re-send the last user message
        if (cmd === '/redo' || cmd === 'redo') {
            if (!LAST_USER_MSG) { console.log(`\n  ${fg(238)}No previous message to redo.${RESET}\n`); continue; }
            console.log(`\n  ${fg(238)}Resending: ${fg(252)}${LAST_USER_MSG.slice(0, 60)}…${RESET}\n`);
            rend.printUserBubble(LAST_USER_MSG);
            await streamAI(LAST_USER_MSG);
            continue;
        }

        // run — run a shell command
        if (cmd.startsWith('run ') || cmd.startsWith('!')) {
            const shellCmd = input.trim().replace(/^(run |!)/, '');
            await runShellCommand(shellCmd);
            continue;
        }

        // ── Send to AI ──────────────────────────────────────────────────────────
        LAST_USER_MSG = input.trim();
        rend.printUserBubble(input.trim());
        await streamAI(input.trim());
    }
}

module.exports = { start };
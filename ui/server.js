// ╔══════════════════════════════════════════════╗
// ║         CLAI  ·  WEB UI SERVER               ║
// ║   Zero external dependencies — built-ins only ║
// ╚══════════════════════════════════════════════╝
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Reuse existing CLAI engine modules
const brain = require('../engine/brain');
const arch = require('../engine/architect');

const PORT = process.env.CLAI_PORT || 3131;
const PUBLIC = path.join(__dirname, 'public');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const HIST_FILE = path.join(LOGS_DIR, 'history.json');

// ── MIME types ────────────────────────────────────────────────────────────────
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
        req.on('error', reject);
    });
}

function json(res, obj, status = 200) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(body);
}

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
}

// ── Ollama helpers ─────────────────────────────────────────────────────────────
function ollamaFetch(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: '127.0.0.1',
            port: 11434,
            path: endpoint,
            method: options.method || 'GET',
            headers: options.headers || {},
        };
        const req = http.request(opts, res => resolve(res));
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

function readOllamaJson(res) {
    return new Promise((resolve, reject) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        res.on('error', reject);
    });
}

// ── Load conversation history ──────────────────────────────────────────────────
function loadHistory() {
    try {
        if (fs.existsSync(HIST_FILE)) return JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
    } catch { }
    return [];
}
function saveHistory(msgs) {
    try {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
        fs.writeFileSync(HIST_FILE, JSON.stringify(msgs, null, 2));
    } catch { }
}

// ── SSE helpers ───────────────────────────────────────────────────────────────
function sseHead(res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
}
function sseWrite(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ── Request router ─────────────────────────────────────────────────────────────
async function handleRequest(req, res) {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const method = req.method.toUpperCase();

    // CORS pre-flight
    if (method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
        res.end(); return;
    }

    // ── Static files ─────────────────────────────────────────────────────────
    if (method === 'GET' && !pathname.startsWith('/api/')) {
        const file = pathname === '/' ? 'index.html' : pathname.slice(1);
        return serveFile(res, path.join(PUBLIC, file));
    }

    // ── API: GET /api/models ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/models') {
        try {
            const olRes = await ollamaFetch('/api/tags');
            const data = await readOllamaJson(olRes);
            const models = (data.models || []).map(m => m.name);
            return json(res, { models });
        } catch {
            return json(res, { models: [], error: 'Ollama offline' }, 503);
        }
    }

    // ── API: GET /api/memory ─────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/memory') {
        const mem = brain.loadMemory();
        return json(res, mem);
    }

    // ── API: GET /api/history ────────────────────────────────────────────────
    if (method === 'GET' && pathname === '/api/history') {
        return json(res, loadHistory());
    }

    // ── API: POST /api/forget ────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/forget') {
        brain.clearMemory();
        return json(res, { ok: true });
    }

    // ── API: POST /api/clearhistory ──────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/clearhistory') {
        saveHistory([]);
        return json(res, { ok: true });
    }

    // ── API: POST /api/remember ──────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/remember') {
        const body = await readBody(req);
        if (body.fact) brain.addFact(body.fact);
        return json(res, { ok: true });
    }

    // ── API: POST /api/chat  (SSE streaming) ─────────────────────────────────
    if (method === 'POST' && pathname === '/api/chat') {
        const body = await readBody(req);
        const { prompt, model, systemPrompt } = body;

        if (!prompt || !model) return json(res, { error: 'prompt and model required' }, 400);

        sseHead(res);

        // Build message history
        const messages = loadHistory();
        const now = () => new Date().toISOString();

        const sysMsgs = [];
        if (systemPrompt) sysMsgs.push({ role: 'system', content: systemPrompt });
        const brainChunk = brain.getSystemPromptChunk();
        const archChunk = arch.getPromptChunk ? arch.getPromptChunk() : '';
        if (brainChunk || archChunk) {
            sysMsgs.push({ role: 'system', content: `${brainChunk}\n${archChunk}`.trim() });
        }

        messages.push({ role: 'user', content: prompt, ts: now() });

        const payload = JSON.stringify({
            model,
            messages: [
                ...sysMsgs,
                ...messages.map(m => ({ role: m.role, content: m.content })),
            ],
            stream: true,
        });

        let fullResponse = '';
        const startTime = Date.now();

        try {
            const olRes = await ollamaFetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
                body: payload,
            });

            if (olRes.statusCode !== 200) {
                sseWrite(res, 'error', { message: 'Ollama error ' + olRes.statusCode });
                res.end(); return;
            }

            olRes.on('data', chunk => {
                const lines = chunk.toString().split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        const token = parsed?.message?.content || '';
                        if (token) {
                            fullResponse += token;
                            sseWrite(res, 'chunk', { token });
                        }
                        // Handle [REMEMBER:...] tags
                        const remMatch = token.match(/\[REMEMBER:(.*?)\]/);
                        if (remMatch && remMatch[1]) brain.addFact(remMatch[1]);
                    } catch { }
                }
            });

            olRes.on('end', () => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                // Save to history
                messages.push({ role: 'assistant', content: fullResponse, ts: now() });
                saveHistory(messages);
                sseWrite(res, 'done', { elapsed, tokens: Math.ceil(fullResponse.length / 4) });
                res.end();
            });

            olRes.on('error', err => {
                sseWrite(res, 'error', { message: err.message });
                res.end();
            });

            req.on('close', () => { olRes.destroy(); });

        } catch (err) {
            sseWrite(res, 'error', { message: err.message });
            res.end();
        }
        return;
    }

    // ── 404 fallback ─────────────────────────────────────────────────────────
    res.writeHead(404); res.end('Not found');
}

// ── Start server ───────────────────────────────────────────────────────────────
const server = http.createServer(handleRequest);
server.listen(PORT, '127.0.0.1', () => {
    const addr = `http://127.0.0.1:${PORT}`;
    console.log(`\x1b[38;5;141m\x1b[1m  CLAI UI\x1b[0m  \x1b[38;5;238mrunning at\x1b[0m \x1b[38;5;81m${addr}\x1b[0m`);
});

module.exports = { server };

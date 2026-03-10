// ╔══════════════════════════════════════════════╗
// ║          CLAI  ·  ARCHITECT ENGINE           ║
// ╚══════════════════════════════════════════════╝
'use strict';

const fs = require('fs');
const path = require('path');

let PROJECT_MAP = null;

const EXCLUDES = [
    'node_modules', '.git', '.gemini', 'logs', 'dist', 'build', 'out',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'history.json'
];

const TEXT_EXTS = [
    '.js', '.ts', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
    '.txt', '.md', '.json', '.yaml', '.yml', '.css', '.html', '.sh', '.bat', '.ps1',
    '.env', '.config', '.xml', '.svg'
];

/**
 * Scans the current workspace to build a project map.
 * @param {string} root - the root directory to scan
 */
function scanProject(root) {
    const map = {
        root: path.basename(root),
        files: [],
        folders: []
    };

    function walk(dir, depth = 0) {
        if (depth > 5) return; // Limit depth for shallow knowledge

        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (EXCLUDES.includes(item)) continue;
            if (item.startsWith('.')) continue;

            const full = path.join(dir, item);
            const stats = fs.statSync(full);
            const rel = path.relative(root, full).replace(/\\/g, '/');

            if (stats.isDirectory()) {
                map.folders.push(rel);
                walk(full, depth + 1);
            } else {
                const ext = path.extname(item).toLowerCase();
                if (TEXT_EXTS.includes(ext) || ext === '') {
                    map.files.push({
                        name: rel,
                        size: stats.size,
                        ext: ext
                    });
                }
            }
        }
    }

    try {
        walk(root);
        PROJECT_MAP = map;
        return map;
    } catch (e) {
        return null;
    }
}

function hasMap() {
    return PROJECT_MAP !== null;
}

/**
 * Formats the project map for the AI system prompt.
 */
function getSystemPromptChunk(map) {
    if (!map) return '';

    let out = `\n\n[PROJECT STRUCTURE: ${map.root}]\n`;
    out += `You are aware of the following files in the workspace:\n`;

    // Group files by directory for a cleaner map
    const structure = {};
    map.files.forEach(f => {
        const parts = f.name.split('/');
        const file = parts.pop();
        const folder = parts.join('/') || '.';
        if (!structure[folder]) structure[folder] = [];
        structure[folder].push(file);
    });

    Object.keys(structure).sort().forEach(folder => {
        out += `- ${folder}/: ${structure[folder].join(', ')}\n`;
    });

    out += `\nIf you need to see the content of a file listed above to answer a question, you MUST use the tag [READ:filename].`;
    return out;
}

function getPromptChunk() {
    return getSystemPromptChunk(PROJECT_MAP);
}

function getMap() {
    return PROJECT_MAP;
}

module.exports = { scanProject, getSystemPromptChunk, getPromptChunk, hasMap, getMap };

// ################################################
// ##           CLAI  .  BRAIN ENGINE             ##
// ################################################
'use strict';

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '..', 'logs', 'memory.json');

/**
 * Loads the structured memory.
 * Structure: { facts: [], special: {} }
 */
function loadMemory() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
            // migration/init check
            if (Array.isArray(data)) return { facts: data, special: {} };
            return {
                facts: data.facts || [],
                special: data.special || {}
            };
        }
    } catch (e) { }
    return { facts: [], special: {} };
}

function saveMemory(memory) {
    try {
        const dir = path.dirname(MEMORY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Adds a fact or sets a special key.
 * Expected formats:
 * - "fact about something"
 * - "user.name: joy"
 * - "project.goal = fast AI"
 */
function addFact(input) {
    if (!input || typeof input !== 'string') return;
    const memory = loadMemory();
    const cleaned = input.trim();

    // Check for key-value assignment (supports : or =)
    const match = cleaned.match(/^([\w.]+)\s*[:=]\s*(.*)$/);
    if (match) {
        const keyPath = match[1].trim();
        const value = match[2].trim();

        // Handle nested keys (e.g., user.name)
        const parts = keyPath.split('.');
        let curr = memory.special;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]] || typeof curr[parts[i]] !== 'object') curr[parts[i]] = {};
            curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = value;
    } else {
        // Regular fact
        if (!memory.facts.includes(cleaned)) {
            memory.facts.push(cleaned);
        }
    }

    saveMemory(memory);
}

function clearMemory() {
    saveMemory({ facts: [], special: {} });
}

function getSystemPromptChunk() {
    const memory = loadMemory();
    const facts = memory.facts;
    const special = memory.special;

    if (facts.length === 0 && Object.keys(special).length === 0) return '';

    let out = '\n\n[PERSISTENT BRAIN MEMORY]\n';

    if (Object.keys(special).length > 0) {
        out += '## Structured Facts (Special Keys):\n';
        out += JSON.stringify(special, null, 2) + '\n';
    }

    if (facts.length > 0) {
        out += '## General Observations:\n';
        facts.forEach(f => out += `- ${f}\n`);
    }

    out += '\nTo update memory, use [REMEMBER:key.path=value] for structured data or [REMEMBER:fact] for general info.';
    return out;
}

function getSummary() {
    const memory = loadMemory();
    const fCount = memory.facts.length;
    const sCount = Object.keys(memory.special).length;
    if (fCount === 0 && sCount === 0) return null;
    return `${fCount} facts / ${sCount} keys stored`;
}

module.exports = { loadMemory, addFact, clearMemory, getSystemPromptChunk, getSummary };

# ✦ CLAI: Command-Line AI Interface

**CLAI** is a premium, zero-dependency AI interface designed for speed, aesthetics, and deep integration with your local development environment. Built entirely with Node.js built-ins, it provides a powerful bridge between you and your local LLMs via Ollama.

![CLAI Banner](https://img.shields.io/badge/Interface-Terminal%20%2B%20Web-blueviolet?style=for-the-badge)
![Dependencies-Zero](https://img.shields.io/badge/Dependencies-Zero-success?style=for-the-badge)
![Engine-Ollama](https://img.shields.io/badge/Engine-Ollama-blue?style=for-the-badge)

---

## 🚀 Key Features

- **Dual-Interface System**: Seamlessly switch between a high-fidelity **Terminal REPL** and a responsive **Web UI**.
- **Zero External Dependencies**: Lightweight and secure—no `npm install` required for core functionality.
- **Persistent Brain Memory**: Remembers facts across sessions using a structured JSON memory system.
- **Architect Mode**: Scans and "maps" your project structure, giving the AI full context of your codebase.
- **Visual Excellence**: Features 12+ selectable themes, ASCII art gallery, cinematic VFX (glitch, flicker, aurora), and typewriter animations.
- **Integrated Shell Runner**: Execute terminal commands directly from the chat with a simple `!` prefix.
- **Smart Exports**: Save your conversations to beautifully formatted Markdown files instantly.
- **Auto-Compaction**: Keeps your context window clean by automatically summarizing old messages when thresholds are reached.

---

## 🛠️ Prerequisites

- **Node.js** (v18 or higher recommended)
- **Ollama** (Running locally on port 11434)

---

## 📥 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/CLAI.git
   cd CLAI
   ```

2. **Check models**:
   Ensure you have a model pulled in Ollama (e.g., `qwen2.5-coder`):
   ```bash
   ollama pull qwen2.5-coder:3b
   ```

---

## 🎮 Usage

### Terminal UI (The Standard REPL)
Launch the enhanced terminal experience:
```bash
./clai
```

### Web UI
Launch the browser-based interface (runs at `http://127.0.0.1:3131`):
```bash
./clai ui
```

---

## 📜 Interactive Commands

While in the Terminal REPL, you can use these commands:

| Command | Description |
| :--- | :--- |
| `models` | Interactive menu to switch between local models. |
| `/theme` | Change the visual style (Matrix, Neon, Sunset, etc.). |
| `/scan` | Activate **Architect Mode** to map your project. |
| `history` | View the current session history and token usage. |
| `export` | Save the current conversation to `logs/clai-export-*.md`. |
| `copy` | Copy the last AI response to your system clipboard. |
| `run <cmd>` or `!<cmd>` | Execute a shell command directly. |
| `status` | Show current session, model, and memory state. |
| `history` | Review conversation history. |
| `/compact` | Manually compress long history into a summary. |
| `/singularity` | Activate **Creative Singularity** mode (deep synth logic). |
| `exit` | Safely close the session. |

---

## 🧠 Brain Tags & Special Logic

The AI can interact with your system and UI using special tags:

- **Memory**: `[REMEMBER:user.name=Alice]` — Stores structured facts in `logs/memory.json`.
- **File Writing**: `[WRITE:filename]...[/WRITE]` — Proposes file edits which you can approve.
- **Visuals**: `[VFX:glitch]` or `[ASCII:robot]` — Triggers UI effects or art.
- **Selection**: `[MENU:Title] Option 1 \| Desc [/MENU]` — Interactive choice menus.

---

## 📁 Project Structure

```text
CLAI/
├── engine/         # Core logic: thinker, renderer, architect, animator
├── ui/             # Web UI server and public assets
├── plugins/        # Filesystem integration
├── logs/           # Session history, exports, and brain memory
├── clai.js         # Entry point for terminal
└── clai.cmd        # Windows launcher script
```

---

## 📄 License
This project is open-source. Feel free to fork and enhance!

---
*Built with Passion for the Terminal.*


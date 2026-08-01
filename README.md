diff --git a/README.md b/README.md
index 00cfd9b3559874e1a08b59d8d122c4b317eccc22..d140c1904f2d2437a2b865acd3619cefed602a7a 100644
--- a/README.md
+++ b/README.md
@@ -1,114 +1,345 @@
 # ✦ CLAI: Command-Line AI Interface
 
-**CLAI** is a premium, zero-dependency AI interface designed for speed, aesthetics, and deep integration with your local development environment. Built entirely with Node.js built-ins, it provides a powerful bridge between you and your local LLMs via Ollama.
+**CLAI** is a local-first AI assistant for your terminal and browser, built with **Node.js built-ins only** and designed to work with **local Ollama models**.
 
 ![CLAI Banner](https://img.shields.io/badge/Interface-Terminal%20%2B%20Web-blueviolet?style=for-the-badge)
-![Dependencies-Zero](https://img.shields.io/badge/Dependencies-Zero-success?style=for-the-badge)
+![Dependencies-Zero](https://img.shields.io/badge/npm%20deps-Zero-success?style=for-the-badge)
 ![Engine-Ollama](https://img.shields.io/badge/Engine-Ollama-blue?style=for-the-badge)
 
 ---
 
-## 🚀 Key Features
+## What CLAI does
 
-- **Dual-Interface System**: Seamlessly switch between a high-fidelity **Terminal REPL** and a responsive **Web UI**.
-- **Zero External Dependencies**: Lightweight and secure—no `npm install` required for core functionality.
-- **Persistent Brain Memory**: Remembers facts across sessions using a structured JSON memory system.
-- **Architect Mode**: Scans and "maps" your project structure, giving the AI full context of your codebase.
-- **Visual Excellence**: Features 12+ selectable themes, ASCII art gallery, cinematic VFX (glitch, flicker, aurora), and typewriter animations.
-- **Integrated Shell Runner**: Execute terminal commands directly from the chat with a simple `!` prefix.
-- **Smart Exports**: Save your conversations to beautifully formatted Markdown files instantly.
-- **Auto-Compaction**: Keeps your context window clean by automatically summarizing old messages when thresholds are reached.
+CLAI gives you two ways to talk to a local LLM:
+
+- **Terminal REPL** for a focused command-line workflow
+- **Web UI** for a browser-based chat experience
+
+It also includes:
+
+- **Persistent memory** stored on disk
+- **Project scanning** for lightweight workspace awareness
+- **Conversation history and export tools**
+- **Theme, ASCII, and terminal visual effects**
+- **Optional shell execution and file-writing flows** with user approval
+
+> CLAI has **zero npm dependencies**, but it still requires **Node.js**, **Ollama**, and at least one local model.
 
 ---
 
-## 🛠️ Prerequisites
+## Quick Start
+
+### 1) Prerequisites
 
-- **Node.js** (v18 or higher recommended)
-- **Ollama** (Running locally on port 11434)
+You need:
+
+- **Node.js 18+**
+- **Ollama** running locally on port `11434`
+- At least one Ollama model installed
+
+### 2) Clone the repository
+
+```bash
+git clone https://github.com/your-username/CLAI.git
+cd CLAI
+```
+
+### 3) Start Ollama and pull a model
+
+```bash
+ollama serve
+ollama pull qwen2.5-coder:3b
+```
+
+If you already use Ollama, you can confirm available models with:
+
+```bash
+ollama list
+```
+
+### 4) Launch CLAI
+
+#### Terminal UI
+
+```bash
+./clai
+```
+
+#### Web UI
+
+```bash
+./clai ui
+```
+
+Then open:
+
+```text
+http://127.0.0.1:3131
+```
+
+### 5) Try a first prompt
+
+Example prompts:
+
+```text
+Explain this repository structure.
+```
+
+```text
+Help me refactor a Node.js CLI.
+```
+
+```text
+/scan
+```
 
 ---
 
-## 📥 Installation
+## Installation Notes
+
+### Unix/macOS
+
+You may need to make the launcher executable:
+
+```bash
+chmod +x clai
+```
+
+If the `clai` launcher script is not present in your checkout, you can run the entrypoint directly:
+
+```bash
+node clai.js
+```
+
+### Windows
 
-1. **Clone the repository**:
-   ```bash
-   git clone https://github.com/your-username/CLAI.git
-   cd CLAI
-   ```
+Use the included launcher:
 
-2. **Check models**:
-   Ensure you have a model pulled in Ollama (e.g., `qwen2.5-coder`):
-   ```bash
-   ollama pull qwen2.5-coder:3b
-   ```
+```powershell
+clai.cmd
+```
 
 ---
 
-## 🎮 Usage
+## Usage Modes
+
+## Terminal REPL
 
-### Terminal UI (The Standard REPL)
 Launch the enhanced terminal experience:
+
 ```bash
 ./clai
 ```
 
-### Web UI
-Launch the browser-based interface (runs at `http://127.0.0.1:3131`):
+The terminal mode supports:
+
+- streaming responses
+- multi-line input with `"""`
+- file selection
+- project scanning
+- shell command execution
+- session history
+- export to Markdown
+- theme and ASCII interactions
+
+## Web UI
+
+Launch the browser-based interface:
+
 ```bash
 ./clai ui
 ```
 
+The web server runs locally by default at `http://127.0.0.1:3131` and exposes API endpoints for:
+
+- model listing
+- chat streaming
+- memory viewing/resetting
+- history viewing/resetting
+
+The Web UI also depends on the same local Ollama instance. If Ollama is offline, model listing and chat requests will fail until it is started.
+
 ---
 
-## 📜 Interactive Commands
+## Interactive Commands
 
 While in the Terminal REPL, you can use these commands:
 
-| Command | Description |
-| :--- | :--- |
-| `models` | Interactive menu to switch between local models. |
-| `/theme` | Change the visual style (Matrix, Neon, Sunset, etc.). |
-| `/scan` | Activate **Architect Mode** to map your project. |
-| `history` | View the current session history and token usage. |
-| `export` | Save the current conversation to `logs/clai-export-*.md`. |
-| `copy` | Copy the last AI response to your system clipboard. |
-| `run <cmd>` or `!<cmd>` | Execute a shell command directly. |
-| `status` | Show current session, model, and memory state. |
-| `history` | Review conversation history. |
-| `/compact` | Manually compress long history into a summary. |
-| `/singularity` | Activate **Creative Singularity** mode (deep synth logic). |
-| `exit` | Safely close the session. |
+| Command | Description | Example |
+| :--- | :--- | :--- |
+| `models` | Open a menu to switch local Ollama models. | `models` |
+| `use <model>` | Manually set the active model. | `use qwen2.5-coder:3b` |
+| `/theme` | Change the current visual theme. | `/theme` |
+| `/typewriter` | Toggle the typewriter effect on streamed output. | `/typewriter` |
+| `/scan` | Scan the current project and add lightweight structure context. | `/scan` |
+| `selectfile` | Choose a file from the current directory tree for extra context. | `selectfile` |
+| `clearfile` | Remove the currently loaded file context. | `clearfile` |
+| `status` | Show current session, model, memory, and context status. | `status` |
+| `history` | Review the current session history. | `history` |
+| `clearhistory` | Wipe the saved session history. | `clearhistory` |
+| `/compact` | Summarize and compress long conversation history. | `/compact` |
+| `export` | Save the conversation to `logs/clai-export-*.md`. | `export` |
+| `copy` | Copy the last AI response to the clipboard. | `copy` |
+| `run <cmd>` or `!<cmd>` | Execute a shell command in the current working directory. | `!git status` |
+| `/singularity` | Enable the more experimental creative mode. | `/singularity` |
+| `/forget` | Clear persistent brain memory. | `/forget` |
+| `exit` | Exit the app. | `exit` |
+
+### Multi-line input
+
+Type `"""` on its own line to enter block mode, then type `"""` again to submit.
+
+---
+
+## Memory, History, and Exports
+
+## Persistent memory
+
+CLAI stores memory in:
+
+```text
+logs/memory.json
+```
+
+Memory supports two styles:
+
+- **General facts**
+- **Structured keys** like `user.name=Alice`
+
+The AI can emit tags such as:
+
+```text
+[REMEMBER:user.name=Alice]
+[REMEMBER:prefers concise answers]
+```
+
+To clear persistent memory from the Terminal UI, use:
+
+```text
+/forget
+```
+
+## Conversation history
+
+Conversation history is stored in:
+
+```text
+logs/history.json
+```
+
+Terminal mode restores previous messages on startup. You can inspect the session with `history`, clear it with `clearhistory`, or reduce long context with `/compact`.
+
+## Markdown export
+
+Use:
+
+```text
+export
+```
+
+This writes a Markdown transcript to:
+
+```text
+logs/clai-export-*.md
+```
+
+---
+
+## Special Tags and Automation
+
+The AI can interact with the terminal and interface using tags:
+
+- **Memory**: `[REMEMBER:user.name=Alice]`
+- **File writing proposals**: `[WRITE:filename]...[/WRITE]`
+- **Project/file reads**: `[READ:path/to/file]`
+- **Visual effects**: `[VFX:glitch]`, `[VFX:flicker]`, `[VFX:aurora]`
+- **ASCII art**: `[ASCII:robot]`
+- **Menus**: `[MENU:Title] ... [/MENU]`
+- **Clock/system widgets**: `[CLOCK]`, `[SYSINFO]`, `[TIME]`
+- **Theme changes**: `[THEME:matrix]`
+
+These features are powerful, but some of them can affect your files, shell, or persistent local state.
+
+---
+
+## Platform Notes
+
+Some features are platform-sensitive:
+
+- The clipboard command currently depends on system clipboard tooling.
+- Terminal visuals assume ANSI-capable output.
+- Unix users may need executable permissions for launcher scripts.
+- Ollama must be installed and reachable at `127.0.0.1:11434`.
+
+If something fails, check your OS shell environment and confirm Ollama is running first.
+
+---
+
+## Safety Notes
+
+CLAI is intentionally powerful. Please use it carefully.
+
+### Review shell commands before running them
+
+The assistant can suggest commands and the terminal flow can prompt you to run them. Treat these like any other shell command: inspect before approving.
+
+### Review file writes before approving them
+
+The assistant can propose file output using `[WRITE:filename]...[/WRITE]`. Always inspect the destination path and content before accepting.
+
+### Be mindful of memory persistence
+
+Facts stored through memory tags are written to `logs/memory.json` and can persist between sessions until cleared.
+
+### Use caution in sensitive directories
+
+Because CLAI can scan files, store history, and run commands, avoid using it in directories containing secrets or production-critical material unless you understand the tradeoffs.
 
 ---
 
-## 🧠 Brain Tags & Special Logic
+## Known Limitations
 
-The AI can interact with your system and UI using special tags:
+Current limitations to be aware of:
 
-- **Memory**: `[REMEMBER:user.name=Alice]` — Stores structured facts in `logs/memory.json`.
-- **File Writing**: `[WRITE:filename]...[/WRITE]` — Proposes file edits which you can approve.
-- **Visuals**: `[VFX:glitch]` or `[ASCII:robot]` — Triggers UI effects or art.
-- **Selection**: `[MENU:Title] Option 1 \| Desc [/MENU]` — Interactive choice menus.
+- CLAI requires a working **local Ollama installation**.
+- Startup behavior depends on what models are already available in Ollama.
+- The project scanner is intentionally lightweight and does not provide deep semantic indexing.
+- Web UI and terminal mode are related but not identical in interaction style.
+- Some features depend on terminal capabilities and OS-specific tooling.
+- Shell execution and file-writing features are useful, but they require careful operator review.
 
 ---
 
-## 📁 Project Structure
+## Project Structure
 
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
 
-## 📄 License
-This project is open-source. Feel free to fork and enhance!
+## Recommended Next README Improvements
+
+If you continue polishing the project page, the next high-value additions would be:
+
+1. **Terminal screenshots or GIFs**
+2. **A Web UI screenshot**
+3. **A short demo transcript**
+4. **A roadmap / planned features section**
+5. **Contribution instructions**

---

## 🎨 Creative UI
Check out the [Vercel-inspired Dashboard UI](https://github.com/joymengistu/Vercel-UI-Creative) created for this project.
+
+---
+
+## License
+
+This project is open-source. Feel free to fork and enhance it.
 
 ---
-*Built with Passion for the Terminal.*
 
+*Built for local-first AI workflows in the terminal.*

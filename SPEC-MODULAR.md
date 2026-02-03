# OpenClaw Modular Product Requirements Document

> **Purpose**: A reverse-engineered specification of the OpenClaw system, organized into discrete modules for selective inclusion in a custom build.
>
> **Usage**: Check/uncheck modules to define your slim bot. Each module lists its purpose, dependencies, key files, and whether it can be cut.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Magic Sauce (Core Architecture)](#the-magic-sauce)
3. [Module Categories](#module-categories)
   - [CORE - Required Infrastructure](#core---required-infrastructure)
   - [MESSAGING - Channel Integrations](#messaging---channel-integrations)
   - [LLM - AI Providers](#llm---ai-providers)
   - [TOOLS - Agent Capabilities](#tools---agent-capabilities)
   - [AUTOMATION - Proactive Features](#automation---proactive-features)
   - [MEMORY - Persistence & Knowledge](#memory---persistence--knowledge)
   - [PLATFORM - Deployment Targets](#platform---deployment-targets)
   - [UI - User Interfaces](#ui---user-interfaces)
   - [SECURITY - Access Control](#security---access-control)
   - [OPTIONAL - Cut Candidates](#optional---cut-candidates)
4. [Dependency Map](#dependency-map)
5. [Minimal Viable Configuration](#minimal-viable-configuration)
6. [Build Profiles](#build-profiles)

---

## Executive Summary

**What is OpenClaw?**
A personal AI assistant framework that runs on your own hardware, connects to your messaging apps, and executes real tasks through an embedded agent runtime.

**What makes it different?**
- Embedded stateful agent loop (not API wrapper)
- Persistent sessions that survive restarts
- Real tool execution (bash, browser, files)
- Multi-channel messaging (same assistant everywhere)
- Runs as daemon on your hardware

**Codebase Stats:**
- ~14MB TypeScript source (`src/`)
- 38 extensions (`extensions/`)
- 70% test coverage threshold
- Node 22+ runtime (Bun supported)

---

## The Magic Sauce

### Core Innovation: Embedded Stateful Agent Loop

```
┌─────────────────────────────────────────────────────────────┐
│                        GATEWAY                              │
│          WebSocket daemon - always running                  │
│          Orchestrates channels, agents, sessions            │
└─────────────────────────┬───────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌───────────────┐       ┌───────────────┐
      │   CHANNELS    │       │   SESSIONS    │
      │ telegram, wa  │       │  persistent   │
      │ discord, etc  │       │  transcript   │
      └───────┬───────┘       └───────┬───────┘
              │                       │
              └───────────┬───────────┘
                          ▼
                  ┌───────────────┐
                  │  PI RUNTIME   │  ← THE BRAIN
                  │  agent loop   │
                  │  (in-process) │
                  └───────┬───────┘
                          ▼
                  ┌───────────────┐
                  │    TOOLS      │
                  │ bash, browser │
                  │ files, memory │
                  └───────────────┘
```

### The Loop (What Makes It "Jarvis")

```
Message arrives
    ↓
Gateway routes to agent/session
    ↓
SessionManager loads transcript history
    ↓
Pi runtime starts loop:
    ├── Model thinks (inference on history)
    ├── Decides to call tool
    ├── Tool executes (real bash/browse/etc)
    ├── Observes result
    ├── Model thinks again
    ├── ... (loops until satisfied)
    └── Model says "done"
    ↓
Response delivered to channel
    ↓
Session persisted to disk
```

### Key Insight

The agent isn't responding to prompts—it's **working through problems**, using tools to explore, and adapting based on feedback. All within a persistent context that survives restarts.

---

## Module Categories

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Required for core functionality |
| 🔶 | Recommended but optional |
| ⬜ | Fully optional / cut candidate |
| 📦 | Has significant dependencies |
| 🔗 | Has dependencies on other modules |

---

## CORE - Required Infrastructure

These modules are the foundation. Cutting them breaks the system.

### CORE-001: Gateway Server
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | WebSocket control plane that orchestrates everything |
| **Key Files** | `src/gateway/server.impl.ts`, `src/gateway/server-*.ts` |
| **Dependencies** | `express`, `hono`, `ws` |
| **Size Impact** | ~50KB code |
| **Can Cut?** | ❌ No - this IS the system |

**Responsibilities:**
- WebSocket/HTTP server
- Channel lifecycle management
- Agent event routing
- Session coordination
- Plugin loading
- Health monitoring

**Subcomponents:**
- `server-channels.ts` - Channel start/stop
- `server-chat.ts` - Message → agent routing
- `server-cron.ts` - Scheduled task execution
- `server-http.ts` - REST API endpoints
- `server-ws-runtime.ts` - WebSocket handlers
- `server-plugins.ts` - Plugin management
- `server-startup.ts` - Initialization sequence

---

### CORE-002: Pi Agent Runtime
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Embedded coding agent that runs the inference loop |
| **Key Files** | `src/agents/pi-embedded-runner/` |
| **Dependencies** | `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai` |
| **Size Impact** | ~80MB node_modules |
| **Can Cut?** | ❌ No - this is the brain |

**Responsibilities:**
- Stateful agent loop execution
- Tool call interception and execution
- Context window management
- Streaming output during inference
- Session state persistence

**Key Functions:**
- `createAgentSession()` - Creates looping agent
- `SessionManager` - Manages transcript persistence
- `streamSimple()` - Streams model output

---

### CORE-003: Session Management
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Persistent conversation state across messages and restarts |
| **Key Files** | `src/config/sessions/store.ts`, `src/sessions/` |
| **Dependencies** | `proper-lockfile` |
| **Size Impact** | ~10KB code |
| **Can Cut?** | ❌ No - memory is essential |

**Storage Location:** `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`

**Responsibilities:**
- JSONL transcript storage
- Session key derivation
- Context compaction (summarization)
- Session pruning (old sessions)
- File locking (prevent races)

---

### CORE-004: Lane Queueing
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Serializes execution to prevent race conditions |
| **Key Files** | `src/agents/pi-embedded-runner/run.ts` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ❌ No - prevents corruption |

**Responsibilities:**
- Per-session execution lanes
- Global execution lanes
- Prevents concurrent tool calls
- Ensures message ordering

---

### CORE-005: Configuration System
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | YAML-based configuration with validation |
| **Key Files** | `src/config/config.ts`, `src/config/schema.ts` |
| **Dependencies** | `yaml`, `ajv`, `@sinclair/typebox` |
| **Size Impact** | ~20KB code |
| **Can Cut?** | ❌ No - system needs config |

**Config Location:** `~/.openclaw/config.yml`

**Sections:**
- `gateway` - Port, bind, TLS
- `channels` - Per-channel settings
- `agents` - Agent workspaces
- `models` - Provider keys
- `routing` - Channel→agent bindings
- `hooks` - Event triggers
- `cron` - Scheduled tasks

---

### CORE-006: CLI Framework
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Command-line interface for all operations |
| **Key Files** | `src/cli/`, `src/commands/` |
| **Dependencies** | `commander`, `@clack/prompts`, `chalk` |
| **Size Impact** | ~100KB code |
| **Can Cut?** | ❌ No - primary interface |

**Key Commands:**
- `gateway run/stop/restart` - Daemon control
- `agent` - Run agent turn
- `message send` - Outbound messages
- `status` - System status
- `configure` - Interactive setup
- `onboard` - First-time wizard

---

### CORE-007: Routing Engine
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Routes messages to correct agent/session |
| **Key Files** | `src/routing/resolve-route.ts`, `src/routing/` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~15KB code |
| **Can Cut?** | ❌ No - message routing essential |

**Responsibilities:**
- `(channel, sender, group) → agent + session_key`
- Allowlist/denylist filtering
- Mention pattern matching
- Per-agent routing bindings
- Group session isolation

---

## MESSAGING - Channel Integrations

Pick the channels you actually use. Each can be independently enabled/disabled.

### MSG-001: Telegram
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Telegram Bot API integration |
| **Key Files** | `src/telegram/`, `extensions/telegram/` |
| **Dependencies** | `grammy`, `@grammyjs/runner`, `@grammyjs/transformer-throttler` |
| **Size Impact** | ~20MB node_modules |
| **Can Cut?** | ✅ Yes if not using Telegram |

**Features:**
- Bot API (polling or webhook)
- Inline keyboards
- Media send/receive
- Group mentions
- Reactions

**Config:**
```yaml
channels:
  telegram:
    accounts:
      - bot_token: "123:ABC..."
```

---

### MSG-002: WhatsApp (Baileys)
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | WhatsApp Web protocol via Baileys |
| **Key Files** | `src/web/`, `src/whatsapp/` |
| **Dependencies** | `@whiskeysockets/baileys` |
| **Size Impact** | ~40MB node_modules |
| **Can Cut?** | ✅ Yes if not using WhatsApp |

**Features:**
- QR code pairing
- Multi-device support
- Media send/receive
- Group messaging
- Reactions

**Config:**
```yaml
channels:
  whatsapp:
    accounts:
      - phone: "+1234567890"
```

---

### MSG-003: Discord
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Discord bot integration |
| **Key Files** | `src/discord/`, `extensions/discord/` |
| **Dependencies** | `discord-api-types`, `@buape/carbon` |
| **Size Impact** | ~15MB node_modules |
| **Can Cut?** | ✅ Yes if not using Discord |

**Features:**
- Bot token auth
- Server/channel management
- Slash commands
- Reactions
- Thread support

**Config:**
```yaml
channels:
  discord:
    accounts:
      - token: "MTIzNDU2..."
```

---

### MSG-004: Slack
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Slack workspace integration |
| **Key Files** | `src/slack/` |
| **Dependencies** | `@slack/bolt`, `@slack/web-api` |
| **Size Impact** | ~15MB node_modules |
| **Can Cut?** | ✅ Yes if not using Slack |

**Features:**
- Bot/app token auth
- Socket mode
- Slash commands
- Reactions
- Thread replies

**Config:**
```yaml
channels:
  slack:
    accounts:
      - bot_token: "xoxb-..."
        app_token: "xapp-..."
```

---

### MSG-005: Signal
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Signal messenger integration |
| **Key Files** | `src/signal/`, `extensions/signal/` |
| **Dependencies** | External: `signal-cli` |
| **Size Impact** | ~5KB code (relies on external binary) |
| **Can Cut?** | ✅ Yes if not using Signal |

**Features:**
- Linked device pairing
- Media send/receive
- Group messaging
- Reactions

**Requirements:** Requires `signal-cli` installed separately

---

### MSG-006: iMessage
| | |
|---|---|
| **Status** | ⬜ Optional (macOS only) |
| **Purpose** | Apple iMessage integration |
| **Key Files** | `src/imessage/` |
| **Dependencies** | macOS-specific APIs |
| **Size Impact** | ~10KB code |
| **Can Cut?** | ✅ Yes if not on macOS or not using iMessage |

**Features:**
- Send/receive via Messages.app
- Group messaging
- Tapbacks (reactions)

**Requirements:** macOS only, Full Disk Access required

---

### MSG-007: LINE
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | LINE messenger integration |
| **Key Files** | `src/line/` |
| **Dependencies** | `@line/bot-sdk` |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ✅ Yes if not using LINE |

**Features:**
- Messaging API
- Webhook mode
- Rich messages
- Stickers

---

### MSG-008: Google Chat
| | |
|---|---|
| **Status** | ⬜ Optional (Enterprise) |
| **Purpose** | Google Workspace Chat integration |
| **Key Files** | `src/googlechat/` |
| **Dependencies** | Google APIs |
| **Size Impact** | ~10KB code |
| **Can Cut?** | ✅ Yes - enterprise only |

---

### MSG-009: Microsoft Teams
| | |
|---|---|
| **Status** | ⬜ Optional (Enterprise) |
| **Purpose** | MS Teams bot integration |
| **Key Files** | `extensions/msteams/` |
| **Dependencies** | Bot Framework SDK |
| **Size Impact** | ~20MB node_modules |
| **Can Cut?** | ✅ Yes - enterprise only |

---

### MSG-010: Matrix
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Matrix protocol integration |
| **Key Files** | `extensions/matrix/` |
| **Dependencies** | Matrix SDK |
| **Size Impact** | ~15MB node_modules |
| **Can Cut?** | ✅ Yes if not using Matrix |

---

### MSG-011: Mattermost
| | |
|---|---|
| **Status** | ⬜ Optional (Enterprise) |
| **Purpose** | Mattermost self-hosted chat |
| **Key Files** | `extensions/mattermost/` |
| **Dependencies** | Mattermost SDK |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ✅ Yes - enterprise/self-hosted only |

---

### MSG-012: Twitch
| | |
|---|---|
| **Status** | ⬜ Optional (Niche) |
| **Purpose** | Twitch chat integration |
| **Key Files** | `extensions/twitch/` |
| **Dependencies** | Twitch IRC |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ✅ Yes - streaming niche |

**Note:** `sendText` not fully implemented (TODO in code)

---

### MSG-013: Nostr
| | |
|---|---|
| **Status** | ⬜ Optional (Niche) |
| **Purpose** | Nostr protocol integration |
| **Key Files** | `extensions/nostr/` |
| **Dependencies** | Nostr libraries |
| **Size Impact** | ~10MB node_modules |
| **Can Cut?** | ✅ Yes - crypto/privacy niche |

---

### MSG-014: Zalo
| | |
|---|---|
| **Status** | ⬜ Optional (Regional) |
| **Purpose** | Zalo messenger (Vietnam) |
| **Key Files** | `extensions/zalo/`, `extensions/zalouser/` |
| **Dependencies** | Zalo API |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ✅ Yes - Vietnam regional |

---

### MSG-015: Tlon/Urbit
| | |
|---|---|
| **Status** | ⬜ Optional (Niche) |
| **Purpose** | Urbit/Tlon network |
| **Key Files** | `extensions/tlon/` |
| **Dependencies** | Urbit API |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ✅ Yes - very niche |

---

### MSG-016: Nextcloud Talk
| | |
|---|---|
| **Status** | ⬜ Optional (Self-hosted) |
| **Purpose** | Nextcloud Talk integration |
| **Key Files** | `extensions/nextcloud-talk/` |
| **Dependencies** | Nextcloud API |
| **Size Impact** | ~2MB node_modules |
| **Can Cut?** | ✅ Yes - self-hosted only |

---

### MSG-017: BlueBubbles
| | |
|---|---|
| **Status** | ⬜ Optional (macOS relay) |
| **Purpose** | iMessage via BlueBubbles server |
| **Key Files** | `extensions/bluebubbles/` |
| **Dependencies** | BlueBubbles API |
| **Size Impact** | ~2MB node_modules |
| **Can Cut?** | ✅ Yes - alternative iMessage relay |

---

## LLM - AI Providers

### LLM-001: Anthropic (Claude)
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Claude API integration |
| **Key Files** | `src/agents/model-*.ts`, Pi runtime |
| **Dependencies** | Built into Pi runtime |
| **Size Impact** | Included in Pi |
| **Can Cut?** | ❌ No - primary provider |

**Models:** Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku

---

### LLM-002: OpenAI
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | GPT-4 API integration |
| **Key Files** | `src/agents/model-*.ts`, Pi runtime |
| **Dependencies** | Built into Pi runtime |
| **Size Impact** | Included in Pi |
| **Can Cut?** | ✅ Yes if only using Claude |

**Models:** GPT-4o, GPT-4 Turbo, GPT-3.5

---

### LLM-003: AWS Bedrock
| | |
|---|---|
| **Status** | ⬜ Optional (Enterprise) |
| **Purpose** | AWS Bedrock model access |
| **Key Files** | `src/agents/model-*.ts` |
| **Dependencies** | `@aws-sdk/client-bedrock` |
| **Size Impact** | ~30MB node_modules |
| **Can Cut?** | ✅ Yes - enterprise/AWS only |

**Models:** Claude via Bedrock, Titan, etc.

---

### LLM-004: Google (Gemini)
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Gemini API integration |
| **Key Files** | `src/agents/model-*.ts`, Pi runtime |
| **Dependencies** | Built into Pi runtime |
| **Size Impact** | Included in Pi |
| **Can Cut?** | ✅ Yes if not using Gemini |

**Models:** Gemini Pro, Gemini Ultra

---

### LLM-005: Ollama (Local)
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Local model execution via Ollama |
| **Key Files** | `src/agents/model-*.ts` |
| **Dependencies** | `ollama` (dev dependency) |
| **Size Impact** | ~2MB node_modules |
| **Can Cut?** | ✅ Yes if not running local models |

---

### LLM-006: Local GGUF
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Direct GGUF model loading |
| **Key Files** | `src/agents/model-*.ts` |
| **Dependencies** | `node-llama-cpp` (optional) |
| **Size Impact** | ~50MB node_modules |
| **Can Cut?** | ✅ Yes - optional dependency |

---

## TOOLS - Agent Capabilities

### TOOL-001: Bash Execution
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Execute shell commands |
| **Key Files** | `src/agents/bash-tools.ts` |
| **Dependencies** | `@lydell/node-pty` |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ❌ No - core capability |

**Features:**
- PTY support (interactive shells)
- Timeout handling
- Output capture
- Working directory management

**Tool Name:** `system.run`

---

### TOOL-002: File Operations
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Read/write/edit files |
| **Key Files** | Built into Pi runtime |
| **Dependencies** | Node fs |
| **Size Impact** | Included in Pi |
| **Can Cut?** | ❌ No - core capability |

**Tools:** `read_file`, `write_file`, `edit_file`, `list_directory`

---

### TOOL-003: Browser Automation
| | |
|---|---|
| **Status** | 📦 Optional (Heavy) |
| **Purpose** | Web browsing via Playwright |
| **Key Files** | `src/browser/` |
| **Dependencies** | `playwright-core`, `chromium-bidi` |
| **Size Impact** | ~200MB node_modules |
| **Can Cut?** | ✅ Yes - lazy-loadable |

**Features:**
- Page navigation
- Screenshot capture
- DOM interaction
- Form filling
- JavaScript execution

**Tool Name:** `browser.*`

**Recommendation:** Move to optional dependency, load only when `OPENCLAW_ENABLE_BROWSER=1`

---

### TOOL-004: Channel Tools
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Send messages to channels |
| **Key Files** | `src/agents/channel-tools.ts` |
| **Dependencies** | Channel modules |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ✅ Yes if agent shouldn't message |

**Tools:** `send_message`, `get_channel_status`

---

### TOOL-005: Memory/Search Tools
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Vector search over memories |
| **Key Files** | `src/memory/` |
| **Dependencies** | `sqlite-vec` or LanceDB extension |
| **Size Impact** | ~20MB node_modules |
| **Can Cut?** | ✅ Yes if not using memory |

**Tools:** `memory.search`, `memory.store`

---

### TOOL-006: Cron Tools
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Schedule future tasks |
| **Key Files** | `src/cron/` |
| **Dependencies** | `croner` |
| **Size Impact** | ~1MB node_modules |
| **Can Cut?** | ✅ Yes if not using automation |

**Tools:** `cron.schedule`, `cron.list`, `cron.delete`

---

### TOOL-007: Canvas/A2UI
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Rich UI rendering |
| **Key Files** | `src/canvas-host/` |
| **Dependencies** | UI bundle |
| **Size Impact** | ~5MB assets |
| **Can Cut?** | ✅ Yes if not using canvas |

---

## AUTOMATION - Proactive Features

### AUTO-001: Cron Jobs
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Scheduled task execution |
| **Key Files** | `src/cron/`, `src/gateway/server-cron.ts` |
| **Dependencies** | `croner` |
| **Size Impact** | ~1MB node_modules |
| **Can Cut?** | ✅ Yes if only reactive |

**Features:**
- 5-field cron expressions
- One-shot timers
- Interval schedules
- Per-agent cron jobs

**Config:**
```yaml
cron:
  jobs:
    - schedule: "0 9 * * *"
      agent: main
      prompt: "Morning briefing"
```

---

### AUTO-002: Heartbeat
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Periodic agent check-ins |
| **Key Files** | `src/agents/heartbeat.ts` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~2KB code |
| **Can Cut?** | ✅ Yes if not using proactive |

**Features:**
- Configurable interval (default 30min)
- Agent self-reflection
- Task discovery prompts

---

### AUTO-003: Webhooks
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | External HTTP triggers |
| **Key Files** | `src/hooks/`, `src/gateway/server-http.ts` |
| **Dependencies** | Express/Hono |
| **Size Impact** | Included in gateway |
| **Can Cut?** | ✅ Yes if no external triggers |

---

### AUTO-004: Gmail Watcher
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Watch Gmail for auto-reply |
| **Key Files** | `src/hooks/gmail-watcher.ts` |
| **Dependencies** | Google APIs |
| **Size Impact** | ~10KB code |
| **Can Cut?** | ✅ Yes if not using email |

---

### AUTO-005: Poll Watchers
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Poll external sources |
| **Key Files** | `src/automation/poll.ts` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ✅ Yes if not polling |

---

## MEMORY - Persistence & Knowledge

### MEM-001: Session Store
| | |
|---|---|
| **Status** | ✅ Required |
| **Purpose** | Conversation transcript storage |
| **Key Files** | `src/config/sessions/store.ts` |
| **Dependencies** | `proper-lockfile` |
| **Size Impact** | ~10KB code |
| **Can Cut?** | ❌ No - required |

**Storage:** JSONL files at `~/.openclaw/agents/<id>/sessions/`

---

### MEM-002: Context Compaction
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Summarize long conversations |
| **Key Files** | `src/agents/compaction.ts` |
| **Dependencies** | Pi runtime |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ⚠️ Careful - prevents context overflow |

---

### MEM-003: Vector Memory (sqlite-vec)
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Semantic search over memories |
| **Key Files** | `src/memory/` |
| **Dependencies** | `sqlite-vec` |
| **Size Impact** | ~20MB node_modules |
| **Can Cut?** | ✅ Yes if not using memory search |

---

### MEM-004: LanceDB Memory
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Alternative vector backend |
| **Key Files** | `extensions/memory-lancedb/` |
| **Dependencies** | `@lancedb/lancedb` |
| **Size Impact** | ~30MB node_modules |
| **Can Cut?** | ✅ Yes - alternative to sqlite-vec |

---

## PLATFORM - Deployment Targets

### PLAT-001: macOS App
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Native macOS menu bar app |
| **Key Files** | `apps/macos/` |
| **Dependencies** | Swift, SwiftUI |
| **Size Impact** | ~50MB built app |
| **Can Cut?** | ✅ Yes if CLI-only |

**Features:**
- Menu bar icon
- System notifications
- Auto-start on login
- Voice wake support

---

### PLAT-002: iOS App
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Native iOS app |
| **Key Files** | `apps/ios/` |
| **Dependencies** | Swift, SwiftUI |
| **Size Impact** | ~30MB built app |
| **Can Cut?** | ✅ Yes if not on iOS |

---

### PLAT-003: Android App
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Native Android app |
| **Key Files** | `apps/android/` |
| **Dependencies** | Kotlin, Gradle |
| **Size Impact** | ~20MB built APK |
| **Can Cut?** | ✅ Yes if not on Android |

---

### PLAT-004: Linux Service
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | systemd user service |
| **Key Files** | `src/daemon/` |
| **Dependencies** | systemd |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ✅ Yes if manual start |

---

### PLAT-005: Windows Service
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Windows background service |
| **Key Files** | `src/daemon/` |
| **Dependencies** | Windows APIs |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ✅ Yes if not on Windows |

---

### PLAT-006: Docker
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Containerized deployment |
| **Key Files** | `Dockerfile`, `docker-compose.yml` |
| **Dependencies** | Docker |
| **Size Impact** | ~500MB image |
| **Can Cut?** | ✅ Yes if not using Docker |

---

## UI - User Interfaces

### UI-001: TUI (Terminal UI)
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Interactive terminal interface |
| **Key Files** | `src/tui/` |
| **Dependencies** | `@mariozechner/pi-tui` |
| **Size Impact** | Included in Pi |
| **Can Cut?** | ✅ Yes if CLI-only |

**Features:**
- Chat interface in terminal
- Tool execution visualization
- Session switching

---

### UI-002: Control UI (Web)
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Web dashboard for management |
| **Key Files** | `ui/control-ui/` |
| **Dependencies** | Lit, Rolldown |
| **Size Impact** | ~5MB built |
| **Can Cut?** | ✅ Yes if CLI-only |

---

### UI-003: WebChat
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Browser-based chat interface |
| **Key Files** | `ui/webchat/`, `extensions/webchat/` |
| **Dependencies** | Web components |
| **Size Impact** | ~2MB built |
| **Can Cut?** | ✅ Yes if using native channels |

---

## SECURITY - Access Control

### SEC-001: Pairing System
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Approve new contacts before they can message |
| **Key Files** | `src/pairing/`, `src/security/` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~10KB code |
| **Can Cut?** | ⚠️ Careful - open mode is risky |

**Modes:**
- `pairing` - Require explicit approval
- `open` - Allow all contacts
- `allowlist` - Only specific contacts

---

### SEC-002: Allowlist/Denylist
| | |
|---|---|
| **Status** | 🔶 Recommended |
| **Purpose** | Control who can interact |
| **Key Files** | `src/security/allowlist.ts` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ⚠️ Careful - security feature |

---

### SEC-003: Sandbox Mode
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Restrict agent capabilities |
| **Key Files** | `src/sandbox/` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ✅ Yes if trusting agent |

**Features:**
- Disable bash execution
- Restrict file access
- Limit tool availability

---

### SEC-004: Approval Queue
| | |
|---|---|
| **Status** | ⬜ Optional |
| **Purpose** | Human approval for dangerous actions |
| **Key Files** | `src/commands/approvals.ts` |
| **Dependencies** | None (internal) |
| **Size Impact** | ~5KB code |
| **Can Cut?** | ✅ Yes if auto-approve |

---

## OPTIONAL - Cut Candidates

### OPT-001: Media Pipeline
| | |
|---|---|
| **Status** | 📦 Cut Candidate |
| **Purpose** | Image/audio/document processing |
| **Key Files** | `src/media/`, `src/media-understanding/` |
| **Dependencies** | `sharp`, `pdfjs-dist`, `@napi-rs/canvas` |
| **Size Impact** | ~150MB node_modules |
| **Can Cut?** | ✅ Yes - significant savings |

**Features:**
- Image resizing/conversion
- PDF text extraction
- Audio transcription
- Document parsing

**Recommendation:** Extract to optional plugin

---

### OPT-002: Link Understanding
| | |
|---|---|
| **Status** | ⬜ Cut Candidate |
| **Purpose** | Extract content from URLs |
| **Key Files** | `src/link-understanding/` |
| **Dependencies** | `linkedom`, `@mozilla/readability` |
| **Size Impact** | ~15MB node_modules |
| **Can Cut?** | ✅ Yes |

---

### OPT-003: Voice Call
| | |
|---|---|
| **Status** | ⬜ Cut Candidate |
| **Purpose** | Voice call integration |
| **Key Files** | `extensions/voice-call/` |
| **Dependencies** | Voice SDKs |
| **Size Impact** | ~20MB node_modules |
| **Can Cut?** | ✅ Yes |

---

### OPT-004: TTS (Text-to-Speech)
| | |
|---|---|
| **Status** | ⬜ Cut Candidate |
| **Purpose** | Spoken responses |
| **Key Files** | `src/tts/` |
| **Dependencies** | `node-edge-tts` |
| **Size Impact** | ~5MB node_modules |
| **Can Cut?** | ✅ Yes |

---

### OPT-005: Diagnostics/OpenTelemetry
| | |
|---|---|
| **Status** | ⬜ Cut Candidate |
| **Purpose** | Observability and tracing |
| **Key Files** | `extensions/diagnostics-otel/` |
| **Dependencies** | OpenTelemetry SDK |
| **Size Impact** | ~30MB node_modules |
| **Can Cut?** | ✅ Yes |

---

### OPT-006: Brave Search
| | |
|---|---|
| **Status** | ⬜ Cut Candidate |
| **Purpose** | Web search integration |
| **Key Files** | Documented in `docs/brave-search.md` |
| **Dependencies** | Brave API |
| **Size Impact** | ~1KB code |
| **Can Cut?** | ✅ Yes |

---

### OPT-007: Firecrawl
| | |
|---|---|
| **Status** | ⬜ Cut Candidate |
| **Purpose** | Web scraping service |
| **Key Files** | Documented in `docs/tools/firecrawl.md` |
| **Dependencies** | Firecrawl API |
| **Size Impact** | ~1KB code |
| **Can Cut?** | ✅ Yes |

---

## Dependency Map

### Core Dependencies (Cannot Remove)

```
@mariozechner/pi-agent-core     ← Agent runtime
@mariozechner/pi-coding-agent   ← Coding agent
@mariozechner/pi-ai             ← AI streaming
@mariozechner/pi-tui            ← TUI (if using)
commander                        ← CLI framework
express / hono                   ← HTTP server
ws                               ← WebSocket
yaml                             ← Config parsing
@sinclair/typebox               ← Schema validation
chalk                            ← Terminal colors
@clack/prompts                  ← Interactive prompts
```

### Heavy Dependencies (Cut Candidates)

```
playwright-core     ~200MB  ← Browser automation
sharp               ~100MB  ← Image processing
pdfjs-dist          ~50MB   ← PDF parsing
@aws-sdk/*          ~30MB   ← AWS Bedrock
chromium-bidi       ~30MB   ← Browser protocol
sqlite-vec          ~20MB   ← Vector search
linkedom            ~15MB   ← DOM parsing
```

### Channel Dependencies (Per-Channel)

```
grammy + @grammyjs/*           ~20MB  ← Telegram
@whiskeysockets/baileys        ~40MB  ← WhatsApp
discord-api-types + @buape/*   ~15MB  ← Discord
@slack/bolt + @slack/web-api   ~15MB  ← Slack
@line/bot-sdk                  ~5MB   ← LINE
signal-cli                     (external) ← Signal
```

---

## Minimal Viable Configuration

### "Slim Bot" Profile

**Include:**
- CORE-001 through CORE-007 (all core modules)
- MSG-001 (Telegram) OR MSG-002 (WhatsApp) - pick one
- LLM-001 (Anthropic)
- TOOL-001 (Bash)
- TOOL-002 (Files)
- AUTO-001 (Cron) - optional
- MEM-001 (Sessions)
- SEC-001 (Pairing)

**Exclude:**
- All other channels
- Browser automation (TOOL-003)
- Media pipeline (OPT-001)
- Link understanding (OPT-002)
- Voice/TTS (OPT-003, OPT-004)
- All native apps (PLAT-001 through PLAT-003)
- Web UIs (UI-002, UI-003)

**Estimated Size:** ~150MB (vs ~500MB+ full)

**Config:**
```yaml
gateway:
  port: 18789
  bind: loopback

channels:
  telegram:
    accounts:
      - bot_token: "YOUR_TOKEN"

models:
  anthropic:
    api_key: "YOUR_KEY"

agents:
  - id: main
    model: claude-3-5-sonnet

# Skip heavy features
# OPENCLAW_SKIP_BROWSER=1
# OPENCLAW_SKIP_MEDIA=1
```

---

## Build Profiles

### Profile: Personal (Recommended Starting Point)

```
[x] Gateway
[x] Pi Runtime
[x] Sessions
[x] Lane Queueing
[x] Config System
[x] CLI Framework
[x] Routing
[x] Telegram
[x] Anthropic (Claude)
[x] Bash Tools
[x] File Tools
[x] Cron Jobs
[x] Heartbeat
[x] Session Store
[x] Pairing
[ ] Everything else
```

**Use case:** Personal assistant on desktop/server

---

### Profile: Full Fat

```
[x] Everything
```

**Use case:** Maximum capability, enterprise deployment

---

### Profile: Headless Server

```
[x] Core modules
[x] Telegram + WhatsApp
[x] Claude + OpenAI
[x] All tools except browser
[x] Cron + Heartbeat
[x] Linux service
[ ] Native apps
[ ] Web UIs
[ ] Voice/TTS
```

**Use case:** Always-on server deployment

---

### Profile: Mobile Companion

```
[x] Core modules
[x] One channel (Telegram)
[x] Claude
[x] Basic tools
[x] iOS or Android app
[ ] Heavy tools (browser, media)
[ ] Automation
```

**Use case:** Mobile-first, minimal footprint

---

## Next Steps

1. **Choose your profile** - Personal is recommended starting point
2. **Mark modules to cut** - Use this doc as checklist
3. **Create slim config** - Remove unused channel configs
4. **Set skip flags** - `OPENCLAW_SKIP_BROWSER=1`, etc.
5. **Test minimal build** - Verify core functionality
6. **Iterate** - Add back modules as needed

---

## Appendix: File Index

### Source Directories

| Directory | Purpose | Size |
|-----------|---------|------|
| `src/gateway/` | WebSocket control plane | ~100KB |
| `src/agents/` | Agent runtime & tools | ~150KB |
| `src/channels/` | Channel registry | ~50KB |
| `src/config/` | Configuration system | ~80KB |
| `src/cli/` | CLI framework | ~100KB |
| `src/commands/` | CLI commands | ~80KB |
| `src/routing/` | Message routing | ~30KB |
| `src/sessions/` | Session management | ~20KB |
| `src/security/` | Access control | ~20KB |
| `src/browser/` | Browser automation | ~50KB |
| `src/media/` | Media processing | ~40KB |
| `src/media-understanding/` | Document parsing | ~30KB |
| `src/memory/` | Vector memory | ~20KB |
| `src/cron/` | Scheduled tasks | ~15KB |
| `src/hooks/` | Event hooks | ~20KB |
| `src/telegram/` | Telegram channel | ~30KB |
| `src/web/` | WhatsApp channel | ~40KB |
| `src/discord/` | Discord channel | ~25KB |
| `src/slack/` | Slack channel | ~25KB |
| `src/signal/` | Signal channel | ~20KB |
| `src/imessage/` | iMessage channel | ~15KB |
| `src/line/` | LINE channel | ~15KB |
| `src/tui/` | Terminal UI | ~20KB |

### Extension Directories

| Extension | Purpose | Cut? |
|-----------|---------|------|
| `extensions/telegram/` | Telegram plugin | Keep if using |
| `extensions/discord/` | Discord plugin | Keep if using |
| `extensions/whatsapp/` | WhatsApp plugin | Keep if using |
| `extensions/signal/` | Signal plugin | Keep if using |
| `extensions/slack/` | Slack plugin | Keep if using |
| `extensions/msteams/` | MS Teams | Cut (enterprise) |
| `extensions/matrix/` | Matrix | Cut (niche) |
| `extensions/mattermost/` | Mattermost | Cut (enterprise) |
| `extensions/twitch/` | Twitch | Cut (niche) |
| `extensions/nostr/` | Nostr | Cut (niche) |
| `extensions/tlon/` | Tlon/Urbit | Cut (niche) |
| `extensions/zalo/` | Zalo | Cut (regional) |
| `extensions/zalouser/` | Zalo Personal | Cut (regional) |
| `extensions/bluebubbles/` | BlueBubbles | Cut (macOS relay) |
| `extensions/nextcloud-talk/` | Nextcloud | Cut (self-hosted) |
| `extensions/memory-lancedb/` | LanceDB | Cut if using sqlite-vec |
| `extensions/voice-call/` | Voice | Cut (heavy) |
| `extensions/diagnostics-otel/` | OTel | Cut (observability) |
| `extensions/webchat/` | WebChat | Cut if using native |
| `extensions/lobster/` | Lobster UI | Cut (theming) |

---

*Document generated from OpenClaw codebase analysis. Use as blueprint for custom builds.*

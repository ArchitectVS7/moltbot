# Containerization & Slim Bot Feasibility Assessment

> **TL;DR**: Both paths are viable. Containerization is 2-3 days of work with high confidence. Slim bot rewrite is 2-4 weeks with medium confidence but offers significant simplification.

---

## Executive Summary

| Option | Effort | Risk | Benefit |
|--------|--------|------|---------|
| **1. Docker + GUI** | 2-3 days | Low | Works today, preserves all features |
| **2. Slim Bot Rewrite** | 2-4 weeks | Medium | Simpler, faster, smaller, but loses ecosystem |

**Recommendation**: Start with Option 1 (containerization). If that still feels like "duct tape," then pursue Option 2 knowing the tradeoffs.

---

## Option 1: Containerization with Full GUI

### Current State

The existing `Dockerfile` builds a ~500MB image that:
- Compiles TypeScript to `dist/`
- Builds the control UI
- Runs as non-root `node` user
- Exposes `node dist/index.js` as entrypoint

**What's missing for "plug in APIs and go":**

1. **No web UI exposed by default** - Gateway binds to `loopback` only
2. **No config volume mapping** - API keys have nowhere to persist
3. **No compose file** - Have to wire up ports/volumes manually
4. **Stream reasoning works** - Just needs UI to display it

### What "Stream Fork" Actually Means

This isn't a git fork - it's the **ReasoningLevel** feature:

```typescript
type ReasoningLevel = "off" | "on" | "stream";
```

- `"off"` - Don't show agent's thinking
- `"on"` - Show thinking after it completes (batched)
- `"stream"` - Stream thinking in real-time as it happens

**Good news**: This is fully implemented and works in both CLI and web interfaces. No risk of breaking it.

### Proposed Docker Solution

```
moltbot/
├── docker-compose.yml          # Main compose file
├── docker-compose.override.yml # Local dev overrides
├── .env.example                # Template for API keys
└── Dockerfile                  # (existing, minor tweaks)
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  openclaw:
    build: .
    ports:
      - "18789:18789"    # Gateway WebSocket + HTTP
      - "3000:3000"      # Control UI (optional)
    volumes:
      - openclaw-data:/home/node/.openclaw
      - ./config.yml:/home/node/.openclaw/config.yml:ro
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
    restart: unless-stopped
    # Health check for the gateway
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  openclaw-data:
```

**.env.example:**
```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional - add channels as needed
TELEGRAM_BOT_TOKEN=123456:ABC...
OPENAI_API_KEY=sk-...
```

### Changes Required

| Change | Effort | Files |
|--------|--------|-------|
| Add `docker-compose.yml` | 30 min | New file |
| Add `.env.example` | 10 min | New file |
| Update Dockerfile for bind=lan | 10 min | `Dockerfile` |
| Add health endpoint if missing | 1 hour | `src/gateway/` |
| Document quick start | 1 hour | `docs/docker.md` |
| **Total** | **~3 hours** | 4-5 files |

### Full GUI Without SSH/Localhost

The Control UI is already a web dashboard. The fix is simple:

1. **Bind to `0.0.0.0`** instead of `127.0.0.1`:
   ```yaml
   gateway:
     bind: lan  # or 'auto'
     controlUi:
       enabled: true
   ```

2. **Expose port in Docker**:
   ```yaml
   ports:
     - "18789:18789"
   ```

3. **Access from browser**: `http://docker-host:18789`

The Control UI provides:
- Chat interface with streaming
- Channel status monitoring
- Session management
- Configuration editing
- Real-time logs

### Complexity Assessment

| Aspect | Before | After |
|--------|--------|-------|
| Install | `npm install -g openclaw` + onboard wizard | `docker compose up` |
| Config | `~/.openclaw/config.yml` with 50+ options | Single `.env` file for basics |
| Upgrade | `npm update -g openclaw` | `docker compose pull && up -d` |
| Logs | Multiple places | `docker compose logs -f` |
| State | `~/.openclaw/` scattered | Single named volume |

### Verdict: Containerization

**Effort**: 2-3 days (including testing and docs)
**Risk**: Low - no architectural changes
**Preserves**: All features, stream reasoning, multi-channel, tools

---

## Option 2: Slim Bot Rewrite

### What You'd Keep

From SPEC-MODULAR.md, the "Minimal Viable Configuration":

| Component | Purpose | Can Simplify? |
|-----------|---------|---------------|
| **Agent Loop** | Inference + tool execution | Core - must keep |
| **Session Store** | Conversation persistence | Simplify to SQLite |
| **1 Channel** | Telegram recommended | Drop other 15+ channels |
| **Config** | YAML with 100+ options | Reduce to ~20 options |
| **Bash Tool** | Shell command execution | Keep as-is |
| **File Tools** | Read/write/edit | Keep as-is |

### What You'd Drop

| Component | Size Impact | Functionality Lost |
|-----------|-------------|-------------------|
| 15+ channel integrations | ~200MB deps | Multi-messenger |
| Browser automation | ~200MB Playwright | Web browsing tool |
| Media pipeline | ~150MB sharp/PDF | Image/audio processing |
| Vector memory | ~50MB | Semantic search |
| Skills ecosystem | ~50MB | 54 bundled integrations |
| Native apps | N/A | macOS/iOS/Android |
| Web UIs | ~10MB | Control dashboard |
| **Total** | ~650MB | Features |

### Architecture Options

#### A. TypeScript Slim (Lowest Risk)

Fork the existing code, surgically remove modules:

```
slim-bot/
├── src/
│   ├── agent/           # Pi runtime (keep)
│   ├── session/         # JSONL store (keep)
│   ├── telegram/        # Single channel (keep)
│   ├── tools/           # Bash + files (keep)
│   └── config.ts        # Simplified config
├── package.json         # ~10 deps instead of ~100
└── Dockerfile           # ~100MB image
```

**Effort**: 1-2 weeks
**Risk**: Medium (dependency untangling)
**Result**: ~100MB image, TypeScript, works

#### B. Go Rewrite (Medium Risk)

Rewrite core in Go for single binary deployment:

```go
// Core loop pseudocode
func (b *Bot) Run() {
    for msg := range b.telegram.Messages() {
        session := b.sessions.Load(msg.ChatID)
        response := b.agent.Run(session, msg.Text)
        b.telegram.Send(msg.ChatID, response)
        b.sessions.Save(session)
    }
}
```

**Pros**:
- Single ~20MB static binary
- No runtime dependencies
- Easy cross-compilation
- Goroutines for concurrency

**Cons**:
- No direct Pi runtime (need HTTP API to Claude)
- Lose tool execution sandboxing
- 2-3 weeks to rewrite core

**Libraries needed**:
- `github.com/go-telegram-bot-api/telegram-bot-api` - Telegram
- `github.com/sashabaranov/go-openai` - Anthropic-compatible
- `github.com/mattn/go-sqlite3` - Sessions
- Standard library for the rest

#### C. Rust Rewrite (Higher Risk, Best Performance)

```rust
// Core types
struct Bot {
    telegram: TelegramClient,
    sessions: SessionStore,
    agent: ClaudeAgent,
}

impl Bot {
    async fn handle_message(&self, msg: Message) -> Result<()> {
        let session = self.sessions.load(&msg.chat_id)?;
        let response = self.agent.run(&session, &msg.text).await?;
        self.telegram.send(&msg.chat_id, &response).await?;
        self.sessions.save(&session)?;
        Ok(())
    }
}
```

**Pros**:
- ~5MB static binary
- Best performance/memory
- Type safety
- async-std/tokio for concurrency

**Cons**:
- Steepest learning curve
- 3-4 weeks minimum
- Ecosystem less mature than Go

**Libraries needed**:
- `teloxide` - Telegram
- `reqwest` - HTTP for Claude API
- `rusqlite` - Sessions
- `tokio` - Async runtime
- `serde` - Serialization

#### D. Python Rewrite (Fastest, Most Flexible)

```python
# Core loop
class SlimBot:
    def __init__(self, config):
        self.telegram = TelegramBot(config.token)
        self.sessions = SessionStore(config.db_path)
        self.agent = ClaudeAgent(config.api_key)

    async def handle_message(self, msg):
        session = self.sessions.load(msg.chat_id)
        response = await self.agent.run(session, msg.text)
        await self.telegram.send(msg.chat_id, response)
        self.sessions.save(session)
```

**Pros**:
- Fastest to write (1-2 weeks)
- Rich AI/ML ecosystem
- Easy to extend
- `anthropic` official SDK

**Cons**:
- Slower runtime than Go/Rust
- Requires Python runtime (~50MB)
- GIL limits concurrency

**Libraries needed**:
- `python-telegram-bot` - Telegram
- `anthropic` - Claude API
- `sqlite3` - Built-in sessions
- `asyncio` - Concurrency

### Rewrite Comparison Matrix

| Aspect | TS Slim | Go | Rust | Python |
|--------|---------|-----|------|--------|
| **Effort** | 1-2 wk | 2-3 wk | 3-4 wk | 1-2 wk |
| **Binary size** | ~100MB | ~20MB | ~5MB | ~50MB |
| **Runtime deps** | Node | None | None | Python |
| **Ecosystem** | Good | Good | Medium | Excellent |
| **Tool execution** | Native | Shell | Shell | Shell |
| **Streaming** | Native | Manual | Manual | Native |
| **Risk** | Low | Medium | High | Low |

### What the Agent Loop Actually Does

The Pi runtime's core loop (simplified):

```
1. Load session transcript (JSONL)
2. Build messages array for API
3. Call Claude API with tools defined
4. If tool_use in response:
   a. Execute tool (bash, read_file, etc)
   b. Append tool result to messages
   c. GOTO 3
5. Extract final text response
6. Save session transcript
7. Return response to channel
```

This is ~500 lines of actual logic, buried in ~5000 lines of infrastructure. A rewrite extracts just that core.

### Tool Execution in Rewrite

The tools are simpler than they look:

```python
# Bash tool
def execute_bash(command: str, timeout: int = 30) -> str:
    result = subprocess.run(
        command, shell=True, capture_output=True,
        timeout=timeout, text=True
    )
    return result.stdout + result.stderr

# File tools
def read_file(path: str) -> str:
    return Path(path).read_text()

def write_file(path: str, content: str):
    Path(path).write_text(content)
```

The complexity in OpenClaw comes from:
- PTY support (interactive shells) - optional
- Timeout/cancellation - simple to add
- Sandboxing - skip for personal use
- Output streaming - nice-to-have

### Session Persistence

Current: JSONL files with file locking

Simpler: SQLite database

```sql
CREATE TABLE sessions (
    chat_id TEXT PRIMARY KEY,
    messages TEXT,  -- JSON array
    metadata TEXT,  -- JSON object
    updated_at TIMESTAMP
);
```

Benefits:
- Single file
- ACID transactions
- Built-in querying
- No file locking needed

### Memory System

Current: Vector embeddings with sqlite-vec or LanceDB

Simpler options:
1. **Skip it** - Just rely on conversation context
2. **Simple keyword search** - SQLite FTS5
3. **Claude's context** - 200K tokens is a lot

For personal use, option 1 or 2 is usually sufficient.

### Recommended Slim Architecture

```
slim-bot/
├── main.py (or main.go)     # Entry point
├── agent.py                  # Claude API wrapper + tool loop
├── tools.py                  # bash, read_file, write_file
├── session.py                # SQLite session store
├── telegram.py               # Single channel integration
├── config.py                 # ~20 config options
├── Dockerfile                # Multi-stage build
└── docker-compose.yml        # One-command deployment
```

**Config (slim):**
```yaml
# config.yml - that's it!
anthropic_api_key: sk-ant-...
telegram_bot_token: 123:ABC...
model: claude-sonnet-4-20250514
workspace: /data/workspace
```

### Verdict: Slim Bot Rewrite

**Effort**: 2-4 weeks depending on language choice
**Risk**: Medium - untested, needs debugging
**Loses**: Multi-channel, browser, media, skills, native apps
**Gains**: Simplicity, small footprint, full understanding of code

---

## Decision Framework

### Choose Option 1 (Containerization) if:

- You want it working this week
- You might use other channels later
- You want the web dashboard
- You don't want to maintain a fork
- The 500MB image size is acceptable

### Choose Option 2 (Slim Rewrite) if:

- You only need one channel (Telegram)
- You want to truly understand the system
- You might release it to others
- You want minimal attack surface
- You enjoy building things from scratch

### Hybrid Approach

1. **Week 1**: Do Option 1 (containerization)
2. **Use it for a month** - Understand what you actually use
3. **Week 2-4**: If still "duct tape feeling," do Option 2

This gives you working bot immediately while you plan the rewrite.

---

## Appendix: Quick Start Paths

### Path A: Containerization (3 hours)

```bash
# 1. Clone and create compose file
cd moltbot
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  openclaw:
    build: .
    ports:
      - "18789:18789"
    volumes:
      - openclaw-data:/home/node/.openclaw
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
    restart: unless-stopped
volumes:
  openclaw-data:
EOF

# 2. Create env file
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
echo "TELEGRAM_BOT_TOKEN=123:ABC..." >> .env

# 3. Build and run
docker compose up -d

# 4. Open browser
open http://localhost:18789
```

### Path B: Minimal Python Bot (1 week)

See separate design doc: `SLIM-BOT-PYTHON-SPEC.md` (to be created)

### Path C: Go Single Binary (2 weeks)

See separate design doc: `SLIM-BOT-GO-SPEC.md` (to be created)

---

## Stream Reasoning: How It Works

Since you mentioned this specifically, here's how streaming works and why it won't break:

### The Flow

```
User sends message
    ↓
Agent starts inference (Claude API with stream=true)
    ↓
Claude streams thinking tokens → captured as "reasoning"
    ↓
Claude decides to call tool → streamed as tool_use
    ↓
Tool executes → result captured
    ↓
Claude continues thinking → more reasoning tokens
    ↓
Claude outputs final response → streamed as text
    ↓
All streams assembled and delivered
```

### Config Options

```yaml
agents:
  - id: main
    reasoning: stream  # "off" | "on" | "stream"
    thinking: medium   # Controls depth of reasoning
```

### Where It's Implemented

- `src/auto-reply/thinking.ts` - Reasoning level normalization
- `src/agents/pi-embedded-subscribe.ts` - Stream assembly
- `src/tui/tui-stream-assembler.ts` - TUI display
- `src/telegram/draft-stream.ts` - Telegram streaming
- `src/gateway/server-chat.ts` - WebSocket broadcasting

### Why Containerization Won't Break It

The streaming is purely application-level:
1. Claude API returns Server-Sent Events
2. Application parses and routes them
3. WebSocket/HTTP broadcasts to clients

Docker just wraps this - no networking changes affect the stream parsing.

---

*Assessment complete. Both paths are viable. Choose based on your priorities.*

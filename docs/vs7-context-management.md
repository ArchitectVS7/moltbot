# VS7 Context Management System

## Overview

The VS7 context management system provides token-aware budget allocation for OpenClaw's context window, replacing the previous turn-based history limiting (VS6) with a more efficient token-based approach.

## Architecture

### Components

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| `ContextBudgetManager` | `src/agents/context-budget.ts` | Token budget allocation | Integrated |
| `RollingSummarizer` | `src/agents/rolling-summary.ts` | Conversation summarization | Integrated |
| `SemanticHistoryRetriever` | `src/agents/semantic-history.ts` | Semantic retrieval | Integrated |
| `attempt.ts` | `src/agents/pi-embedded-runner/run/attempt.ts` | Main integration point | Updated |

### Budget Allocation

The context window is divided into four regions:

```
+---------------------------+
|   System Prompt (15%)     |  <- Instructions, tools, runtime info
+---------------------------+
|   Bootstrap Files (10%)   |  <- SOUL.md, MEMORY.md, TOOLS.md, etc.
+---------------------------+
|   History (45%)           |  <- Conversation history
+---------------------------+
|   Response Buffer (20%)   |  <- Reserved for model response
+---------------------------+
|   Reserve (10%)           |  <- Unallocated buffer
+---------------------------+
```

Default ratios (configurable):
- `systemPromptRatio`: 0.15 (15%)
- `bootstrapRatio`: 0.10 (10%)
- `historyRatio`: 0.45 (45%)
- `responseRatio`: 0.20 (20%)
- `minResponseTokens`: 4096

### Configuration

Enable via `config.yaml`:

```yaml
agents:
  defaults:
    contextManagement:
      enabled: true
      budget:
        systemPromptRatio: 0.15
        bootstrapRatio: 0.10
        historyRatio: 0.45
        responseRatio: 0.20
        minResponseTokens: 4096
      rollingSummary:
        enabled: true           # NEW: Now integrated
        windowSize: 5           # Keep last 5 user turns verbatim
        summaryMaxTokens: 2000  # Max tokens for summary text
        triggerThreshold: 30000 # Summarize when history > 30k tokens
      semanticHistory:
        enabled: true           # NEW: Now integrated
        maxRetrievedChunks: 5   # Max relevant chunks to retrieve
        minRelevanceScore: 0.6  # Minimum similarity score
```

## How It Works

### 1. Bootstrap File Budget Enforcement

When `contextManagement.enabled === true`:

1. Compute total bootstrap token budget: `bootstrapRatio * contextWindow`
2. Convert to character limit: `bootstrapTokens * 4` (4 chars/token heuristic)
3. Pass character limit to `resolveBootstrapContextForRun()`
4. Each bootstrap file is truncated if it exceeds the per-file limit

**Example** (200k context window):
- Bootstrap budget: 200,000 * 0.10 = 20,000 tokens
- Character limit: 20,000 * 4 = 80,000 chars (per file)

### 2. Semantic History Retrieval (NEW)

When `contextManagement.semanticHistory.enabled === true`:

1. Get memory search manager for the current agent
2. Search for relevant prior context using the current prompt as query
3. Budget: Uses 30% of bootstrap budget for semantic history
4. Retrieved chunks are injected into the system prompt via `extraSystemPrompt`
5. Chunks are formatted with `<relevant-prior-context>` tags

**Example output in system prompt:**
```xml
<relevant-prior-context>
<context source="memory/2024-01-15.md" score="0.85">
User discussed project architecture decisions...
</context>
</relevant-prior-context>
```

### 3. History Budget Enforcement

After bootstrap files and system prompt are built:

1. Measure actual token usage for system prompt and bootstrap
2. Reclaim unused budget from system prompt and bootstrap
3. Compute final history budget: `base + reclaimed + reserve`
4. Limit history to fit within budget while preserving recent turns

### 4. Rolling Summarization (NEW)

When `contextManagement.rollingSummary.enabled === true`:

1. Check if history tokens exceed `triggerThreshold` (default: 30k)
2. If triggered, get API key from model registry
3. Split messages: keep last `windowSize` user turns (default: 5) verbatim
4. Summarize older messages using the configured model
5. Inject summary as a leading context message
6. On failure, falls back to truncation without summary

**Example summary injection:**
```
[Prior conversation summary - for context only, do not respond to this]

<prior-conversation-summary>
The user has been working on implementing a new authentication system.
Key decisions made:
- Using JWT tokens for session management
- Storing refresh tokens in HTTP-only cookies
...
</prior-conversation-summary>
```

### 5. Dynamic Reallocation

If system prompt or bootstrap use fewer tokens than budgeted, the unused allocation is reallocated to history:

```
historyBudget = base_history_budget
              + max(0, systemPrompt_budget - systemPrompt_actual)
              + max(0, bootstrap_budget - bootstrap_actual)
              + reserve
```

## Integration Points

### `attempt.ts` Flow

```
1. Check contextManagementEnabled early (line 193)
2. If enabled: compute bootstrap budget from context window
3. Pass maxCharsOverride to resolveBootstrapContextForRun()
4. If semanticHistory.enabled: retrieve relevant prior context
5. Build system prompt with bootstrap + semantic history context
6. Validate/sanitize session history
7. If rollingSummary.enabled: summarize older messages
8. Limit history by tokens (preserving recent turns)
9. Inject rolling summary as leading context message
10. Else: fallback to VS6 turn-based limiting
```

### Key Files Modified

- `src/agents/bootstrap-files.ts`: Added `maxCharsOverride` parameter
- `src/agents/pi-embedded-runner/run/attempt.ts`:
  - Early budget computation
  - Semantic history retrieval integration
  - Rolling summarization integration

## Verification Logging

### Bootstrap Budget
```
context management: bootstrap budget=20000 tokens, maxChars=80000
```

### Semantic History
```
semantic history: retrieved 3 chunks, 1500 tokens
```

### Rolling Summary
```
rolling summary: triggering summarization for 47 messages
rolling summary: summarized 35 messages, kept 12, totalTokens=8500
rolling summary: injected summary as leading context message
```

### Final Stats
```
context management: contextWindow=200000 systemPrompt=8500 bootstrap=3200 historyBudget=110300 messagesIn=47 messagesOut=12 (with rolling summary)
```

## Comparison: VS6 vs VS7

| Feature | VS6 | VS7 |
|---------|-----|-----|
| History limiting | Turn-based | Token-based |
| Bootstrap limiting | Static `bootstrapMaxChars` | Dynamic per-model |
| Budget allocation | None | Ratio-based |
| Unused budget | Wasted | Reallocated to history |
| Model awareness | No | Yes (uses contextWindow) |
| Rolling summarization | No | Yes (optional) |
| Semantic history | No | Yes (optional) |

## Dependencies

### Semantic History
- Requires memory search to be configured (`memorySearch.enabled: true`)
- Uses existing memory index with embeddings
- No additional API calls required (uses pre-computed embeddings)

### Rolling Summarization
- Requires valid API key for the configured model
- Makes LLM API calls to generate summaries
- Adds latency when triggered (only on threshold breach)
- Falls back gracefully if API key unavailable

## Error Handling

Both features are designed to fail gracefully:

1. **Semantic History Failure**: Logs warning, continues without retrieved context
2. **Rolling Summary Failure**: Logs warning, falls back to standard truncation
3. **Missing API Key**: Logs warning, skips summarization
4. **Memory Manager Unavailable**: Continues without semantic retrieval

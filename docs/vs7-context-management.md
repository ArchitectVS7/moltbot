# VS7 Context Management System

## Overview

The VS7 context management system provides token-aware budget allocation for OpenClaw's context window, replacing the previous turn-based history limiting (VS6) with a more efficient token-based approach.

## Architecture

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `ContextBudgetManager` | `src/agents/context-budget.ts` | Token budget allocation |
| `RollingSummarizer` | `src/agents/rolling-summary.ts` | Conversation summarization |
| `SemanticHistoryRetriever` | `src/agents/semantic-history.ts` | Semantic retrieval |
| `attempt.ts` | `src/agents/pi-embedded-runner/run/attempt.ts` | Main integration point |

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
        enabled: false          # Not yet integrated
        windowSize: 5
        summaryMaxTokens: 2000
        triggerThreshold: 30000
      semanticHistory:
        enabled: false          # Not yet integrated
        maxRetrievedChunks: 5
        minRelevanceScore: 0.6
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

### 2. History Budget Enforcement

After bootstrap files and system prompt are built:

1. Measure actual token usage for system prompt and bootstrap
2. Reclaim unused budget from system prompt and bootstrap
3. Compute final history budget: `base + reclaimed + reserve`
4. Limit history to fit within budget while preserving recent turns

### 3. Dynamic Reallocation

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
1. Check contextManagementEnabled early
2. If enabled: compute bootstrap budget from context window
3. Pass maxCharsOverride to resolveBootstrapContextForRun()
4. Build system prompt with (now budget-limited) context files
5. Validate/sanitize session history
6. If enabled: limit history by tokens (preserving recent turns)
7. Else: fallback to VS6 turn-based limiting
```

### Key Files Modified

- `src/agents/bootstrap-files.ts`: Added `maxCharsOverride` parameter
- `src/agents/pi-embedded-runner/run/attempt.ts`: Early budget computation

## Future Work

### Rolling Summarization (Not Yet Integrated)

The `RollingSummarizer` class is implemented but not yet called in `attempt.ts`. When integrated:

1. Keep last N turns verbatim (default: 5)
2. Summarize older conversation into compact form
3. Inject summary as system context

### Semantic History Retrieval (Not Yet Integrated)

The `SemanticHistoryRetriever` class is implemented but not yet called. When integrated:

1. Use embeddings to find relevant past context
2. Inject up to N relevant chunks (default: 5)
3. Filter by minimum relevance score (default: 0.6)

## Testing

Verify context management is working by checking log output:

```
context management: bootstrap budget=20000 tokens, maxChars=80000
context management: contextWindow=200000 systemPrompt=8500 bootstrap=3200 historyBudget=110300 messagesIn=47 messagesOut=32
```

## Comparison: VS6 vs VS7

| Feature | VS6 | VS7 |
|---------|-----|-----|
| History limiting | Turn-based | Token-based |
| Bootstrap limiting | Static `bootstrapMaxChars` | Dynamic per-model |
| Budget allocation | None | Ratio-based |
| Unused budget | Wasted | Reallocated to history |
| Model awareness | No | Yes (uses contextWindow) |

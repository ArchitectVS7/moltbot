# PR: VS7 Context Management System - Full Integration

## Summary

Completes the VS7 context management system by:
1. Fixing bootstrap budget enforcement (workspace files were not being token-capped)
2. Integrating semantic history retrieval from memory index
3. Integrating rolling summarization for long conversations

## Problem

When `contextManagement.enabled: true` was set in config, the system was:

- **Partially working**: History limiting based on token budget worked
- **Not working**: Bootstrap files (SOUL.md, MEMORY.md, etc.) still injected in full
- **Not integrated**: Rolling summarization and semantic history were implemented but not wired up

### Root Cause

In `attempt.ts`, the context management modules existed but weren't properly integrated:
1. Bootstrap budget was computed but not passed to file resolution
2. Rolling summarization class existed but wasn't called
3. Semantic history class existed but wasn't called

## Solution

### 1. Bootstrap Budget Enforcement

Added `maxCharsOverride` parameter to `resolveBootstrapContextForRun()` and computed dynamic character limit from token budget:

```typescript
const budget = budgetManager.computeBudget(contextWindow);
bootstrapMaxCharsOverride = budget.bootstrap * 4; // 4 chars/token
```

### 2. Semantic History Retrieval

Integrated `SemanticHistoryRetriever` to fetch relevant prior context:

```typescript
if (semanticHistoryEnabled && params.config) {
  const { manager: memoryManager } = await getMemorySearchManager({ cfg, agentId });
  if (memoryManager) {
    const semanticResult = await semanticRetriever.retrieve(
      params.prompt,
      memorySearchAdapter,
      semanticBudget,
    );
    // Inject into extraSystemPrompt
  }
}
```

### 3. Rolling Summarization

Integrated `RollingSummarizer` to summarize older conversation when threshold exceeded:

```typescript
if (rollingSummaryEnabled && rollingSummarizer.shouldSummarize(validated, historyBudget)) {
  const apiKey = await params.modelRegistry.getApiKey(params.model);
  const summaryResult = await rollingSummarizer.buildContextWithSummary({
    messages: validated,
    budget: historyBudget,
    model: params.model,
    apiKey,
    signal: runAbortController.signal,
  });
  // Inject summary as leading context message
}
```

## Files Changed

### `src/agents/bootstrap-files.ts`
- Added optional `maxCharsOverride` parameter to `resolveBootstrapContextForRun()`

### `src/agents/pi-embedded-runner/run/attempt.ts`
- Added imports for `rolling-summary.ts`, `semantic-history.ts`, `memory/index.ts`
- Moved `contextManagementEnabled` check to line 193 (early in setup)
- Added semantic history retrieval before system prompt build (lines 376-427)
- Added rolling summarization in history limiting section (lines 666-731)
- Added summary injection as leading context message (lines 754-763)

### `docs/vs7-context-management.md`
- Updated to reflect all features are now integrated
- Added documentation for semantic history and rolling summarization
- Added verification logging section

### `docs/vs7-testing-guide.md` (NEW)
- Comprehensive test specifications
- UAT checklist
- Troubleshooting guide

## Configuration

No config changes required. Existing configs work with new defaults:

```yaml
agents:
  defaults:
    contextManagement:
      enabled: true
      budget:
        bootstrapRatio: 0.10
      rollingSummary:
        enabled: true   # Optional, disabled by default
        windowSize: 5
        triggerThreshold: 30000
      semanticHistory:
        enabled: true   # Optional, disabled by default
        maxRetrievedChunks: 5
        minRelevanceScore: 0.6
```

## Expected Behavior After Fix

For a 200k context window:

| Feature | Before | After |
|---------|--------|-------|
| Bootstrap budget | Ignored | Enforced (20k tokens) |
| Semantic history | Not available | Retrieved from memory |
| Rolling summary | Not available | Summarizes older messages |

## Verification

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

## Breaking Changes

None. All features are opt-in:
- `contextManagement.enabled` must be true for any VS7 features
- `rollingSummary.enabled` must be true for summarization
- `semanticHistory.enabled` must be true for retrieval

## Error Handling

All new features fail gracefully:
- Missing memory manager: Logs warning, continues without semantic history
- Missing API key: Logs warning, falls back to truncation
- Summarization failure: Logs warning, falls back to truncation

## Testing

See `docs/vs7-testing-guide.md` for:
- 5 test suites with 12+ test cases
- UAT checklist with 20+ verification points
- Troubleshooting guide

## Related Issues

- VS7 context management not reducing token usage
- Full workspace file injection every prompt
- No rolling summarization despite config

## Dependencies

### Semantic History
- Requires `memorySearch.enabled: true`
- Uses existing memory index infrastructure

### Rolling Summarization
- Requires valid API key for configured model
- Uses existing compaction summarization infrastructure

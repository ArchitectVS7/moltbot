# PR: Fix VS7 Context Management Bootstrap Budget Enforcement

## Summary

Fixes the VS7 context management system to properly enforce token budgets on bootstrap/workspace files (SOUL.md, MEMORY.md, TOOLS.md, etc.).

## Problem

When `contextManagement.enabled: true` was set in config, the system was:

- **Correctly** limiting conversation history based on token budget
- **Incorrectly** still injecting full workspace files regardless of budget

The bootstrap files were being resolved with a static `bootstrapMaxChars` limit (default 20k chars) instead of the configured `bootstrapRatio` budget.

### Root Cause

In `attempt.ts`, the flow was:

```
1. resolveBootstrapContextForRun() ← uses static maxChars
2. buildEmbeddedSystemPrompt({ contextFiles }) ← injects FULL files
3. contextManagementEnabled check ← ONLY limits history
```

The context management check happened **after** bootstrap files were already resolved with the static limit.

## Solution

1. **Added `maxCharsOverride` parameter** to `resolveBootstrapContextForRun()` in `bootstrap-files.ts`

2. **Moved context management check earlier** in `attempt.ts` to compute bootstrap budget before resolving files

3. **Compute dynamic character limit** from token budget:
   ```typescript
   const budget = budgetManager.computeBudget(contextWindow);
   bootstrapMaxCharsOverride = budget.bootstrap * 4; // 4 chars/token
   ```

## Files Changed

- `src/agents/bootstrap-files.ts`
  - Added optional `maxCharsOverride` parameter to `resolveBootstrapContextForRun()`

- `src/agents/pi-embedded-runner/run/attempt.ts`
  - Moved `contextManagementEnabled` check to line 193 (early in run setup)
  - Compute bootstrap budget from context window before resolving files
  - Pass `maxCharsOverride` to `resolveBootstrapContextForRun()`

## Configuration

No config changes required. Existing configs with `contextManagement.enabled: true` will now correctly enforce bootstrap budgets.

```yaml
agents:
  defaults:
    contextManagement:
      enabled: true
      budget:
        bootstrapRatio: 0.10  # 10% of context window
```

## Expected Behavior After Fix

For a 200k context window with `bootstrapRatio: 0.10`:

| Metric | Before Fix | After Fix |
|--------|------------|-----------|
| Bootstrap budget | Ignored | 20,000 tokens |
| Per-file char limit | 20,000 (static) | 80,000 (dynamic) |
| Budget enforcement | None | Yes |

## Verification

Check logs for budget enforcement:

```
context management: bootstrap budget=20000 tokens, maxChars=80000
```

## Breaking Changes

None. This is a bug fix that makes the existing config option work as documented.

## Related Issues

- VS7 context management not reducing token usage
- Full workspace file injection every prompt
- No evidence of token budget enforcement

## Testing

1. Enable `contextManagement.enabled: true` in config
2. Start a conversation
3. Verify logs show budget computation
4. Verify bootstrap files are truncated when exceeding budget

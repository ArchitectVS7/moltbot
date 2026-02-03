# VS7 Context Management Testing Guide

## Overview

This guide provides test specifications and User Acceptance Testing (UAT) steps for validating the VS7 context management system.

---

## Prerequisites

### Configuration Setup

Create or update `config.yaml` with the following test configuration:

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
      rollingSummary:
        enabled: true
        windowSize: 5
        summaryMaxTokens: 2000
        triggerThreshold: 10000  # Lower threshold for testing
      semanticHistory:
        enabled: true
        maxRetrievedChunks: 5
        minRelevanceScore: 0.6

    # Required for semantic history
    memorySearch:
      enabled: true
```

### Log Level

Set debug logging to see VS7 output:

```bash
export OPENCLAW_LOG_LEVEL=debug
```

---

## Test Suite 1: Bootstrap Budget Enforcement

### Test 1.1: Bootstrap Files Are Token-Capped

**Objective**: Verify that workspace files are truncated based on the configured bootstrap budget ratio.

**Setup**:
1. Create a large `MEMORY.md` file (>100k characters)
2. Enable `contextManagement.enabled: true`
3. Set `bootstrapRatio: 0.05` (5% of context window)

**Steps**:
1. Start a new conversation
2. Send a simple prompt: "Hello, what do you know about me?"

**Expected Results**:
- Log shows: `context management: bootstrap budget=XXXXX tokens, maxChars=XXXXX`
- `maxChars` should be approximately `contextWindow * 0.05 * 4`
- MEMORY.md content is truncated with marker: `[...truncated, read MEMORY.md for full content...]`

**Verification Command**:
```bash
grep "bootstrap budget" /path/to/logs | head -5
```

### Test 1.2: Small Files Not Truncated

**Objective**: Verify that small files below the budget are not truncated.

**Setup**:
1. Create a small `MEMORY.md` file (<1000 characters)
2. Enable `contextManagement.enabled: true`

**Steps**:
1. Start a new conversation
2. Send any prompt

**Expected Results**:
- No truncation warning in logs
- Full file content is injected

---

## Test Suite 2: Semantic History Retrieval

### Test 2.1: Relevant Context Retrieved

**Objective**: Verify that semantic history retrieves relevant prior context.

**Setup**:
1. Enable `memorySearch.enabled: true`
2. Enable `contextManagement.semanticHistory.enabled: true`
3. Add content to `memory/` directory with distinctive topics

**Precondition**: Memory index must be populated (run a sync first)

**Steps**:
1. Start a new conversation
2. Send a prompt related to content in memory files
   - Example: "What did we discuss about authentication?"

**Expected Results**:
- Log shows: `semantic history: retrieved X chunks, Y tokens`
- Retrieved context appears in system prompt
- Agent response references prior context appropriately

**Verification Command**:
```bash
grep "semantic history" /path/to/logs | head -5
```

### Test 2.2: No Memory Manager Fallback

**Objective**: Verify graceful fallback when memory search is unavailable.

**Setup**:
1. Enable `contextManagement.semanticHistory.enabled: true`
2. Disable `memorySearch.enabled: false`

**Steps**:
1. Start a new conversation
2. Send any prompt

**Expected Results**:
- No crash or error
- Log may show: `semantic history retrieval failed` (warning)
- Conversation continues normally without semantic context

### Test 2.3: Below Relevance Threshold

**Objective**: Verify chunks below relevance threshold are filtered.

**Setup**:
1. Set `minRelevanceScore: 0.9` (high threshold)
2. Enable semantic history

**Steps**:
1. Send a prompt unrelated to memory content

**Expected Results**:
- Log shows retrieval attempted
- `retrieved 0 chunks` or minimal chunks due to high threshold

---

## Test Suite 3: Rolling Summarization

### Test 3.1: Summarization Triggers on Threshold

**Objective**: Verify that rolling summarization triggers when history exceeds threshold.

**Setup**:
1. Enable `rollingSummary.enabled: true`
2. Set `triggerThreshold: 5000` (low threshold for testing)
3. Set `windowSize: 3` (keep only 3 recent turns)

**Steps**:
1. Start a new conversation
2. Exchange 10+ messages to build up history
3. Continue conversation until threshold is exceeded

**Expected Results**:
- Log shows: `rolling summary: triggering summarization for X messages`
- Log shows: `rolling summary: summarized Y messages, kept Z`
- Log shows: `rolling summary: injected summary as leading context message`
- Conversation continues with context preserved

**Verification Command**:
```bash
grep "rolling summary" /path/to/logs | head -10
```

### Test 3.2: Recent Turns Preserved

**Objective**: Verify that the last N turns are kept verbatim.

**Setup**:
1. Set `windowSize: 5`
2. Trigger summarization (exceed threshold)

**Steps**:
1. Build up conversation history
2. Note the last 5 user messages
3. Trigger summarization

**Expected Results**:
- The last 5 user turns are preserved exactly
- Only older messages are summarized
- Log shows `kept X` where X corresponds to recent messages

### Test 3.3: Missing API Key Fallback

**Objective**: Verify graceful fallback when API key is unavailable.

**Setup**:
1. Enable rolling summary
2. Remove or invalidate API key for the model

**Steps**:
1. Build up history to exceed threshold

**Expected Results**:
- Log shows: `rolling summary: no API key available, skipping summarization`
- History is truncated without summary (standard behavior)
- No crash

### Test 3.4: Summarization Failure Fallback

**Objective**: Verify graceful fallback when summarization API call fails.

**Setup**:
1. Enable rolling summary
2. Simulate API failure (network issues, quota exceeded)

**Steps**:
1. Build up history to exceed threshold

**Expected Results**:
- Log shows: `rolling summary failed, falling back to truncation`
- History is truncated without summary
- Conversation continues

---

## Test Suite 4: Budget Allocation

### Test 4.1: History Budget Reallocation

**Objective**: Verify unused budget from system prompt/bootstrap is reallocated to history.

**Setup**:
1. Enable context management
2. Use small bootstrap files (well under budget)

**Steps**:
1. Start a conversation
2. Build up history

**Expected Results**:
- Log shows `historyBudget` is higher than base allocation
- Formula: `historyBudget > contextWindow * historyRatio`

### Test 4.2: Budget Overflow Prevention

**Objective**: Verify context doesn't overflow the context window.

**Setup**:
1. Enable context management
2. Use a model with small context window (for testing)

**Steps**:
1. Build up very long conversation
2. Continue until would normally overflow

**Expected Results**:
- No context overflow errors
- History is properly limited
- `messagesOut < messagesIn` in logs

---

## Test Suite 5: Integration Tests

### Test 5.1: All Features Combined

**Objective**: Verify all VS7 features work together.

**Setup**:
```yaml
contextManagement:
  enabled: true
  rollingSummary:
    enabled: true
    triggerThreshold: 10000
  semanticHistory:
    enabled: true
memorySearch:
  enabled: true
```

**Steps**:
1. Add content to memory files
2. Start conversation
3. Reference memory content in first messages
4. Build up history to exceed threshold
5. Continue conversation

**Expected Results**:
1. Bootstrap files are budget-limited
2. Semantic history retrieves relevant context
3. Rolling summary triggers when threshold exceeded
4. All logs appear in correct order
5. Conversation maintains coherence

### Test 5.2: Feature Isolation

**Objective**: Verify features can be enabled/disabled independently.

**Matrix**:
| contextManagement | rollingSummary | semanticHistory | Expected Behavior |
|-------------------|----------------|-----------------|-------------------|
| true | true | true | All features active |
| true | true | false | No semantic retrieval |
| true | false | true | No summarization |
| true | false | false | Budget only |
| false | - | - | VS6 fallback |

**Steps**:
1. Test each configuration combination
2. Verify logs match expected behavior

---

## UAT Checklist

### Phase 1: Basic Functionality

- [ ] Gateway starts successfully with VS7 config
- [ ] First message processes without error
- [ ] Bootstrap budget log appears
- [ ] No regression in basic conversation flow

### Phase 2: Bootstrap Budget

- [ ] Large files are truncated
- [ ] Truncation marker present in context
- [ ] Small files pass through unchanged
- [ ] Budget scales with context window size

### Phase 3: Semantic History

- [ ] Memory index syncs successfully
- [ ] Relevant context is retrieved
- [ ] Context appears in system prompt
- [ ] Graceful fallback without memory manager

### Phase 4: Rolling Summary

- [ ] Summarization triggers at threshold
- [ ] Recent turns preserved (windowSize)
- [ ] Summary injected as context message
- [ ] Graceful fallback without API key
- [ ] Graceful fallback on API failure

### Phase 5: Performance

- [ ] No significant latency increase (without summarization)
- [ ] Acceptable latency when summarization triggers
- [ ] Memory usage stable over long conversations
- [ ] No token leakage (context stays within budget)

### Phase 6: Edge Cases

- [ ] Empty conversation works
- [ ] Single message conversation works
- [ ] Very long single message handled
- [ ] Rapid message succession handled
- [ ] Session resume works correctly

---

## Troubleshooting

### No Budget Logs Appearing

1. Check `contextManagement.enabled: true` in config
2. Verify config file is being loaded (check path)
3. Set `OPENCLAW_LOG_LEVEL=debug`

### Semantic History Not Working

1. Verify `memorySearch.enabled: true`
2. Check memory index exists and is populated
3. Run manual sync: check memory manager status
4. Verify `semanticHistory.enabled: true`

### Rolling Summary Not Triggering

1. Check history token count vs. `triggerThreshold`
2. Verify `rollingSummary.enabled: true`
3. Check API key is available
4. Lower `triggerThreshold` for testing

### Context Overflow Errors

1. Check `responseRatio` is sufficient (default 0.20)
2. Verify `minResponseTokens` setting
3. Review bootstrap file sizes
4. Check for very long tool outputs

---

## Reporting Issues

When reporting issues, include:

1. Configuration snippet (contextManagement section)
2. Relevant log lines (grep for "context management", "semantic history", "rolling summary")
3. Approximate conversation length
4. Model and context window size
5. Steps to reproduce

# Simple VS7 Toggle Testing Guide

## What Changed

Instead of complex WebSocket connections to two instances, we're using a **much simpler** approach:

1. **One Docker instance** with VS7 branch
2. **Toggle VS7 features** on/off in config
3. **Run tests twice** - once with VS7 enabled, once disabled
4. **Compare results**

## The Magic Toggle

VS7 has a master switch in `data/openclaw-config/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "contextManagement": {
        "enabled": true  // ← This is the switch!
      }
    }
  }
}
```

- **`enabled: true`** = VS7 mode (token-optimized with summarization)
- **`enabled: false`** = Baseline mode (standard turn-based history)

## How to Run Tests

### Quick Start

```bash
cd Dev
npm run simple -- --test-id=1.1
```

### Run Multiple Tests

```bash
npm run simple -- --test-ids=1.1,1.2,1.3
```

### Run Full Test Group

```bash
# Context Retention (5 tests)
npm run simple -- --test-ids=1.1,1.2,1.3,1.4,1.5

# Code Quality (5 tests)
npm run simple -- --test-ids=2.1,2.2,2.3,2.4,2.5

# Mixed Workload (5 tests)
npm run simple -- --test-ids=3.1,3.2,3.3,3.4,3.5
```

## What Happens

For each test:

1. **Baseline Run**:
   - Sets `contextManagement.enabled = false`
   - Restarts Docker
   - Runs all test prompts
   - Saves results to `results/session-id/{test-id}-baseline.json`

2. **VS7 Run**:
   - Sets `contextManagement.enabled = true`
   - Restarts Docker
   - Runs same test prompts
   - Saves results to `results/session-id/{test-id}-vs7.json`

3. **Comparison**:
   - Shows token usage side-by-side
   - Calculates percentage savings
   - Displays final summary

## Example Output

```
Test 1.1 Comparison:
  Baseline:  45,234 tokens
  VS7:       28,156 tokens
  Savings:   +17,078 (37.7%)

Test 1.2 Comparison:
  Baseline:  38,912 tokens
  VS7:       25,443 tokens
  Savings:   +13,469 (34.6%)

FINAL SUMMARY
Tests completed: 2
Total baseline tokens: 84,146
Total VS7 tokens: 53,599
Total savings: 30,547 (36.3%)
```

## Prerequisites

- Docker built with VS7 branch ✓ (currently building)
- Docker container running
- OpenClaw configured with test session

## Advantages

1. ✅ **No WebSocket complexity**
2. ✅ **No SSH required**
3. ✅ **One Docker instance**
4. ✅ **Direct CLI usage**
5. ✅ **Simple config toggle**
6. ✅ **Automated comparison**
7. ✅ **Way fewer tokens burned** during setup!

## Next Steps

1. Wait for Docker build to complete
2. Start Docker container
3. Run first test: `npm run simple -- --test-id=1.1`
4. Review results
5. Run full test suite if first test looks good

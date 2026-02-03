# Context Management UAT Test Harness

**Goal:** Compare VS7 context management system vs. main branch OpenClaw to validate token reduction without sacrificing quality.

## Overview

This test harness runs 15 standardized tests across two OpenClaw instances and produces comparable metrics.

**Test Categories:**
1. **Context Retention** (5 tests) - Multi-turn memory, MEMORY.md recall, task resumption
2. **Code Quality** (5 tests) - Multi-file projects, refactoring, bug fixes, API integration
3. **Mixed Workload** (5 tests) - Realistic usage patterns, long conversations, task switching

**Metrics:**
- Token usage (total, bootstrap, history, system)
- Response time per turn
- Task completion rate
- Context retention accuracy
- Code correctness (compiles/runs?)

## Prerequisites

- Node.js 18+ with npm/pnpm
- OpenClaw installed and configured
- Access to Telegram/Discord/CLI for sending test prompts

## Setup

### 1. Install Test Harness Dependencies

```bash
cd Dev
npm install
```

### 2. Configure Test Instance

Edit `test-config.json`:

```json
{
  "instanceName": "vs7",
  "openclawBinary": "openclaw",
  "sessionKey": "agent:main:main",
  "outputDir": "./results"
}
```

**For main branch:** Set `instanceName: "main"`  
**For VS7 branch:** Set `instanceName: "vs7"`

### 3. Prepare OpenClaw Instance

**Main Branch (on local machine):**
```bash
git clone https://github.com/openclaw/openclaw.git openclaw-main
cd openclaw-main
git checkout main
pnpm install
pnpm build
npm link
openclaw gateway start
```

**VS7 Branch (on cloud server):**
```bash
# Already running at /root/OpenClaw
openclaw gateway status
```

## Running Tests

### Manual Mode (Interactive)

Run tests by sending prompts via Telegram/CLI and manually recording results:

```bash
npm run test:manual -- --test-id 1.1
```

This will:
1. Display the test prompts sequentially
2. Wait for you to send each prompt to OpenClaw
3. Wait for you to confirm response received
4. Prompt for metrics (tokens used, time elapsed)
5. Save results to `results/<instance>/<test-id>.json`

### Automated Mode (OpenClaw CLI)

**Not yet implemented** - requires OpenClaw CLI session automation.

### Batch Mode

Run all tests in a category:

```bash
npm run test:batch -- --category context-retention
```

## Test Structure

Each test is defined in `test-prompts/<category>/<test-id>.json`:

```json
{
  "id": "1.1",
  "name": "Multi-Turn Memory",
  "category": "context-retention",
  "description": "Tests if agent remembers project details across 3 turns",
  "turns": [
    {
      "number": 1,
      "prompt": "I'm working on a Python project called 'DataSync'. It syncs data between PostgreSQL and MongoDB.",
      "expectedBehavior": "Acknowledges project info, may ask clarifying questions"
    },
    {
      "number": 2,
      "prompt": "Create a config file for DataSync with connection strings.",
      "expectedBehavior": "Creates config file, uses project name 'DataSync', includes Postgres + MongoDB connection strings"
    },
    {
      "number": 3,
      "prompt": "Now write the main sync logic that uses that config.",
      "expectedBehavior": "References config file from Turn 2, implements sync logic for Postgres → MongoDB"
    }
  ],
  "successCriteria": {
    "taskCompleted": "Main sync logic file created with config import",
    "contextRetained": "Uses correct project name and config structure from previous turns",
    "codeWorks": "Python syntax valid, imports correct",
    "notes": ""
  }
}
```

## Comparing Results

After running tests on both instances:

```bash
npm run compare -- results/main results/vs7
```

Output: `comparison-report.md` with:
- Token usage comparison (per test, per category, overall)
- Context retention scores
- Code quality scores
- Task completion rates
- Winner determination based on success criteria

## Success Criteria

**VS7 passes UAT if:**
- ✅ Token usage reduced by **≥20%** on average
- ✅ Context retention **≥95%** compared to main
- ✅ Code quality **equal or better** (all compilable/runnable)
- ✅ Task completion rate **≥95%**

**If any metric fails:** Tune config and re-test.

## Test Execution Log

Track your test runs in `test-log.md`:

```markdown
## 2026-02-03 - Initial Run

### Main Branch (Local Machine)
- Instance: MacBook Pro M1, macOS 14.2
- OpenClaw: main branch (commit abc123)
- Tests completed: 1.1, 1.2, 1.3
- Notes: No issues

### VS7 Branch (Cloud Server)
- Instance: ubuntu-molt-01
- OpenClaw: VS7 branch (commit 43997e5)
- Tests completed: 1.1, 1.2, 1.3
- Notes: contextManagement enabled
```

## File Structure

```
Dev/
├── README.md                          # This file
├── package.json                       # Test harness dependencies
├── test-config.json                   # Instance configuration
├── test-log.md                        # Execution tracking
├── test-prompts/                      # Test definitions
│   ├── 1-context-retention/
│   │   ├── 1.1-multi-turn-memory.json
│   │   ├── 1.2-context-switching.json
│   │   ├── 1.3-memory-md-recall.json
│   │   ├── 1.4-interrupted-task.json
│   │   └── 1.5-workspace-file-ref.json
│   ├── 2-code-quality/
│   │   ├── 2.1-multi-file-refactor.json
│   │   ├── 2.2-bug-fix.json
│   │   ├── 2.3-api-integration.json
│   │   ├── 2.4-code-review.json
│   │   └── 2.5-codebase-analysis.json
│   └── 3-mixed-workload/
│       ├── 3.1-realistic-day.json
│       ├── 3.2-learning-applying.json
│       ├── 3.3-long-conversation.json
│       ├── 3.4-emergency-interrupt.json
│       └── 3.5-knowledge-synthesis.json
├── src/
│   ├── test-runner.ts                 # Main orchestrator
│   ├── metrics-collector.ts           # Capture token/timing data
│   ├── compare-results.ts             # Analysis tool
│   └── types.ts                       # TypeScript interfaces
├── results/                           # Test output (gitignored)
│   ├── main/                          # Main branch results
│   │   ├── 1.1.json
│   │   └── ...
│   └── vs7/                           # VS7 branch results
│       ├── 1.1.json
│       └── ...
└── comparison-report.md               # Final analysis (generated)
```

## Manual Test Workflow

1. **Start test session:**
   ```bash
   npm run test:manual -- --test-id 1.1
   ```

2. **For each turn:**
   - Read the prompt displayed
   - Send it to OpenClaw (via Telegram/CLI)
   - Wait for response
   - Note token usage from response footer
   - Press Enter to continue

3. **After all turns:**
   - Answer quality questions (Y/N)
   - Result saved to `results/<instance>/1.1.json`

4. **Repeat for all 15 tests**

5. **Run comparison:**
   ```bash
   npm run compare -- results/main results/vs7
   ```

6. **Review:** Open `comparison-report.md`

## Tips

- **Run in order:** Tests are designed to be independent but build complexity
- **Fresh session:** Consider starting new OpenClaw session for each test to avoid contamination
- **Record observations:** Add notes to success criteria (edge cases, interesting behavior)
- **Token accuracy:** Copy exact token numbers from OpenClaw responses
- **Code validation:** Actually run the generated code when possible

## Troubleshoties

### "Test harness not found"
```bash
cd /root/OpenClaw/Dev
npm install
```

### "OpenClaw not responding"
```bash
openclaw gateway status
openclaw gateway restart
```

### "Results directory missing"
Automatically created on first test run.

## Contributing

To add new tests:

1. Create `test-prompts/<category>/<test-id>.json`
2. Follow the JSON schema in existing tests
3. Update this README with test count
4. Run test on both instances
5. Submit PR with test definition + results

---

**Remember:** The goal is data-driven validation. Run all tests. Compare objectively. Ship confidently.

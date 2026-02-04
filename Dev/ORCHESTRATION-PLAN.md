# OpenClaw VS7 vs Main - Automated Testing Plan

## Overview
Run automated tests in parallel using sub-agents to compare VS7 (token-optimized) vs Main (baseline).

## Test Groups

### Group 1: Context Retention (Tests 1.1-1.5)
- Tests multi-turn memory, context switching, memory.md recall, interrupted tasks, workspace file references
- **Sub-Agent 1A (VS7)**: Run on remote droplet
- **Sub-Agent 1B (Main)**: Run on local Docker

### Group 2: Code Quality (Tests 2.1-2.5)
- Tests multi-file refactor, bug fix, API integration, code review, codebase analysis
- **Sub-Agent 2A (VS7)**: Run on remote droplet
- **Sub-Agent 2B (Main)**: Run on local Docker

### Group 3: Mixed Workload (Tests 3.1-3.5)
- Tests realistic day workflow, learning & applying, long conversations, emergency interrupts, knowledge synthesis
- **Sub-Agent 3A (VS7)**: Run on remote droplet
- **Sub-Agent 3B (Main)**: Run on local Docker

## Execution Strategy

Each sub-agent will:
1. Connect to assigned OpenClaw instance via WebSocket Gateway API
2. Send test prompts programmatically
3. Capture responses, token metrics, and generated files
4. Save results to `Dev/results/session-id/instance-name/test-id/`

## Results Structure

```
Dev/results/
└── auto-{timestamp}/
    ├── vs7/
    │   ├── test-1.1/
    │   │   ├── turn-1/
    │   │   │   ├── config.py
    │   │   │   └── main.py
    │   │   ├── turn-2/
    │   │   ├── turn-3/
    │   │   └── result.json
    │   ├── test-1.2/
    │   └── ...
    └── main/
        ├── test-1.1/
        └── ...
```

## Comparison Metrics

For each test, compare:
- **Token Usage**: Total, input, output, cache creation, cache read
- **Response Time**: Latency for each turn
- **Generated Code**: Side-by-side diff of files
- **Code Quality**: Syntax validation, imports, structure
- **Context Retention**: References to previous turns
- **Task Completion**: Did it accomplish the goal?

## Success Criteria

VS7 is considered successful if:
1. **≥20% token reduction** compared to Main
2. **≥95% context retention** accuracy
3. **Quality parity**: Generated code compiles and runs
4. **No regressions**: Maintains or improves response quality

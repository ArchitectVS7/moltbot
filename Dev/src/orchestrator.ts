#!/usr/bin/env node

/**
 * Test Orchestrator - Spawns sub-agents to run tests in parallel
 *
 * Strategy:
 * - Group 1 (Context Retention): Sub-agent 1 (VS7) + Sub-agent 2 (Main)
 * - Wait for both to complete
 * - Group 2 (Code Quality): Sub-agent 3 (VS7) + Sub-agent 4 (Main)
 * - Wait for both to complete
 * - Group 3 (Mixed Workload): Sub-agent 5 (VS7) + Sub-agent 6 (Main)
 * - Wait for both to complete
 * - Generate final comparison report
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestPrompt } from './types.js';

interface TestGroup {
  name: string;
  category: string;
  testIds: string[];
}

async function loadAllTests(): Promise<TestPrompt[]> {
  const testPromptsDir = path.join(process.cwd(), 'test-prompts');
  const tests: TestPrompt[] = [];
  const categories = await fs.readdir(testPromptsDir);

  for (const category of categories) {
    const categoryPath = path.join(testPromptsDir, category);
    const stat = await fs.stat(categoryPath);
    if (!stat.isDirectory()) continue;

    const files = await fs.readdir(categoryPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const testPath = path.join(categoryPath, file);
        const content = await fs.readFile(testPath, 'utf-8');
        tests.push(JSON.parse(content) as TestPrompt);
      }
    }
  }

  return tests.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  OPENCLAW TEST ORCHESTRATOR');
  console.log('  Automated Parallel Testing: VS7 vs Main');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load all tests
  const allTests = await loadAllTests();

  // Group tests by category
  const groups: TestGroup[] = [];
  const categoriesSet = new Set(allTests.map(t => t.category));

  for (const category of categoriesSet) {
    const testsInCategory = allTests.filter(t => t.category === category);
    groups.push({
      name: category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      category,
      testIds: testsInCategory.map(t => t.id),
    });
  }

  console.log(`Found ${groups.length} test groups:\n`);
  for (let i = 0; i < groups.length; i++) {
    console.log(`  ${i + 1}. ${groups[i].name} (${groups[i].testIds.length} tests)`);
    console.log(`     Tests: ${groups[i].testIds.join(', ')}\n`);
  }

  const sessionId = `orchestrated-${Date.now()}`;

  console.log(`Session ID: ${sessionId}\n`);
  console.log('─'.repeat(60));
  console.log('\nIMPORTANT: This orchestrator will guide you to spawn sub-agents.');
  console.log('You will run Claude Code sub-agents that execute the automated runner.\n');

  // Instructions for each group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupNum = i + 1;

    console.log('\n' + '═'.repeat(60));
    console.log(`  GROUP ${groupNum}/${groups.length}: ${group.name.toUpperCase()}`);
    console.log('═'.repeat(60));

    console.log(`\nTests: ${group.testIds.join(', ')}`);
    console.log(`\nYou need to spawn 2 sub-agents in parallel for this group:\n`);

    // VS7 agent instructions
    console.log(`\n┌─ SUB-AGENT ${groupNum}A: VS7 Instance (Remote Droplet) ────────────┐`);
    console.log(`│`);
    console.log(`│  Description: Run ${group.name} tests on VS7 branch`);
    console.log(`│`);
    console.log(`│  Prompt to use:`);
    console.log(`│  ────────────────────────────────────────────────────────────`);
    console.log(`│  Run the automated test runner on the VS7 instance (remote`);
    console.log(`│  droplet at 68.183.155.91) for test group "${group.category}".`);
    console.log(`│`);
    console.log(`│  Use SSH to connect to the droplet and execute:`);
    console.log(`│  cd ~/OpenClaw/Dev`);
    console.log(`│  npm run auto -- --test-ids=${group.testIds.join(',')}`);
    console.log(`│  `);
    console.log(`│  Monitor the output and save the results. Report back when`);
    console.log(`│  complete with token usage summary.`);
    console.log(`│  ────────────────────────────────────────────────────────────`);
    console.log(`│`);
    console.log(`└──────────────────────────────────────────────────────────────┘\n`);

    // Main agent instructions
    console.log(`┌─ SUB-AGENT ${groupNum}B: Main Instance (Local Docker) ──────────────┐`);
    console.log(`│`);
    console.log(`│  Description: Run ${group.name} tests on Main branch`);
    console.log(`│`);
    console.log(`│  Prompt to use:`);
    console.log(`│  ────────────────────────────────────────────────────────────`);
    console.log(`│  Run the automated test runner on the Main instance (local`);
    console.log(`│  Docker at localhost:18789) for test group "${group.category}".`);
    console.log(`│`);
    console.log(`│  Execute in the local Dev directory:`);
    console.log(`│  cd Dev`);
    console.log(`│  npm run auto -- --test-ids=${group.testIds.join(',')} \\`);
    console.log(`│    --main-url=ws://localhost:18789 \\`);
    console.log(`│    --vs7-url=ws://68.183.155.91:18789`);
    console.log(`│  `);
    console.log(`│  Monitor the output and save the results. Report back when`);
    console.log(`│  complete with token usage summary.`);
    console.log(`│  ────────────────────────────────────────────────────────────`);
    console.log(`│`);
    console.log(`└──────────────────────────────────────────────────────────────┘\n`);

    console.log(`\nAction: Spawn both sub-agents now and wait for them to complete.`);
    console.log(`Press Ctrl+C when ready to proceed to next group or when all done.\n`);

    console.log('─'.repeat(60));
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('  FINAL STEPS');
  console.log('═'.repeat(60));
  console.log(`\nAfter all ${groups.length * 2} sub-agents complete:\n`);
  console.log(`1. Review results in: Dev/results/auto-*/`);
  console.log(`2. Compare generated code between instances`);
  console.log(`3. Run comparison analysis:`);
  console.log(`   npm run compare -- results/auto-*/main results/auto-*/vs7`);
  console.log(`\n4. Generate final report with token savings and quality metrics\n`);

  console.log('─'.repeat(60));
  console.log('\n✓ Orchestration plan generated!\n');
}

main();

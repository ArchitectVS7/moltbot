#!/usr/bin/env node

/**
 * Simple Toggle Test Runner
 *
 * Runs tests twice on the SAME Docker instance:
 * 1. With VS7 contextManagement.enabled = true
 * 2. With VS7 contextManagement.enabled = false
 *
 * Uses OpenClaw CLI directly - no WebSocket complexity
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { TestPrompt } from './types.js';

const execAsync = promisify(exec);

interface TestRun {
  testId: string;
  mode: 'vs7' | 'baseline';
  results: TurnResult[];
  totalTokens: number;
  totalTimeMs: number;
}

interface TurnResult {
  turnNumber: number;
  prompt: string;
  response: string;
  tokens: number;
  timeMs: number;
}

async function loadTestPrompt(testId: string): Promise<TestPrompt> {
  const testPromptsDir = path.join(process.cwd(), 'test-prompts');
  const categories = await fs.readdir(testPromptsDir);

  for (const category of categories) {
    const categoryPath = path.join(testPromptsDir, category);
    const stat = await fs.stat(categoryPath);
    if (!stat.isDirectory()) continue;

    const files = await fs.readdir(categoryPath);
    const testFile = files.find((f) => f.startsWith(testId));

    if (testFile) {
      const testPath = path.join(categoryPath, testFile);
      const content = await fs.readFile(testPath, 'utf-8');
      return JSON.parse(content) as TestPrompt;
    }
  }

  throw new Error(`Test ${testId} not found`);
}

async function setVS7Mode(enabled: boolean): Promise<void> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Configuring VS7 mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`${'─'.repeat(60)}\n`);

  const configPath = './data/openclaw-config/openclaw.json';

  try {
    // Read existing config
    let config: any = {};
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {
      // Config doesn't exist yet, start fresh
    }

    // Set VS7 contextManagement
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.contextManagement) {
      config.agents.defaults.contextManagement = {};
    }

    config.agents.defaults.contextManagement.enabled = enabled;

    // Write config
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    console.log(`✓ Config updated: contextManagement.enabled = ${enabled}`);

    // Restart Docker container to pick up config
    console.log('  Restarting Docker container...');
    await execAsync('docker restart openclaw-openclaw-gateway-1');

    // Wait for service to be ready
    console.log('  Waiting for service to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`✓ Docker restarted in ${enabled ? 'VS7' : 'baseline'} mode\n`);

  } catch (error) {
    console.error('Failed to set VS7 mode:', error);
    throw error;
  }
}

async function runPromptViaCLI(prompt: string, sessionId: string): Promise<{
  response: string;
  tokens: number;
  timeMs: number;
}> {
  const startTime = Date.now();

  // Escape prompt for shell
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');

  try {
    const { stdout } = await execAsync(
      `docker exec openclaw-openclaw-gateway-1 node dist/index.js agent --session-id="${sessionId}" --message="${escapedPrompt}" --json`,
      { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer
    );

    const endTime = Date.now();

    // Parse JSON response
    let response = stdout;
    let tokens = 0;

    try {
      const jsonResponse = JSON.parse(stdout);
      // Extract response text from payloads
      if (jsonResponse.payloads && Array.isArray(jsonResponse.payloads)) {
        response = jsonResponse.payloads.map((p: any) => p.text).join('\n');
      } else {
        response = jsonResponse.text || jsonResponse.message || stdout;
      }
      // Extract token usage from meta.agentMeta.usage.total
      tokens = jsonResponse.meta?.agentMeta?.usage?.total || 0;
    } catch {
      // If not JSON, try to extract token count from text
      const tokenMatch = stdout.match(/(\d+)\s+tokens?/i);
      tokens = tokenMatch ? parseInt(tokenMatch[1]) : 0;
    }

    return {
      response,
      tokens,
      timeMs: endTime - startTime,
    };
  } catch (error: any) {
    console.error('CLI execution failed:', error.message);
    throw error;
  }
}

async function runTest(test: TestPrompt, mode: 'vs7' | 'baseline'): Promise<TestRun> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Running test ${test.id} in ${mode.toUpperCase()} mode`);
  console.log(`Test: ${test.name}`);
  console.log(`${'═'.repeat(60)}\n`);

  const sessionId = `test-${test.id}-${mode}-${Date.now()}`;
  const results: TurnResult[] = [];

  for (const turn of test.turns) {
    console.log(`\nTurn ${turn.number}/${test.turns.length}:`);
    console.log(`Prompt: ${turn.prompt.substring(0, 80)}${turn.prompt.length > 80 ? '...' : ''}`);

    try {
      const result = await runPromptViaCLI(turn.prompt, sessionId);

      console.log(`Response: ${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}`);
      console.log(`Tokens: ${result.tokens}, Time: ${result.timeMs}ms`);

      results.push({
        turnNumber: turn.number,
        prompt: turn.prompt,
        response: result.response,
        tokens: result.tokens,
        timeMs: result.timeMs,
      });
    } catch (error) {
      console.error(`Turn ${turn.number} failed:`, error);
      throw error;
    }
  }

  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
  const totalTimeMs = results.reduce((sum, r) => sum + r.timeMs, 0);

  console.log(`\n✓ Test complete: ${totalTokens} tokens, ${(totalTimeMs / 1000).toFixed(1)}s`);

  return {
    testId: test.id,
    mode,
    results,
    totalTokens,
    totalTimeMs,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let testIds: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--test-id=')) {
      testIds = [arg.split('=')[1]];
    } else if (arg.startsWith('--test-ids=')) {
      testIds = arg.split('=')[1].split(',');
    }
  }

  if (testIds.length === 0) {
    console.error('Usage:');
    console.error('  npm run simple -- --test-id=1.1');
    console.error('  npm run simple -- --test-ids=1.1,1.2,1.3');
    process.exit(1);
  }

  const sessionId = `simple-toggle-${Date.now()}`;
  const resultsDir = path.join(process.cwd(), 'results', sessionId);
  await fs.mkdir(resultsDir, { recursive: true });

  console.log('\n' + '═'.repeat(60));
  console.log('  SIMPLE TOGGLE TEST RUNNER');
  console.log('  VS7 On/Off Comparison');
  console.log('═'.repeat(60));
  console.log(`\nSession: ${sessionId}`);
  console.log(`Tests: ${testIds.join(', ')}\n`);

  const allResults: { baseline: TestRun[], vs7: TestRun[] } = { baseline: [], vs7: [] };

  for (const testId of testIds) {
    const test = await loadTestPrompt(testId);

    // Run with VS7 DISABLED (baseline)
    await setVS7Mode(false);
    const baselineRun = await runTest(test, 'baseline');
    allResults.baseline.push(baselineRun);

    // Save baseline results
    await fs.writeFile(
      path.join(resultsDir, `${testId}-baseline.json`),
      JSON.stringify(baselineRun, null, 2)
    );

    // Run with VS7 ENABLED
    await setVS7Mode(true);
    const vs7Run = await runTest(test, 'vs7');
    allResults.vs7.push(vs7Run);

    // Save VS7 results
    await fs.writeFile(
      path.join(resultsDir, `${testId}-vs7.json`),
      JSON.stringify(vs7Run, null, 2)
    );

    // Quick comparison
    const tokenDiff = baselineRun.totalTokens - vs7Run.totalTokens;
    const tokenPct = (tokenDiff / baselineRun.totalTokens * 100).toFixed(1);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`Test ${testId} Comparison:`);
    console.log(`  Baseline:  ${baselineRun.totalTokens.toLocaleString()} tokens`);
    console.log(`  VS7:       ${vs7Run.totalTokens.toLocaleString()} tokens`);
    console.log(`  Savings:   ${tokenDiff > 0 ? '+' : ''}${tokenDiff.toLocaleString()} (${tokenDiff > 0 ? '+' : ''}${tokenPct}%)`);
    console.log(`${'═'.repeat(60)}\n`);
  }

  // Final summary
  const totalBaselineTokens = allResults.baseline.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalVS7Tokens = allResults.vs7.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalSavings = totalBaselineTokens - totalVS7Tokens;
  const totalSavingsPct = (totalSavings / totalBaselineTokens * 100).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log('  FINAL SUMMARY');
  console.log('═'.repeat(60));
  console.log(`\nTests completed: ${testIds.length}`);
  console.log(`Total baseline tokens: ${totalBaselineTokens.toLocaleString()}`);
  console.log(`Total VS7 tokens: ${totalVS7Tokens.toLocaleString()}`);
  console.log(`Total savings: ${totalSavings.toLocaleString()} (${totalSavingsPct}%)`);
  console.log(`\nResults saved to: ${resultsDir}/\n`);
}

main().catch(error => {
  console.error('\n✗ Error:', error);
  process.exit(1);
});

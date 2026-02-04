#!/usr/bin/env node

/**
 * Long-Session Test Runner
 *
 * Runs ALL tests in ONE continuous session to test context retention.
 * - Mode A: VS7 OFF - runs all 15 tests sequentially
 * - Mode B: VS7 ON - runs all 15 tests sequentially
 * - Captures ALL generated files after each test
 * - Validates code quality
 * - Maintains continuous memory across all tests
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { TestPrompt } from './types.js';

const execAsync = promisify(exec);

interface TestExecution {
  testId: string;
  testName: string;
  turnNumber: number;
  prompt: string;
  response: string;
  tokens: number;
  timeMs: number;
  generatedFiles: string[];
}

interface SessionResult {
  mode: 'baseline' | 'vs7';
  sessionId: string;
  tests: TestExecution[];
  totalTokens: number;
  totalTimeMs: number;
  timestamp: string;
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

async function setVS7Mode(enabled: boolean): Promise<void> {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Configuring: ${enabled ? 'VS7 MODE (Context Management ON)' : 'BASELINE MODE (VS7 OFF)'}`);
  console.log(`${'─'.repeat(70)}\n`);

  const configPath = './data/openclaw-config/openclaw.json';

  let config: any = {};
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch {
    // Config doesn't exist, start fresh
  }

  if (!config.agents) config.agents = {};
  if (!config.agents.defaults) config.agents.defaults = {};
  if (!config.agents.defaults.contextManagement) {
    config.agents.defaults.contextManagement = {};
  }

  config.agents.defaults.contextManagement.enabled = enabled;

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  console.log(`✓ contextManagement.enabled = ${enabled}`);
  console.log('  Restarting Docker container...');

  await execAsync('docker restart openclaw-openclaw-gateway-1');
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`✓ Ready in ${enabled ? 'VS7' : 'BASELINE'} mode\n`);
}

async function runPrompt(
  sessionId: string,
  prompt: string
): Promise<{ response: string; tokens: number; timeMs: number }> {
  const startTime = Date.now();
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/\n/g, '\\n');

  try {
    const { stdout, stderr } = await execAsync(
      `docker exec openclaw-openclaw-gateway-1 node dist/index.js agent --session-id="${sessionId}" --message="${escapedPrompt}" --json`,
      { maxBuffer: 1024 * 1024 * 10 }
    );

    const endTime = Date.now();

    // Find JSON in output (might have error messages before it)
    let jsonStr = stdout;
    const jsonStart = stdout.indexOf('{');
    if (jsonStart > 0) {
      jsonStr = stdout.substring(jsonStart);
      if (jsonStart > 0 && stderr) {
        console.log(`    ⚠ Non-JSON output before JSON: ${stdout.substring(0, Math.min(100, jsonStart))}...`);
      }
    }

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('    ✗ Failed to parse JSON response');
      console.error(`    Raw output (first 500 chars): ${stdout.substring(0, 500)}`);
      throw new Error(`JSON parse failed: ${parseError}`);
    }

    let response = '';
    if (jsonResponse.payloads && Array.isArray(jsonResponse.payloads)) {
      response = jsonResponse.payloads.map((p: any) => p.text).join('\n');
    } else {
      response = jsonResponse.text || jsonResponse.message || stdout;
    }

    const tokens = jsonResponse.meta?.agentMeta?.usage?.total || 0;

    return { response, tokens, timeMs: endTime - startTime };
  } catch (error: any) {
    console.error('    ✗ Prompt execution failed:', error.message);
    throw error;
  }
}

async function captureWorkspaceFiles(outputDir: string): Promise<string[]> {
  try {
    await fs.mkdir(outputDir, { recursive: true });

    // Copy entire workspace from Docker container
    await execAsync(
      `docker cp openclaw-openclaw-gateway-1://home//node//.openclaw//workspace//. "${outputDir}"`
    );

    // List all captured files
    const listFiles = async (dir: string, prefix: string = ''): Promise<string[]> => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      const files: string[] = [];

      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        const relativePath = path.join(prefix, item.name);

        if (item.isDirectory()) {
          const subFiles = await listFiles(itemPath, relativePath);
          files.push(...subFiles);
        } else {
          files.push(relativePath);
        }
      }

      return files;
    };

    const files = await listFiles(outputDir);
    return files.filter(f =>
      !f.includes('.openclaw') &&
      !f.includes('node_modules') &&
      !f.startsWith('.')
    );
  } catch (error) {
    console.error('Error capturing workspace files:', error);
    return [];
  }
}

async function validatePythonSyntax(filePath: string): Promise<boolean> {
  if (!filePath.endsWith('.py')) return true;

  try {
    await execAsync(`python -m py_compile "${filePath}"`);
    return true;
  } catch {
    return false;
  }
}

async function runLongSession(mode: 'baseline' | 'vs7'): Promise<SessionResult> {
  const sessionId = `long-${mode}-${Date.now()}`;
  const sessionDir = path.join(process.cwd(), 'results', sessionId);
  await fs.mkdir(sessionDir, { recursive: true });

  console.log('\n' + '═'.repeat(70));
  console.log(`  LONG SESSION TEST: ${mode.toUpperCase()} MODE`);
  console.log('═'.repeat(70));
  console.log(`Session ID: ${sessionId}`);
  console.log(`Mode: ${mode === 'vs7' ? 'VS7 Context Management ENABLED' : 'BASELINE (VS7 OFF)'}`);
  console.log(`Strategy: ONE continuous session across ALL 15 tests`);
  console.log('═'.repeat(70) + '\n');

  const allTests = await loadAllTests();
  const executions: TestExecution[] = [];
  let testNumber = 0;

  for (const test of allTests) {
    testNumber++;
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`TEST ${testNumber}/${allTests.length}: ${test.id} - ${test.name}`);
    console.log(`Category: ${test.category}`);
    console.log(`${'─'.repeat(70)}\n`);

    for (const turn of test.turns) {
      console.log(`  Turn ${turn.number}/${test.turns.length}:`);
      console.log(`  Prompt: ${turn.prompt.substring(0, 70)}...`);

      try {
        const result = await runPrompt(sessionId, turn.prompt);

        console.log(`  ✓ Response: ${result.response.substring(0, 100)}...`);
        console.log(`  ✓ Tokens: ${result.tokens.toLocaleString()}, Time: ${(result.timeMs / 1000).toFixed(1)}s`);

        // Capture workspace files after this turn
        const turnDir = path.join(sessionDir, `test-${test.id}`, `turn-${turn.number}`);
        const files = await captureWorkspaceFiles(turnDir);

        if (files.length > 0) {
          console.log(`  ✓ Captured ${files.length} files: ${files.slice(0, 3).join(', ')}${files.length > 3 ? '...' : ''}`);

          // Validate Python files
          for (const file of files.filter(f => f.endsWith('.py'))) {
            const filePath = path.join(turnDir, file);
            const valid = await validatePythonSyntax(filePath);
            if (!valid) {
              console.log(`  ⚠ Python syntax error in: ${file}`);
            }
          }
        }

        executions.push({
          testId: test.id,
          testName: test.name,
          turnNumber: turn.number,
          prompt: turn.prompt,
          response: result.response,
          tokens: result.tokens,
          timeMs: result.timeMs,
          generatedFiles: files,
        });

      } catch (error) {
        console.error(`  ✗ Turn ${turn.number} failed:`, error);
        throw error;
      }
    }

    console.log(`  ✓ Test ${test.id} complete\n`);
  }

  const totalTokens = executions.reduce((sum, e) => sum + e.tokens, 0);
  const totalTimeMs = executions.reduce((sum, e) => sum + e.timeMs, 0);

  const result: SessionResult = {
    mode,
    sessionId,
    tests: executions,
    totalTokens,
    totalTimeMs,
    timestamp: new Date().toISOString(),
  };

  // Save session result
  await fs.writeFile(
    path.join(sessionDir, 'session-result.json'),
    JSON.stringify(result, null, 2)
  );

  console.log('\n' + '═'.repeat(70));
  console.log(`  SESSION COMPLETE: ${mode.toUpperCase()}`);
  console.log('═'.repeat(70));
  console.log(`Total tests: ${allTests.length}`);
  console.log(`Total turns: ${executions.length}`);
  console.log(`Total tokens: ${totalTokens.toLocaleString()}`);
  console.log(`Total time: ${(totalTimeMs / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Results saved to: ${sessionDir}/`);
  console.log('═'.repeat(70) + '\n');

  return result;
}

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('  OPENCLAW LONG-SESSION TEST SUITE');
  console.log('  VS7 Context Management Validation');
  console.log('═'.repeat(70));
  console.log('\nThis will run ALL 15 tests twice:');
  console.log('  1. BASELINE mode (VS7 OFF) - one continuous session');
  console.log('  2. VS7 mode (VS7 ON) - one continuous session');
  console.log('\nEach session maintains context across all tests.');
  console.log('Estimated time: 60-120 minutes total\n');
  console.log('═'.repeat(70));

  const proceed = await new Promise<boolean>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('\nProceed? (y/n): ', (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });

  if (!proceed) {
    console.log('Cancelled.');
    return;
  }

  // Run baseline mode
  await setVS7Mode(false);
  const baselineResult = await runLongSession('baseline');

  // Run VS7 mode
  await setVS7Mode(true);
  const vs7Result = await runLongSession('vs7');

  // Quick comparison
  const tokenDiff = baselineResult.totalTokens - vs7Result.totalTokens;
  const tokenPct = (tokenDiff / baselineResult.totalTokens * 100).toFixed(1);

  console.log('\n' + '═'.repeat(70));
  console.log('  FINAL COMPARISON');
  console.log('═'.repeat(70));
  console.log(`Baseline tokens:  ${baselineResult.totalTokens.toLocaleString()}`);
  console.log(`VS7 tokens:       ${vs7Result.totalTokens.toLocaleString()}`);
  console.log(`Difference:       ${tokenDiff > 0 ? '+' : ''}${tokenDiff.toLocaleString()} (${tokenDiff > 0 ? '+' : ''}${tokenPct}%)`);
  console.log(`\nBaseline time:    ${(baselineResult.totalTimeMs / 1000 / 60).toFixed(1)} min`);
  console.log(`VS7 time:         ${(vs7Result.totalTimeMs / 1000 / 60).toFixed(1)} min`);
  console.log('═'.repeat(70) + '\n');

  console.log(`Results saved to:`);
  console.log(`  Baseline: results/${baselineResult.sessionId}/`);
  console.log(`  VS7:      results/${vs7Result.sessionId}/`);
  console.log('\nRun comparison tool for detailed analysis.');
}

main().catch(error => {
  console.error('\n✗ Error:', error);
  process.exit(1);
});

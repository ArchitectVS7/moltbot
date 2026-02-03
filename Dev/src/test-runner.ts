#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import type { TestPrompt, TestResult, TurnMetrics, QualityEvaluation, TestConfig } from './types.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function loadTestPrompt(testId: string): Promise<TestPrompt> {
  const testPromptsDir = path.join(process.cwd(), 'test-prompts');
  
  // Search all subdirectories for the test file
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

async function loadConfig(): Promise<TestConfig> {
  const configPath = path.join(process.cwd(), 'test-config.json');
  const content = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(content) as TestConfig;
}

async function saveResult(config: TestConfig, result: TestResult): Promise<void> {
  const outputDir = path.join(process.cwd(), config.outputDir, config.instanceName);
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, `${result.testId}.json`);
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
  
  console.log(`\n✅ Results saved to: ${outputPath}`);
}

async function runTest(testId: string): Promise<void> {
  console.clear();
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         OpenClaw Context Management UAT Test Runner          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  const config = await loadConfig();
  const test = await loadTestPrompt(testId);
  
  console.log(`📋 Test: ${test.id} - ${test.name}`);
  console.log(`📁 Category: ${test.category}`);
  console.log(`📝 Description: ${test.description}`);
  console.log(`⏱️  Estimated Duration: ${test.estimatedDuration}`);
  console.log(`🖥️  Instance: ${config.instanceName}\n`);
  
  console.log('─'.repeat(65));
  console.log('\n💡 Instructions:\n');
  console.log('1. For each turn, copy the prompt below');
  console.log('2. Send it to OpenClaw via Telegram/CLI');
  console.log('3. Wait for the response');
  console.log('4. Record the metrics when prompted');
  console.log('5. Press Enter to continue to next turn\n');
  console.log('─'.repeat(65));
  
  await question('\n▶️  Press Enter to start the test...');
  
  const turns: TurnMetrics[] = [];
  
  for (const turn of test.turns) {
    console.clear();
    console.log(`\n┌─ TURN ${turn.number}/${test.turns.length} ─────────────────────────────────────────────────────┐\n`);
    
    console.log('📤 PROMPT TO SEND:\n');
    console.log('─'.repeat(65));
    console.log(turn.prompt);
    console.log('─'.repeat(65));
    
    console.log(`\n💭 Expected Behavior:\n   ${turn.expectedBehavior}\n`);
    console.log('└─────────────────────────────────────────────────────────────────┘\n');
    
    await question('✅ Press Enter after you\'ve sent this prompt...');
    
    const startTime = Date.now();
    await question('✅ Press Enter after you\'ve received the response...');
    const endTime = Date.now();
    
    console.log('\n📊 Metrics Collection:\n');
    
    const totalTokens = parseInt(await question('   Total tokens used: '), 10);
    const bootstrapTokens = await question('   Bootstrap tokens (optional): ');
    const historyTokens = await question('   History tokens (optional): ');
    const systemTokens = await question('   System tokens (optional): ');
    
    console.log('\n📋 Response (paste below, press Ctrl+D when done):\n');
    
    let agentResponse = '';
    // In manual mode, we'll skip capturing full response for simplicity
    agentResponse = await question('   Response summary (1-2 sentences): ');
    
    turns.push({
      turnNumber: turn.number,
      userPrompt: turn.prompt,
      agentResponse,
      tokensUsed: {
        total: totalTokens,
        bootstrap: bootstrapTokens ? parseInt(bootstrapTokens, 10) : undefined,
        history: historyTokens ? parseInt(historyTokens, 10) : undefined,
        system: systemTokens ? parseInt(systemTokens, 10) : undefined,
      },
      responseTimeMs: endTime - startTime,
      timestamp: new Date().toISOString(),
    });
    
    if (turn.number < test.turns.length) {
      await question('\n▶️  Press Enter to continue to next turn...');
    }
  }
  
  console.clear();
  console.log('\n┌─ QUALITY EVALUATION ─────────────────────────────────────────┐\n');
  
  console.log('📋 Success Criteria:\n');
  console.log(`   Task Completed: ${test.successCriteria.taskCompleted.description}`);
  console.log(`   Context Retained: ${test.successCriteria.contextRetained.description}`);
  console.log(`   Code Works: ${test.successCriteria.codeWorks.description}\n`);
  
  const taskCompleted = (await question('✅ Task completed? (y/n): ')).toLowerCase() === 'y';
  const contextRetained = (await question('🧠 Context retained? (y/n): ')).toLowerCase() === 'y';
  const codeWorks = (await question('💻 Code works? (y/n/na): ')).toLowerCase();
  const notes = await question('📝 Notes (optional): ');
  
  const qualityEvaluation: QualityEvaluation = {
    taskCompleted,
    contextRetained,
    codeWorks: codeWorks === 'y' || codeWorks === 'na',
    notes,
  };
  
  const result: TestResult = {
    instanceName: config.instanceName,
    testId: test.id,
    testName: test.name,
    category: test.category,
    timestamp: new Date().toISOString(),
    turns,
    qualityEvaluation,
    totalTokens: turns.reduce((sum, t) => sum + t.tokensUsed.total, 0),
    totalTimeMs: turns.reduce((sum, t) => sum + t.responseTimeMs, 0),
  };
  
  await saveResult(config, result);
  
  console.log('\n┌─ TEST SUMMARY ───────────────────────────────────────────────┐\n');
  console.log(`   Total Tokens: ${result.totalTokens.toLocaleString()}`);
  console.log(`   Total Time: ${(result.totalTimeMs / 1000).toFixed(1)}s`);
  console.log(`   Task Completed: ${taskCompleted ? '✅' : '❌'}`);
  console.log(`   Context Retained: ${contextRetained ? '✅' : '❌'}`);
  console.log(`   Code Works: ${codeWorks === 'na' ? 'N/A' : (qualityEvaluation.codeWorks ? '✅' : '❌')}`);
  console.log('\n└──────────────────────────────────────────────────────────────┘\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || !args[0].startsWith('--test-id=')) {
    console.error('Usage: npm run test:manual -- --test-id=<test-id>');
    console.error('Example: npm run test:manual -- --test-id=1.1');
    process.exit(1);
  }
  
  const testId = args[0].split('=')[1];
  
  try {
    await runTest(testId);
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();

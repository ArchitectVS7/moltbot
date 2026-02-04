#!/usr/bin/env node

/**
 * Automated Test Runner - NO MANUAL INPUT REQUIRED
 *
 * Connects to OpenClaw instances via WebSocket Gateway API
 * Sends prompts programmatically
 * Captures responses, token metrics, and generated files
 * Runs tests in parallel across VS7 and Main instances
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { TestPrompt, TestResult, TurnMetrics, QualityEvaluation } from './types.js';

interface GatewayConfig {
  url: string;
  token?: string;
  sessionKey: string;
  name: string; // 'vs7' or 'main'
  workspaceDir?: string; // Where files are generated
}

interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  message?: any;
  errorMessage?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  stopReason?: string;
}

interface ResponseFrame {
  ok: boolean;
  id: string;
  result?: any;
  error?: any;
}

interface EventFrame {
  event: string;
  data: ChatEvent;
}

class OpenClawClient {
  private ws: WebSocket | null = null;
  private config: GatewayConfig;
  private messageHandlers = new Map<string, (response: ResponseFrame) => void>();
  private eventHandlers = new Map<string, (event: ChatEvent) => void>();
  private connected = false;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.on('open', () => {
        console.log(`[${this.config.name}] Connected to ${this.config.url}`);
        this.connected = true;

        // Send initial connect frame
        const connectFrame = {
          id: randomUUID(),
          method: 'connect',
          params: {
            version: 1,
            clientName: 'automated-test-runner',
          },
        };

        this.ws?.send(JSON.stringify(connectFrame));
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const frame = JSON.parse(data.toString());

          // Handle response frames
          if (frame.ok !== undefined && frame.id) {
            const handler = this.messageHandlers.get(frame.id);
            if (handler) {
              handler(frame as ResponseFrame);
              this.messageHandlers.delete(frame.id);
            }
          }

          // Handle event frames
          if (frame.event === 'chat' && frame.data) {
            const chatEvent = frame.data as ChatEvent;
            const handler = this.eventHandlers.get(chatEvent.runId);
            if (handler) {
              handler(chatEvent);
            }
          }
        } catch (error) {
          console.error(`[${this.config.name}] Error parsing message:`, error);
        }
      });

      this.ws.on('error', (error) => {
        console.error(`[${this.config.name}] WebSocket error:`, error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log(`[${this.config.name}] Disconnected`);
        this.connected = false;
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async sendPrompt(prompt: string): Promise<{
    response: string;
    tokens: {
      total: number;
      input?: number;
      output?: number;
      cacheCreation?: number;
      cacheRead?: number;
    };
    timeMs: number;
  }> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to OpenClaw');
    }

    const startTime = Date.now();
    const messageId = randomUUID();
    const idempotencyKey = randomUUID();

    // Prepare chat.send request
    const requestFrame = {
      id: messageId,
      method: 'chat.send',
      params: {
        sessionKey: this.config.sessionKey,
        message: prompt,
        idempotencyKey,
      },
    };

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let finalUsage: any = null;
      let runId: string | null = null;

      // Set up event handler for chat events
      const eventHandler = (event: ChatEvent) => {
        if (event.state === 'delta' && event.message) {
          // Accumulate response
          if (typeof event.message === 'string') {
            fullResponse += event.message;
          } else if (event.message.content && typeof event.message.content === 'string') {
            fullResponse += event.message.content;
          } else if (Array.isArray(event.message.content)) {
            // Handle content blocks
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                fullResponse += block.text;
              }
            }
          }
        } else if (event.state === 'final') {
          finalUsage = event.usage;
          const endTime = Date.now();

          // Clean up
          if (runId) {
            this.eventHandlers.delete(runId);
          }

          // Calculate tokens
          const tokens = {
            total: (finalUsage?.input_tokens || 0) + (finalUsage?.output_tokens || 0),
            input: finalUsage?.input_tokens,
            output: finalUsage?.output_tokens,
            cacheCreation: finalUsage?.cache_creation_input_tokens,
            cacheRead: finalUsage?.cache_read_input_tokens,
          };

          resolve({
            response: fullResponse,
            tokens,
            timeMs: endTime - startTime,
          });
        } else if (event.state === 'error') {
          if (runId) {
            this.eventHandlers.delete(runId);
          }
          reject(new Error(event.errorMessage || 'Unknown error'));
        } else if (event.state === 'aborted') {
          if (runId) {
            this.eventHandlers.delete(runId);
          }
          reject(new Error('Request aborted'));
        }
      };

      // Handle the initial response which contains the runId
      this.messageHandlers.set(messageId, (response: ResponseFrame) => {
        if (!response.ok) {
          reject(new Error(response.error?.message || 'Request failed'));
          return;
        }

        runId = response.result?.runId;
        if (runId) {
          this.eventHandlers.set(runId, eventHandler);
        }
      });

      // Send the request
      this.ws?.send(JSON.stringify(requestFrame));

      // Timeout after 5 minutes
      setTimeout(() => {
        if (runId) {
          this.eventHandlers.delete(runId);
        }
        reject(new Error('Request timeout'));
      }, 300000);
    });
  }

  async captureWorkspaceFiles(outputDir: string): Promise<string[]> {
    if (!this.config.workspaceDir) {
      return [];
    }

    try {
      // Copy all files from workspace to output directory
      await fs.mkdir(outputDir, { recursive: true });

      const files = await fs.readdir(this.config.workspaceDir, { recursive: true });
      const copiedFiles: string[] = [];

      for (const file of files) {
        const sourcePath = path.join(this.config.workspaceDir, file);
        const stat = await fs.stat(sourcePath);

        if (stat.isFile()) {
          const destPath = path.join(outputDir, file);
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.copyFile(sourcePath, destPath);
          copiedFiles.push(file);
        }
      }

      return copiedFiles;
    } catch (error) {
      console.error(`[${this.config.name}] Error capturing workspace files:`, error);
      return [];
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
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

async function runTest(
  client: OpenClawClient,
  test: TestPrompt,
  sessionId: string,
): Promise<TestResult> {
  console.log(`\n[${client['config'].name}] Running test ${test.id}: ${test.name}`);

  const turns: TurnMetrics[] = [];
  const outputBaseDir = path.join(
    process.cwd(),
    'results',
    sessionId,
    client['config'].name,
    test.id,
  );

  for (const turn of test.turns) {
    console.log(`[${client['config'].name}] Turn ${turn.number}/${test.turns.length}: Sending prompt...`);

    try {
      const result = await client.sendPrompt(turn.prompt);

      console.log(`[${client['config'].name}] Turn ${turn.number}: Received response (${result.tokens.total} tokens, ${result.timeMs}ms)`);

      // Capture generated files
      const turnOutputDir = path.join(outputBaseDir, `turn-${turn.number}`);
      const files = await client.captureWorkspaceFiles(turnOutputDir);

      if (files.length > 0) {
        console.log(`[${client['config'].name}] Turn ${turn.number}: Captured ${files.length} files`);
      }

      const turnMetric: TurnMetrics = {
        turnNumber: turn.number,
        userPrompt: turn.prompt,
        agentResponse: result.response.substring(0, 500) + (result.response.length > 500 ? '...' : ''),
        tokensUsed: {
          total: result.tokens.total,
          input: result.tokens.input,
          output: result.tokens.output,
          cacheCreation: result.tokens.cacheCreation,
          cacheRead: result.tokens.cacheRead,
        },
        responseTimeMs: result.timeMs,
        timestamp: new Date().toISOString(),
      };

      turns.push(turnMetric);
    } catch (error) {
      console.error(`[${client['config'].name}] Turn ${turn.number} failed:`, error);
      throw error;
    }
  }

  // For now, mark quality as needs manual review
  const quality: QualityEvaluation = {
    taskCompleted: true, // Optimistic - will be validated by comparison tool
    contextRetained: true,
    codeWorks: true,
    notes: 'Auto-generated - needs manual validation',
  };

  const result: TestResult = {
    instanceName: client['config'].name,
    testId: test.id,
    testName: test.name,
    category: test.category,
    timestamp: new Date().toISOString(),
    turns,
    qualityEvaluation: quality,
    totalTokens: turns.reduce((sum, t) => sum + t.tokensUsed.total, 0),
    totalTimeMs: turns.reduce((sum, t) => sum + t.responseTimeMs, 0),
  };

  // Save result
  const resultPath = path.join(outputBaseDir, 'result.json');
  await fs.mkdir(path.dirname(resultPath), { recursive: true });
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));

  console.log(`[${client['config'].name}] Test ${test.id} complete: ${result.totalTokens} tokens, ${(result.totalTimeMs / 1000).toFixed(1)}s`);

  return result;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  let testIds: string[] = [];
  let vs7Url = 'ws://68.183.155.91:18789'; // Default to droplet
  let mainUrl = 'ws://localhost:18789';
  let sessionKey = 'default';

  for (const arg of args) {
    if (arg.startsWith('--test-id=')) {
      testIds = [arg.split('=')[1]];
    } else if (arg.startsWith('--test-ids=')) {
      testIds = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--vs7-url=')) {
      vs7Url = arg.split('=')[1];
    } else if (arg.startsWith('--main-url=')) {
      mainUrl = arg.split('=')[1];
    } else if (arg.startsWith('--session=')) {
      sessionKey = arg.split('=')[1];
    }
  }

  if (testIds.length === 0) {
    console.error('Usage:');
    console.error('  npm run auto -- --test-id=1.1');
    console.error('  npm run auto -- --test-ids=1.1,1.2,1.3');
    console.error('\nOptions:');
    console.error('  --vs7-url=ws://host:port    VS7 instance URL (default: ws://68.183.155.91:18789)');
    console.error('  --main-url=ws://host:port   Main instance URL (default: ws://localhost:18789)');
    console.error('  --session=key               Session key (default: default)');
    process.exit(1);
  }

  const sessionId = `auto-${Date.now()}`;
  console.log(`\n=== AUTOMATED TEST SESSION: ${sessionId} ===\n`);
  console.log(`Tests to run: ${testIds.join(', ')}`);
  console.log(`VS7 instance: ${vs7Url}`);
  console.log(`Main instance: ${mainUrl}\n`);

  // Create clients
  const vs7Client = new OpenClawClient({
    url: vs7Url,
    sessionKey,
    name: 'vs7',
    workspaceDir: '/root/openclaw-workspace', // Adjust based on actual workspace
  });

  const mainClient = new OpenClawClient({
    url: mainUrl,
    sessionKey,
    name: 'main',
    workspaceDir: './data/openclaw-workspace', // Adjust based on actual workspace
  });

  try {
    // Connect to both instances
    console.log('Connecting to instances...');
    await Promise.all([vs7Client.connect(), mainClient.connect()]);
    console.log('✓ Both instances connected\n');

    // Run tests
    for (const testId of testIds) {
      const test = await loadTestPrompt(testId);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Running test ${testId}: ${test.name}`);
      console.log(`${'='.repeat(60)}`);

      // Run on both instances in parallel
      const [vs7Result, mainResult] = await Promise.all([
        runTest(vs7Client, test, sessionId),
        runTest(mainClient, test, sessionId),
      ]);

      // Quick comparison
      const tokenDiff = mainResult.totalTokens - vs7Result.totalTokens;
      const tokenPct = (tokenDiff / mainResult.totalTokens * 100).toFixed(1);

      console.log(`\n${'-'.repeat(60)}`);
      console.log(`Test ${testId} Comparison:`);
      console.log(`  Main:  ${mainResult.totalTokens.toLocaleString()} tokens`);
      console.log(`  VS7:   ${vs7Result.totalTokens.toLocaleString()} tokens`);
      console.log(`  Diff:  ${tokenDiff > 0 ? '-' : '+'}${Math.abs(tokenDiff).toLocaleString()} (${tokenDiff > 0 ? '-' : '+'}${Math.abs(parseFloat(tokenPct))}%)`);
      console.log(`${'-'.repeat(60)}\n`);
    }

    console.log(`\n✓ All tests complete!`);
    console.log(`Results saved to: results/${sessionId}/`);
    console.log(`\nNext steps:`);
    console.log(`  1. Review generated files in results/${sessionId}/*/test-*/turn-*/`);
    console.log(`  2. Run comparison tool: npm run compare -- results/${sessionId}/main results/${sessionId}/vs7`);

  } catch (error) {
    console.error('\n✗ Error:', error);
    process.exit(1);
  } finally {
    vs7Client.disconnect();
    mainClient.disconnect();
  }
}

main();

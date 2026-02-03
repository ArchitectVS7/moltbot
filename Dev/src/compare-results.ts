#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import type { TestResult, ComparisonMetrics, ComparisonReport } from './types.js';

async function loadResults(resultsDir: string): Promise<Map<string, TestResult>> {
  const results = new Map<string, TestResult>();
  
  try {
    const files = await fs.readdir(resultsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(resultsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const result = JSON.parse(content) as TestResult;
        results.set(result.testId, result);
      }
    }
  } catch (error) {
    console.error(`Failed to load results from ${resultsDir}:`, error);
  }
  
  return results;
}

function compareTests(
  testId: string,
  mainResult: TestResult,
  vs7Result: TestResult
): ComparisonMetrics {
  const tokenReduction = 
    ((mainResult.totalTokens - vs7Result.totalTokens) / mainResult.totalTokens) * 100;
  
  const timeChange = 
    ((vs7Result.totalTimeMs - mainResult.totalTimeMs) / mainResult.totalTimeMs) * 100;
  
  // Quality change: -1 (worse), 0 (same), 1 (better)
  const mainQuality = [
    mainResult.qualityEvaluation.taskCompleted,
    mainResult.qualityEvaluation.contextRetained,
    mainResult.qualityEvaluation.codeWorks,
  ].filter(Boolean).length;
  
  const vs7Quality = [
    vs7Result.qualityEvaluation.taskCompleted,
    vs7Result.qualityEvaluation.contextRetained,
    vs7Result.qualityEvaluation.codeWorks,
  ].filter(Boolean).length;
  
  const qualityChange = vs7Quality > mainQuality ? 1 : vs7Quality < mainQuality ? -1 : 0;
  
  return {
    testId,
    testName: mainResult.testName,
    category: mainResult.category,
    main: {
      totalTokens: mainResult.totalTokens,
      totalTimeMs: mainResult.totalTimeMs,
      taskCompleted: mainResult.qualityEvaluation.taskCompleted,
      contextRetained: mainResult.qualityEvaluation.contextRetained,
      codeWorks: mainResult.qualityEvaluation.codeWorks,
    },
    vs7: {
      totalTokens: vs7Result.totalTokens,
      totalTimeMs: vs7Result.totalTimeMs,
      taskCompleted: vs7Result.qualityEvaluation.taskCompleted,
      contextRetained: vs7Result.qualityEvaluation.contextRetained,
      codeWorks: vs7Result.qualityEvaluation.codeWorks,
    },
    tokenReduction,
    timeChange,
    qualityChange,
  };
}

function generateReport(comparisons: ComparisonMetrics[]): ComparisonReport {
  const avgTokenReduction = 
    comparisons.reduce((sum, c) => sum + c.tokenReduction, 0) / comparisons.length;
  
  const avgTimeChange = 
    comparisons.reduce((sum, c) => sum + c.timeChange, 0) / comparisons.length;
  
  const mainTaskCompletionRate = 
    comparisons.filter((c) => c.main.taskCompleted).length / comparisons.length;
  
  const vs7TaskCompletionRate = 
    comparisons.filter((c) => c.vs7.taskCompleted).length / comparisons.length;
  
  const mainContextRetentionRate = 
    comparisons.filter((c) => c.main.contextRetained).length / comparisons.length;
  
  const vs7ContextRetentionRate = 
    comparisons.filter((c) => c.vs7.contextRetained).length / comparisons.length;
  
  const mainCodeWorksRate = 
    comparisons.filter((c) => c.main.codeWorks).length / comparisons.length;
  
  const vs7CodeWorksRate = 
    comparisons.filter((c) => c.vs7.codeWorks).length / comparisons.length;
  
  // Group by category
  const byCategory: Record<string, { avgTokenReduction: number; tests: ComparisonMetrics[] }> = {};
  
  for (const comparison of comparisons) {
    if (!byCategory[comparison.category]) {
      byCategory[comparison.category] = { avgTokenReduction: 0, tests: [] };
    }
    byCategory[comparison.category].tests.push(comparison);
  }
  
  for (const category in byCategory) {
    const tests = byCategory[category].tests;
    byCategory[category].avgTokenReduction = 
      tests.reduce((sum, t) => sum + t.tokenReduction, 0) / tests.length;
  }
  
  // Determine verdict
  const tokenGoalMet = avgTokenReduction >= 20;
  const contextGoalMet = vs7ContextRetentionRate >= 0.95;
  const codeQualityGoalMet = vs7CodeWorksRate >= mainCodeWorksRate;
  const taskCompletionGoalMet = vs7TaskCompletionRate >= 0.95;
  
  return {
    timestamp: new Date().toISOString(),
    testsCompared: comparisons.length,
    summary: {
      avgTokenReduction,
      avgTimeChange,
      mainTaskCompletionRate,
      vs7TaskCompletionRate,
      mainContextRetentionRate,
      vs7ContextRetentionRate,
      mainCodeWorksRate,
      vs7CodeWorksRate,
    },
    byCategory,
    verdict: {
      tokenGoalMet,
      contextGoalMet,
      codeQualityGoalMet,
      taskCompletionGoalMet,
      overallPass: tokenGoalMet && contextGoalMet && codeQualityGoalMet && taskCompletionGoalMet,
    },
  };
}

function formatReport(report: ComparisonReport): string {
  let md = '# Context Management UAT Comparison Report\n\n';
  md += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
  md += `**Tests Compared:** ${report.testsCompared}\n\n`;
  md += '---\n\n';
  
  md += '## 📊 Summary\n\n';
  md += '| Metric | Main Branch | VS7 Branch | Change |\n';
  md += '|--------|-------------|------------|--------|\n';
  md += `| **Token Usage** | baseline | ${report.summary.avgTokenReduction > 0 ? '-' : '+'}${Math.abs(report.summary.avgTokenReduction).toFixed(1)}% | ${report.summary.avgTokenReduction >= 20 ? '✅' : '❌'} **${report.summary.avgTokenReduction >= 20 ? 'GOAL MET' : 'GOAL MISSED'}** |\n`;
  md += `| **Response Time** | baseline | ${report.summary.avgTimeChange > 0 ? '+' : ''}${report.summary.avgTimeChange.toFixed(1)}% | ℹ️ |\n`;
  md += `| **Task Completion** | ${(report.summary.mainTaskCompletionRate * 100).toFixed(0)}% | ${(report.summary.vs7TaskCompletionRate * 100).toFixed(0)}% | ${report.verdict.taskCompletionGoalMet ? '✅' : '❌'} |\n`;
  md += `| **Context Retention** | ${(report.summary.mainContextRetentionRate * 100).toFixed(0)}% | ${(report.summary.vs7ContextRetentionRate * 100).toFixed(0)}% | ${report.verdict.contextGoalMet ? '✅' : '❌'} |\n`;
  md += `| **Code Quality** | ${(report.summary.mainCodeWorksRate * 100).toFixed(0)}% | ${(report.summary.vs7CodeWorksRate * 100).toFixed(0)}% | ${report.verdict.codeQualityGoalMet ? '✅' : '❌'} |\n\n`;
  
  md += '---\n\n';
  md += '## 🎯 Verdict\n\n';
  md += `**Overall Result:** ${report.verdict.overallPass ? '✅ **PASS**' : '❌ **FAIL**'}\n\n`;
  md += '### Goals:\n';
  md += `- ${report.verdict.tokenGoalMet ? '✅' : '❌'} Token reduction ≥20%: **${report.summary.avgTokenReduction.toFixed(1)}%**\n`;
  md += `- ${report.verdict.contextGoalMet ? '✅' : '❌'} Context retention ≥95%: **${(report.summary.vs7ContextRetentionRate * 100).toFixed(0)}%**\n`;
  md += `- ${report.verdict.codeQualityGoalMet ? '✅' : '❌'} Code quality equal or better\n`;
  md += `- ${report.verdict.taskCompletionGoalMet ? '✅' : '❌'} Task completion ≥95%: **${(report.summary.vs7TaskCompletionRate * 100).toFixed(0)}%**\n\n`;
  
  if (report.verdict.overallPass) {
    md += '**✅ VS7 context management system is ready to ship.**\n\n';
  } else {
    md += '**❌ VS7 needs tuning. Review failed metrics and adjust config.**\n\n';
  }
  
  md += '---\n\n';
  md += '## 📁 By Category\n\n';
  
  for (const [category, data] of Object.entries(report.byCategory)) {
    md += `### ${category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}\n\n`;
    md += `**Average Token Reduction:** ${data.avgTokenReduction > 0 ? '-' : '+'}${Math.abs(data.avgTokenReduction).toFixed(1)}%\n\n`;
    md += '| Test | Main Tokens | VS7 Tokens | Reduction | Quality |\n';
    md += '|------|-------------|------------|-----------|----------|\n';
    
    for (const test of data.tests) {
      const qualityEmoji = test.qualityChange > 0 ? '📈' : test.qualityChange < 0 ? '📉' : '➡️';
      md += `| ${test.testId} - ${test.testName} | ${test.main.totalTokens.toLocaleString()} | ${test.vs7.totalTokens.toLocaleString()} | ${test.tokenReduction > 0 ? '-' : '+'}${Math.abs(test.tokenReduction).toFixed(1)}% | ${qualityEmoji} |\n`;
    }
    md += '\n';
  }
  
  md += '---\n\n';
  md += '## 🔍 Detailed Test Results\n\n';
  
  for (const comparison of Object.values(report.byCategory).flatMap((c) => c.tests)) {
    md += `### ${comparison.testId} - ${comparison.testName}\n\n`;
    md += `**Category:** ${comparison.category}\n\n`;
    md += '| Metric | Main | VS7 | Change |\n';
    md += '|--------|------|-----|--------|\n';
    md += `| Tokens | ${comparison.main.totalTokens.toLocaleString()} | ${comparison.vs7.totalTokens.toLocaleString()} | ${comparison.tokenReduction > 0 ? '-' : '+'}${Math.abs(comparison.tokenReduction).toFixed(1)}% |\n`;
    md += `| Time | ${(comparison.main.totalTimeMs / 1000).toFixed(1)}s | ${(comparison.vs7.totalTimeMs / 1000).toFixed(1)}s | ${comparison.timeChange > 0 ? '+' : ''}${comparison.timeChange.toFixed(1)}% |\n`;
    md += `| Task Completed | ${comparison.main.taskCompleted ? '✅' : '❌'} | ${comparison.vs7.taskCompleted ? '✅' : '❌'} | ${comparison.main.taskCompleted === comparison.vs7.taskCompleted ? '=' : (comparison.vs7.taskCompleted ? '📈' : '📉')} |\n`;
    md += `| Context Retained | ${comparison.main.contextRetained ? '✅' : '❌'} | ${comparison.vs7.contextRetained ? '✅' : '❌'} | ${comparison.main.contextRetained === comparison.vs7.contextRetained ? '=' : (comparison.vs7.contextRetained ? '📈' : '📉')} |\n`;
    md += `| Code Works | ${comparison.main.codeWorks ? '✅' : '❌'} | ${comparison.vs7.codeWorks ? '✅' : '❌'} | ${comparison.main.codeWorks === comparison.vs7.codeWorks ? '=' : (comparison.vs7.codeWorks ? '📈' : '📉')} |\n\n`;
  }
  
  return md;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npm run compare -- <main-results-dir> <vs7-results-dir>');
    console.error('Example: npm run compare -- results/main results/vs7');
    process.exit(1);
  }
  
  const mainDir = args[0];
  const vs7Dir = args[1];
  
  console.log('📂 Loading results...\n');
  console.log(`   Main branch: ${mainDir}`);
  console.log(`   VS7 branch: ${vs7Dir}\n`);
  
  const mainResults = await loadResults(mainDir);
  const vs7Results = await loadResults(vs7Dir);
  
  console.log(`✅ Loaded ${mainResults.size} main results, ${vs7Results.size} VS7 results\n`);
  
  const comparisons: ComparisonMetrics[] = [];
  
  for (const [testId, mainResult] of mainResults) {
    const vs7Result = vs7Results.get(testId);
    if (vs7Result) {
      comparisons.push(compareTests(testId, mainResult, vs7Result));
    } else {
      console.warn(`⚠️  Test ${testId} missing from VS7 results`);
    }
  }
  
  if (comparisons.length === 0) {
    console.error('❌ No matching tests found to compare');
    process.exit(1);
  }
  
  console.log(`📊 Comparing ${comparisons.length} tests...\n`);
  
  const report = generateReport(comparisons);
  const reportMd = formatReport(report);
  
  const reportPath = path.join(process.cwd(), 'comparison-report.md');
  await fs.writeFile(reportPath, reportMd);
  
  console.log(`✅ Comparison report saved to: ${reportPath}\n`);
  
  // Print summary to console
  console.log('═'.repeat(65));
  console.log('  SUMMARY');
  console.log('═'.repeat(65));
  console.log(`Token Reduction:     ${report.summary.avgTokenReduction.toFixed(1)}% ${report.verdict.tokenGoalMet ? '✅' : '❌'}`);
  console.log(`Context Retention:   ${(report.summary.vs7ContextRetentionRate * 100).toFixed(0)}% ${report.verdict.contextGoalMet ? '✅' : '❌'}`);
  console.log(`Code Quality:        ${report.verdict.codeQualityGoalMet ? '✅ Equal or Better' : '❌ Worse'}`);
  console.log(`Task Completion:     ${(report.summary.vs7TaskCompletionRate * 100).toFixed(0)}% ${report.verdict.taskCompletionGoalMet ? '✅' : '❌'}`);
  console.log('─'.repeat(65));
  console.log(`Overall:             ${report.verdict.overallPass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(65));
}

main();

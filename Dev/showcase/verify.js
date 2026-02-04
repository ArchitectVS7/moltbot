#!/usr/bin/env node

/**
 * Verification script for OpenClaw VS7 Showcase
 * Checks that all required files and data are in place
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m',
  dim: '\x1b[2m'
};

let errors = 0;
let warnings = 0;

/**
 * Check if file exists
 */
function checkFile(filePath, description, required = true) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    console.log(`  ${colors.green}✓${colors.reset} ${description}`);
    return true;
  } else {
    if (required) {
      console.log(`  ${colors.red}✗${colors.reset} ${description} ${colors.dim}(missing)${colors.reset}`);
      errors++;
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${description} ${colors.dim}(missing)${colors.reset}`);
      warnings++;
    }
    return false;
  }
}

/**
 * Check if directory exists and count files
 */
function checkDirectory(dirPath, description, expectedCount = null) {
  if (!fs.existsSync(dirPath)) {
    console.log(`  ${colors.red}✗${colors.reset} ${description} ${colors.dim}(missing)${colors.reset}`);
    errors++;
    return 0;
  }

  const files = fs.readdirSync(dirPath);
  const count = files.length;

  if (expectedCount !== null) {
    if (count === expectedCount) {
      console.log(`  ${colors.green}✓${colors.reset} ${description} ${colors.dim}(${count} files)${colors.reset}`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} ${description} ${colors.dim}(${count} files, expected ${expectedCount})${colors.reset}`);
      warnings++;
    }
  } else {
    console.log(`  ${colors.green}✓${colors.reset} ${description} ${colors.dim}(${count} files)${colors.reset}`);
  }

  return count;
}

/**
 * Main verification
 */
function verify() {
  console.log('\n' + '═'.repeat(60));
  console.log('  OpenClaw VS7 Showcase - Verification Report');
  console.log('═'.repeat(60) + '\n');

  // Core files
  console.log(`${colors.blue}Core Files:${colors.reset}`);
  checkFile(path.join(__dirname, 'index.html'), 'Main index page');
  checkFile(path.join(__dirname, 'package.json'), 'Package configuration');
  checkFile(path.join(__dirname, 'README.md'), 'Documentation');
  checkFile(path.join(__dirname, 'USAGE.md'), 'Usage guide');
  console.log();

  // Build scripts
  console.log(`${colors.blue}Build Scripts:${colors.reset}`);
  checkFile(path.join(__dirname, 'generate-pages.js'), 'Page generator');
  checkFile(path.join(__dirname, 'build-file-index.js'), 'File indexer');
  checkFile(path.join(__dirname, 'start-server.js'), 'Web server');
  console.log();

  // Assets
  console.log(`${colors.blue}Assets:${colors.reset}`);
  checkFile(path.join(__dirname, 'assets/css/styles.css'), 'Main stylesheet');
  checkFile(path.join(__dirname, 'assets/js/app.js'), 'Main JavaScript');
  console.log();

  // Generated files
  console.log(`${colors.blue}Generated Files:${colors.reset}`);
  checkDirectory(path.join(__dirname, 'tests'), 'Test pages', 15);
  checkDirectory(path.join(__dirname, 'data'), 'File indexes', 31);
  console.log();

  // Data sources
  console.log(`${colors.blue}Data Sources:${colors.reset}`);
  const testPromptsDir = path.join(__dirname, '../test-prompts');
  const resultsDir = path.join(__dirname, '../results');
  const analysisDir = path.join(__dirname, '../analysis/output');

  checkDirectory(path.join(testPromptsDir, '1-context-retention'), 'Context retention prompts', 5);
  checkDirectory(path.join(testPromptsDir, '2-code-quality'), 'Code quality prompts', 5);
  checkDirectory(path.join(testPromptsDir, '3-mixed-workload'), 'Mixed workload prompts', 5);
  console.log();

  checkDirectory(path.join(resultsDir, 'long-baseline-1770174088653'), 'Baseline results', 16);
  checkDirectory(path.join(resultsDir, 'long-vs7-1770176381223'), 'VS7 results', 16);
  console.log();

  const analysisExists = fs.existsSync(analysisDir);
  if (analysisExists) {
    checkFile(path.join(analysisDir, 'group-1-analysis.json'), 'Group 1 analysis', false);
    checkFile(path.join(analysisDir, 'group-2-analysis.json'), 'Group 2 analysis', false);
    checkFile(path.join(analysisDir, 'group-3-analysis.json'), 'Group 3 analysis', false);
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} Analysis directory ${colors.dim}(not generated yet)${colors.reset}`);
    warnings++;
  }
  console.log();

  // Individual test pages
  console.log(`${colors.blue}Test Pages:${colors.reset}`);
  const testIds = [
    '1.1', '1.2', '1.3', '1.4', '1.5',
    '2.1', '2.2', '2.3', '2.4', '2.5',
    '3.1', '3.2', '3.3', '3.4', '3.5'
  ];

  let pagesOk = 0;
  for (const testId of testIds) {
    const pagePath = path.join(__dirname, 'tests', `test-${testId}.html`);
    if (fs.existsSync(pagePath)) {
      pagesOk++;
    }
  }

  if (pagesOk === 15) {
    console.log(`  ${colors.green}✓${colors.reset} All 15 test pages present`);
  } else {
    console.log(`  ${colors.red}✗${colors.reset} Only ${pagesOk}/15 test pages found`);
    errors++;
  }
  console.log();

  // File indexes
  console.log(`${colors.blue}File Indexes:${colors.reset}`);
  let indexesOk = 0;
  for (const testId of testIds) {
    const baselinePath = path.join(__dirname, 'data', `baseline-${testId}.json`);
    const vs7Path = path.join(__dirname, 'data', `vs7-${testId}.json`);
    if (fs.existsSync(baselinePath) && fs.existsSync(vs7Path)) {
      indexesOk++;
    }
  }

  if (indexesOk === 15) {
    console.log(`  ${colors.green}✓${colors.reset} All 30 test indexes present (15 × 2 modes)`);
  } else {
    console.log(`  ${colors.red}✗${colors.reset} Only ${indexesOk * 2}/30 test indexes found`);
    errors++;
  }

  const masterIndexPath = path.join(__dirname, 'data', 'index.json');
  if (fs.existsSync(masterIndexPath)) {
    console.log(`  ${colors.green}✓${colors.reset} Master index present`);
  } else {
    console.log(`  ${colors.red}✗${colors.reset} Master index missing`);
    errors++;
  }
  console.log();

  // Summary
  console.log('═'.repeat(60));
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log();

  if (errors === 0 && warnings === 0) {
    console.log(`  ${colors.green}✓ All checks passed!${colors.reset}`);
    console.log(`  ${colors.dim}The showcase is ready to use.${colors.reset}`);
    console.log();
    console.log(`  Run: ${colors.blue}npm start${colors.reset} to launch the server`);
  } else {
    if (errors > 0) {
      console.log(`  ${colors.red}✗ ${errors} error(s) found${colors.reset}`);
    }
    if (warnings > 0) {
      console.log(`  ${colors.yellow}⚠ ${warnings} warning(s) found${colors.reset}`);
    }
    console.log();

    if (errors > 0) {
      console.log(`  ${colors.yellow}Suggested fixes:${colors.reset}`);
      console.log(`    1. Run: ${colors.blue}npm run build:all${colors.reset}`);
      console.log(`    2. Check that test results exist in ${colors.dim}Dev/results/${colors.reset}`);
      console.log(`    3. Verify test prompts are in ${colors.dim}Dev/test-prompts/${colors.reset}`);
    }

    if (warnings > 0 && errors === 0) {
      console.log(`  ${colors.dim}Warnings are non-critical. You can still use the showcase.${colors.reset}`);
      console.log();
      console.log(`  Run: ${colors.blue}npm start${colors.reset} to launch the server`);
    }
  }

  console.log();
  console.log('═'.repeat(60) + '\n');

  return errors === 0;
}

// Run verification
const success = verify();
process.exit(success ? 0 : 1);

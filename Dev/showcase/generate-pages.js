/**
 * Generate all 15 test pages from test prompt definitions
 * Run with: node generate-pages.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test definitions with their prompts
const testCategories = {
  '1-context-retention': [
    '1.1-multi-turn-memory',
    '1.2-context-switching',
    '1.3-memory-md-recall',
    '1.4-interrupted-task',
    '1.5-workspace-file-ref'
  ],
  '2-code-quality': [
    '2.1-multi-file-refactor',
    '2.2-bug-fix',
    '2.3-api-integration',
    '2.4-code-review',
    '2.5-codebase-analysis'
  ],
  '3-mixed-workload': [
    '3.1-realistic-day',
    '3.2-learning-applying',
    '3.3-long-conversation',
    '3.4-emergency-interrupt',
    '3.5-knowledge-synthesis'
  ]
};

// Category display names
const categoryNames = {
  '1-context-retention': 'Context Retention',
  '2-code-quality': 'Code Quality',
  '3-mixed-workload': 'Mixed Workload'
};

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generate HTML page template for a test
 */
function generateTestPage(testData, categoryName) {
  const turns = testData.turns.map(turn => `
          <div class="turn-card">
            <div class="turn-header">
              <div class="turn-number">Turn ${turn.number}</div>
            </div>
            <div class="turn-prompt">${escapeHtml(turn.prompt)}</div>
            <div class="turn-expected">
              <strong>Expected:</strong> ${escapeHtml(turn.expectedBehavior)}
            </div>
          </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test ${testData.id} - ${testData.name} | OpenClaw VS7</title>
  <link rel="stylesheet" href="../assets/css/styles.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
</head>
<body>
  <header class="header">
    <div class="header-content">
      <h1>
        <a href="../index.html" style="color: inherit;">OpenClaw VS7</a> / Test ${testData.id}
      </h1>
      <p class="subtitle">${testData.name} - ${categoryName} Test</p>
    </div>
  </header>

  <div class="container">
    <!-- Mode Toggle -->
    <div class="mode-toggle">
      <button class="mode-btn baseline active" data-mode="baseline">
        Baseline
      </button>
      <button class="mode-btn vs7" data-mode="vs7">
        VS7
      </button>
    </div>

    <!-- Test Specification -->
    <section class="main-content">
      <div id="test-spec" class="test-spec">
        <div class="test-spec-header">
          <div class="test-title-group">
            <h1>
              <span class="test-id">${testData.id}</span>
              ${testData.name}
            </h1>
            <p class="test-description">${escapeHtml(testData.description)}</p>
          </div>
        </div>

        <div class="turns-list">${turns}
        </div>
      </div>

      <!-- Metrics Panel -->
      <div id="metrics" class="metrics-panel">
        <div class="metric">
          <div class="metric-label">Files Generated</div>
          <div class="metric-value"><span class="spinner"></span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Total Tokens</div>
          <div class="metric-value"><span class="spinner"></span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Code Quality</div>
          <div class="metric-value"><span class="spinner"></span></div>
        </div>
        <div class="metric">
          <div class="metric-label">Tests Passed</div>
          <div class="metric-value"><span class="spinner"></span></div>
        </div>
      </div>

      <!-- Analysis -->
      <div id="analysis"></div>
    </section>

    <!-- File Tree and Code Viewer Layout -->
    <div class="test-layout mt-4">
      <aside class="sidebar">
        <h3>Files</h3>
        <div id="file-tree" class="file-tree">
          <div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <p>Loading files...</p>
          </div>
        </div>
      </aside>

      <main class="main-content">
        <div id="code-viewer" class="code-viewer">
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <p>Select a file to view its contents</p>
          </div>
        </div>
      </main>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-go.min.js"></script>
  <script src="../assets/js/app.js"></script>
</body>
</html>`;
}

/**
 * Main generation function
 */
function generateAllPages() {
  const testsDir = path.join(__dirname, 'tests');
  const testPromptsDir = path.join(__dirname, '../test-prompts');

  // Ensure tests directory exists
  if (!fs.existsSync(testsDir)) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  let generatedCount = 0;

  // Generate pages for each category
  for (const [category, tests] of Object.entries(testCategories)) {
    const categoryName = categoryNames[category];

    for (const testFile of tests) {
      const testId = testFile.split('-')[0];
      const promptPath = path.join(testPromptsDir, category, `${testFile}.json`);

      try {
        // Read test prompt data
        const testData = JSON.parse(fs.readFileSync(promptPath, 'utf8'));

        // Generate HTML page
        const html = generateTestPage(testData, categoryName);

        // Write to file
        const outputPath = path.join(testsDir, `test-${testId}.html`);
        fs.writeFileSync(outputPath, html, 'utf8');

        console.log(`✓ Generated test-${testId}.html`);
        generatedCount++;
      } catch (error) {
        console.error(`✗ Error generating test-${testId}.html:`, error.message);
      }
    }
  }

  console.log(`\n✓ Successfully generated ${generatedCount} test pages`);
}

// Run generation
generateAllPages();

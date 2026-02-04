/**
 * OpenClaw VS7 Showcase - Main Application
 */

class ShowcaseApp {
  constructor() {
    this.currentMode = 'baseline';
    this.currentFile = null;
    this.testData = null;
    this.fileTreeData = {};
    this.analysisData = null;
    this.fileIndexData = {};
  }

  /**
   * Initialize the application
   */
  async init() {
    this.setupModeToggle();
    this.setupSearch();
    await this.loadTestData();
    this.render();
  }

  /**
   * Setup mode toggle functionality
   */
  setupModeToggle() {
    const toggleButtons = document.querySelectorAll('.mode-btn');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentMode = btn.dataset.mode;
        toggleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render();
      });
    });
  }

  /**
   * Setup search functionality
   */
  setupSearch() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterTests(e.target.value);
      });
    }
  }

  /**
   * Filter tests based on search query
   */
  filterTests(query) {
    const testCards = document.querySelectorAll('.test-card');
    const lowerQuery = query.toLowerCase();

    testCards.forEach(card => {
      const testName = card.querySelector('h3').textContent.toLowerCase();
      const testDesc = card.querySelector('.description').textContent.toLowerCase();
      const testId = card.querySelector('.test-id').textContent.toLowerCase();

      if (testName.includes(lowerQuery) || testDesc.includes(lowerQuery) || testId.includes(lowerQuery)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }

  /**
   * Load test data from JSON file
   */
  async loadTestData() {
    const testId = this.getTestIdFromUrl();
    if (!testId) return;

    try {
      // Load test specification
      const category = this.getCategoryFromTestId(testId);
      const response = await fetch(`../../test-prompts/${category}/${testId.replace('.', '.')}.json`);
      this.testData = await response.json();

      // Load analysis data
      const groupId = testId.split('.')[0];
      const analysisResponse = await fetch(`../../analysis/output/group-${groupId}-analysis.json`);
      if (analysisResponse.ok) {
        const allAnalysis = await analysisResponse.json();
        this.analysisData = allAnalysis.tests?.find(t => t.testId === testId);
      }

      // Load file indexes for both modes
      await this.loadFileIndex('baseline', testId);
      await this.loadFileIndex('vs7', testId);

    } catch (error) {
      console.error('Error loading test data:', error);
    }
  }

  /**
   * Load pre-built file index for a mode
   */
  async loadFileIndex(mode, testId) {
    try {
      const response = await fetch(`../data/${mode}-${testId}.json`);
      if (response.ok) {
        const data = await response.json();
        this.fileIndexData[mode] = data;
        this.fileTreeData[mode] = data.tree;
      }
    } catch (error) {
      console.error(`Error loading file index for ${mode}:`, error);
      this.fileTreeData[mode] = null;
    }
  }

  /**
   * Render file tree
   */
  renderFileTree() {
    const container = document.getElementById('file-tree');
    if (!container) return;

    const tree = this.fileTreeData[this.currentMode];
    if (!tree || !tree.children || tree.children.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><p>No files found</p></div>';
      return;
    }

    // Build HTML for tree
    let html = '<ul class="file-tree">';
    tree.children.forEach(child => {
      html += this.renderTreeNode(child, 0);
    });
    html += '</ul>';

    container.innerHTML = html;
    this.attachFileTreeListeners();
  }

  /**
   * Render a tree node recursively
   */
  renderTreeNode(node, level) {
    if (node.type === 'file') {
      return `
        <li class="file-tree-item" data-path="${this.escapeHtml(node.path)}" style="padding-left: ${level * 12}px">
          <span class="file-icon">${this.getFileIcon(node.name)}</span>
          <span>${this.escapeHtml(node.name)}</span>
        </li>
      `;
    }

    // Folder node
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = level === 0; // Expand root level by default

    let html = `
      <li>
        <div class="file-tree-item folder" data-folder="${this.escapeHtml(node.path || '')}" style="padding-left: ${level * 12}px">
          ${hasChildren ? `<span class="folder-toggle ${isExpanded ? 'expanded' : ''}">▶</span>` : '<span style="width: 16px; display: inline-block;"></span>'}
          <span class="file-icon">📁</span>
          <span>${this.escapeHtml(node.name)}</span>
        </div>
    `;

    if (hasChildren) {
      html += `<ul class="file-tree-children ${isExpanded ? '' : 'hidden'}">`;
      node.children.forEach(child => {
        html += this.renderTreeNode(child, level + 1);
      });
      html += '</ul>';
    }

    html += '</li>';
    return html;
  }

  /**
   * Get file icon based on extension
   */
  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      'py': '🐍',
      'js': '📜',
      'ts': '📘',
      'json': '📋',
      'md': '📝',
      'yaml': '⚙️',
      'yml': '⚙️',
      'sh': '🔧',
      'go': '🔵',
      'html': '🌐',
      'css': '🎨',
      'txt': '📄',
      'toml': '⚙️',
      'env': '🔐',
      'gitignore': '🔒'
    };
    return icons[ext] || '📄';
  }

  /**
   * Attach event listeners to file tree
   */
  attachFileTreeListeners() {
    // Folder toggle
    document.querySelectorAll('.folder-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = e.target.closest('.file-tree-item');
        const children = item.nextElementSibling;
        toggle.classList.toggle('expanded');
        if (children && children.tagName === 'UL') {
          children.classList.toggle('hidden');
        }
      });
    });

    // File selection
    document.querySelectorAll('.file-tree-item[data-path]').forEach(item => {
      item.addEventListener('click', async () => {
        document.querySelectorAll('.file-tree-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        await this.loadAndDisplayFile(item.dataset.path);
      });
    });
  }

  /**
   * Load and display file content
   */
  async loadAndDisplayFile(filePath) {
    const testId = this.getTestIdFromUrl();
    const sessionName = this.currentMode === 'baseline'
      ? 'long-baseline-1770174088653'
      : 'long-vs7-1770176381223';
    const fullPath = `../../results/${sessionName}/test-${testId}/${filePath}`;

    try {
      const response = await fetch(fullPath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const content = await response.text();
      this.displayFileContent(filePath, content);
    } catch (error) {
      console.error('Error loading file:', error);
      this.displayFileContent(filePath, `// Error loading file: ${error.message}`);
    }
  }

  /**
   * Display file content with syntax highlighting
   */
  displayFileContent(filePath, content) {
    const viewer = document.getElementById('code-viewer');
    if (!viewer) return;

    const filename = filePath.split('/').pop();
    const language = this.detectLanguage(filename);

    viewer.innerHTML = `
      <div class="code-header">
        <div class="code-filename">${this.escapeHtml(filename)}</div>
        <div class="code-language">${language}</div>
      </div>
      <div class="code-content">
        <pre><code class="language-${language}">${this.escapeHtml(content)}</code></pre>
      </div>
    `;

    // Trigger Prism.js highlighting
    if (window.Prism) {
      Prism.highlightAll();
    }
  }

  /**
   * Detect programming language from filename
   */
  detectLanguage(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
      'py': 'python',
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'json': 'json',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sh': 'bash',
      'bash': 'bash',
      'go': 'go',
      'html': 'html',
      'css': 'css',
      'toml': 'toml',
      'sql': 'sql'
    };
    return langMap[ext] || 'plaintext';
  }

  /**
   * Escape HTML characters
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get test ID from URL
   */
  getTestIdFromUrl() {
    const match = window.location.pathname.match(/test-(\d+\.\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Get category from test ID
   */
  getCategoryFromTestId(testId) {
    const prefix = testId.split('.')[0];
    const categories = {
      '1': '1-context-retention',
      '2': '2-code-quality',
      '3': '3-mixed-workload'
    };
    return categories[prefix] || '1-context-retention';
  }

  /**
   * Render test specification
   */
  renderTestSpec() {
    const container = document.getElementById('test-spec');
    if (!container || !this.testData) return;

    const turns = this.testData.turns.map(turn => `
      <div class="turn-card">
        <div class="turn-header">
          <div class="turn-number">Turn ${turn.number}</div>
        </div>
        <div class="turn-prompt">${this.escapeHtml(turn.prompt)}</div>
        <div class="turn-expected">
          <strong>Expected:</strong> ${this.escapeHtml(turn.expectedBehavior)}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="test-spec-header">
        <div class="test-title-group">
          <h1>
            <span class="test-id">${this.testData.id}</span>
            ${this.testData.name}
          </h1>
          <p class="test-description">${this.escapeHtml(this.testData.description)}</p>
        </div>
      </div>
      <div class="turns-list">
        ${turns}
      </div>
    `;
  }

  /**
   * Render metrics panel
   */
  renderMetrics() {
    const container = document.getElementById('metrics');
    if (!container) return;

    const currentData = this.analysisData?.[this.currentMode];
    const otherMode = this.currentMode === 'baseline' ? 'vs7' : 'baseline';
    const otherData = this.analysisData?.[otherMode];
    const fileIndex = this.fileIndexData[this.currentMode];

    if (!currentData && !fileIndex) {
      container.innerHTML = '<div class="empty-state"><p>No metrics available</p></div>';
      return;
    }

    const filesGenerated = currentData?.filesGenerated || fileIndex?.summary?.totalFiles || 0;
    const totalTokens = currentData?.totalTokens || 0;
    const codeQuality = currentData?.codeQuality?.overallScore || 0;
    const testsPassed = currentData?.testsPassed;

    const filesDiff = otherData ? filesGenerated - (otherData.filesGenerated || 0) : 0;
    const tokensDiff = otherData ? totalTokens - (otherData.totalTokens || 0) : 0;
    const qualityDiff = otherData && currentData?.codeQuality && otherData.codeQuality
      ? currentData.codeQuality.overallScore - otherData.codeQuality.overallScore
      : 0;

    container.innerHTML = `
      <div class="metric">
        <div class="metric-label">Files Generated</div>
        <div class="metric-value">${filesGenerated}</div>
        ${otherData ? `<div class="metric-comparison">${filesDiff > 0 ? '+' : ''}${filesDiff} vs ${otherMode}</div>` : ''}
      </div>
      <div class="metric">
        <div class="metric-label">Total Tokens</div>
        <div class="metric-value">${totalTokens ? totalTokens.toLocaleString() : 'N/A'}</div>
        ${otherData ? `<div class="metric-comparison">${tokensDiff > 0 ? '+' : ''}${tokensDiff.toLocaleString()} vs ${otherMode}</div>` : ''}
      </div>
      <div class="metric">
        <div class="metric-label">Code Quality</div>
        <div class="metric-value">${codeQuality || 'N/A'}</div>
        ${otherData && qualityDiff !== 0 ? `<div class="metric-comparison">${qualityDiff > 0 ? '+' : ''}${qualityDiff} vs ${otherMode}</div>` : ''}
      </div>
      <div class="metric">
        <div class="metric-label">Tests Passed</div>
        <div class="metric-value">${testsPassed !== undefined ? (testsPassed ? '✓' : '✗') : 'N/A'}</div>
      </div>
    `;
  }

  /**
   * Render analysis section
   */
  renderAnalysis() {
    const container = document.getElementById('analysis');
    if (!container) return;

    const currentData = this.analysisData?.[this.currentMode];
    if (!currentData) {
      container.innerHTML = '';
      return;
    }

    const strengths = currentData.strengths?.map(s => `<li>${this.escapeHtml(s)}</li>`).join('') || '';
    const weaknesses = currentData.weaknesses?.map(w => `<li>${this.escapeHtml(w)}</li>`).join('') || '';

    container.innerHTML = `
      <div class="analysis-section">
        <h3>Strengths</h3>
        <ul class="analysis-list">${strengths || '<li>No strengths listed</li>'}</ul>
      </div>
      <div class="analysis-section">
        <h3>Weaknesses</h3>
        <ul class="analysis-list">${weaknesses || '<li>No weaknesses listed</li>'}</ul>
      </div>
    `;
  }

  /**
   * Main render function
   */
  render() {
    this.renderFileTree();
    this.renderTestSpec();
    this.renderMetrics();
    this.renderAnalysis();
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new ShowcaseApp();
  app.init();
});

// Export for use in other scripts
window.ShowcaseApp = ShowcaseApp;

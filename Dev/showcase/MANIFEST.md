# OpenClaw VS7 Showcase - File Manifest

This document catalogs all files created for the interactive web showcase.

## Summary Statistics

- **Total Files**: 57
- **HTML Pages**: 16 (1 index + 15 test pages)
- **CSS Files**: 1 (main stylesheet)
- **JavaScript Files**: 5 (app + 4 utilities)
- **JSON Files**: 31 (30 test indexes + 1 master index)
- **Documentation**: 4 files
- **Configuration**: 2 files

## Directory Structure

```
Dev/showcase/
├── Core Files (5)
│   ├── index.html              # Main landing page
│   ├── package.json            # NPM package configuration
│   ├── README.md               # Main documentation
│   ├── USAGE.md                # Quick start guide
│   └── MANIFEST.md             # This file
│
├── Assets (2)
│   ├── assets/css/
│   │   └── styles.css          # Main stylesheet (17KB)
│   └── assets/js/
│       └── app.js              # Main application logic (14KB)
│
├── Build Tools (4)
│   ├── generate-pages.js       # Generate test HTML pages
│   ├── build-file-index.js     # Index test result files
│   ├── start-server.js         # Development web server
│   └── verify.js               # Verification script
│
├── Test Pages (15)
│   └── tests/
│       ├── test-1.1.html       # Multi-Turn Memory
│       ├── test-1.2.html       # Context Switching
│       ├── test-1.3.html       # Memory.md Recall
│       ├── test-1.4.html       # Interrupted Task
│       ├── test-1.5.html       # Workspace File Reference
│       ├── test-2.1.html       # Multi-File Refactoring
│       ├── test-2.2.html       # Bug Fix
│       ├── test-2.3.html       # API Integration
│       ├── test-2.4.html       # Code Review
│       ├── test-2.5.html       # Codebase Analysis
│       ├── test-3.1.html       # Realistic Day Workflow
│       ├── test-3.2.html       # Learning & Applying
│       ├── test-3.3.html       # Long Conversation
│       ├── test-3.4.html       # Emergency Interrupt
│       └── test-3.5.html       # Knowledge Synthesis
│
└── Data Indexes (31)
    └── data/
        ├── index.json          # Master index
        ├── baseline-1.1.json   # Baseline test 1.1 file tree
        ├── vs7-1.1.json        # VS7 test 1.1 file tree
        ├── baseline-1.2.json
        ├── vs7-1.2.json
        └── ... (30 test indexes total)
```

## Detailed File Descriptions

### Core Files

#### index.html (13 KB)
- Main landing page for the showcase
- Features:
  - Dashboard with 4 key statistics
  - Search functionality for filtering tests
  - 15 test cards organized by 3 categories
  - Responsive grid layout
- Dependencies: styles.css
- Links: All 15 test pages

#### package.json (367 bytes)
- NPM package configuration
- Scripts:
  - `start`: Launch web server
  - `build:pages`: Generate test pages
  - `build:index`: Build file indexes
  - `build:all`: Full rebuild
  - `verify`: Check installation
- Module type: ES modules
- No external dependencies

#### README.md (7 KB)
- Comprehensive documentation
- Sections:
  - Features overview
  - Project structure
  - Setup instructions
  - Test categories
  - Usage guide
  - Customization
  - Troubleshooting

#### USAGE.md (7 KB)
- Quick start guide
- Getting started in 3 steps
- Command reference
- Navigation guide
- Workflow examples
- Troubleshooting

#### MANIFEST.md (This file)
- Complete file catalog
- Directory structure
- File descriptions
- Dependencies

### Assets

#### assets/css/styles.css (17 KB)
- Dark theme optimized for code viewing
- Features:
  - CSS custom properties for theming
  - Responsive grid layouts
  - Smooth transitions
  - Syntax highlighting overrides for Prism.js
  - Mobile-responsive design
- Color scheme:
  - Background: Dark blue-gray (#0d1117)
  - Baseline accent: Blue (#58a6ff)
  - VS7 accent: Purple (#bc8cff)
- Components styled:
  - Header, navigation
  - Dashboard cards
  - Test cards
  - File tree
  - Code viewer
  - Metrics panel
  - Analysis sections

#### assets/js/app.js (14 KB)
- Main application logic
- Class: ShowcaseApp
- Features:
  - Mode toggle (Baseline/VS7)
  - File tree rendering
  - Code viewer with syntax highlighting
  - Test specification display
  - Metrics comparison
  - Analysis rendering
  - Search functionality
- Methods: 20+ functions
- Dependencies: Prism.js (CDN)

### Build Tools

#### generate-pages.js (7 KB)
- Generates all 15 test HTML pages
- Input: Test prompt JSON files
- Output: Complete HTML pages
- Features:
  - Template-based generation
  - HTML escaping
  - Category organization
- Execution: `node generate-pages.js`

#### build-file-index.js (4 KB)
- Indexes all test result files
- Input: Test result directories
- Output: JSON file trees
- Features:
  - Recursive directory traversal
  - File metadata collection
  - Summary statistics
  - Hierarchical structure
- Generates: 31 JSON files
- Execution: `node build-file-index.js`

#### start-server.js (5 KB)
- Simple HTTP server for development
- Port: 8000 (configurable)
- Features:
  - Static file serving
  - MIME type detection
  - Security: Path traversal prevention
  - Graceful shutdown
- Supports: 15+ file types
- Execution: `node start-server.js`

#### verify.js (7 KB)
- Installation verification script
- Checks:
  - Core files present
  - Assets compiled
  - Test pages generated
  - File indexes built
  - Data sources available
- Output: Colored terminal report
- Exit codes: 0 (success), 1 (errors)
- Execution: `node verify.js`

### Test Pages (15 files)

Each test page includes:
- **Size**: ~4-5 KB each
- **Structure**:
  - Header with breadcrumb navigation
  - Mode toggle (Baseline/VS7)
  - Test specification section
  - Metrics panel
  - Analysis section
  - File tree sidebar
  - Code viewer main panel
- **Dependencies**:
  - styles.css
  - app.js
  - Prism.js (CDN)
  - 9 Prism language components (CDN)
- **Data Sources**:
  - Test prompts from `../test-prompts/`
  - Analysis from `../analysis/output/`
  - File indexes from `../data/`
  - File contents from `../results/`

#### Category 1: Context Retention (5 tests)
- test-1.1.html - Multi-Turn Memory
- test-1.2.html - Context Switching
- test-1.3.html - Memory.md Recall
- test-1.4.html - Interrupted Task
- test-1.5.html - Workspace File Reference

#### Category 2: Code Quality (5 tests)
- test-2.1.html - Multi-File Refactoring
- test-2.2.html - Bug Fix
- test-2.3.html - API Integration
- test-2.4.html - Code Review
- test-2.5.html - Codebase Analysis

#### Category 3: Mixed Workload (5 tests)
- test-3.1.html - Realistic Day Workflow
- test-3.2.html - Learning & Applying
- test-3.3.html - Long Conversation
- test-3.4.html - Emergency Interrupt
- test-3.5.html - Knowledge Synthesis

### Data Indexes (31 files)

#### index.json (Master Index)
- Contains:
  - Session names (baseline/VS7)
  - Test IDs (15 tests)
  - Mode list
  - Generation timestamp

#### Individual Test Indexes (30 files)
Format: `{mode}-{testId}.json`
- **Modes**: baseline, vs7
- **Test IDs**: 1.1-3.5 (15 total)
- **Structure**:
  - `tree`: Hierarchical file structure
  - `summary`: Statistics
    - Total files
    - Total size
    - Files by extension
    - Turn information

Example sizes:
- baseline-1.1.json: 168 files indexed
- vs7-1.1.json: 525 files indexed
- baseline-3.3.json: 1,443 files indexed (largest)
- vs7-3.3.json: 2,160 files indexed (largest)

## External Dependencies

### CDN Resources (No Installation Required)

**Prism.js Syntax Highlighting**
- Core: prism.min.js (v1.29.0)
- Theme: prism-tomorrow.min.css
- Languages:
  - Python
  - JavaScript
  - TypeScript
  - JSON
  - Markdown
  - YAML
  - Bash
  - Go
  - HTML/CSS

All loaded via CDN (cdnjs.cloudflare.com)

## Data Sources (External to Showcase)

### Test Prompts
Location: `Dev/test-prompts/`
- 15 JSON files defining test specifications
- Organized by category

### Test Results
Location: `Dev/results/`
- Baseline: `long-baseline-1770174088653/`
- VS7: `long-vs7-1770176381223/`
- 15 test directories each
- Thousands of generated files total

### Analysis Data
Location: `Dev/analysis/output/`
- group-1-analysis.json
- group-2-analysis.json
- group-3-analysis.json
- Generated by aggregator

## Build Process

### Initial Build
```bash
npm run build:pages    # Generate 15 HTML pages
npm run build:index    # Generate 31 JSON indexes
```

### Incremental Updates
- **Test prompts changed**: `npm run build:pages`
- **New test results**: `npm run build:index`
- **Both changed**: `npm run build:all`

## File Sizes

### Total Showcase Size
- Source files: ~100 KB
- Generated files: ~150 KB
- Data indexes: ~50 MB (includes all file paths)
- **Total**: ~50 MB

### Individual File Sizes
- HTML pages: 3-5 KB each
- CSS: 17 KB
- JavaScript: 14 KB
- JSON indexes: 50 KB - 5 MB each (varies by test)

## Browser Compatibility

All files tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Version History

### v1.0.0 (2026-02-03)
- Initial release
- 15 test pages
- Full interactive functionality
- Dark theme
- Syntax highlighting
- File tree navigation
- Mode comparison
- Metrics dashboard

## Maintenance

### Regular Tasks
1. **After new test runs**: Rebuild indexes
2. **Test prompt updates**: Regenerate pages
3. **Analysis updates**: Refresh browser
4. **Verification**: Run `npm run verify`

### File Integrity
Run verification to ensure all files are present:
```bash
npm run verify
```

## License

Part of the OpenClaw project. See main repository for license information.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-02-03
**Total Files Documented**: 57

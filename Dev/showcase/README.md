# OpenClaw VS7 Test Results Showcase

An interactive web application for exploring and comparing OpenClaw Baseline vs VS7 test results.

## Features

- **Interactive Test Browser**: Navigate through 15 comprehensive tests across 3 categories
- **Side-by-Side Comparison**: Toggle between Baseline and VS7 results
- **File Explorer**: Browse all generated files with syntax highlighting
- **Metrics Dashboard**: Compare file counts, token usage, and code quality scores
- **Analysis Insights**: View strengths and weaknesses for each test run
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Project Structure

```
showcase/
├── index.html              # Main landing page with all tests
├── tests/                  # Individual test result pages
│   ├── test-1.1.html      # Multi-Turn Memory
│   ├── test-1.2.html      # Context Switching
│   └── ...                # 15 total test pages
├── assets/
│   ├── css/
│   │   └── styles.css     # Main stylesheet (dark theme)
│   └── js/
│       └── app.js         # Main application logic
├── data/                   # Pre-built file indexes
│   ├── baseline-1.1.json  # File tree for baseline test 1.1
│   ├── vs7-1.1.json       # File tree for VS7 test 1.1
│   └── ...                # 30 total index files
├── generate-pages.js       # Script to generate test pages
└── build-file-index.js     # Script to index test results
```

## Setup & Usage

### Prerequisites

- Node.js 16+ (for build scripts only)
- Modern web browser (Chrome, Firefox, Edge, Safari)
- A local web server (Python, Node http-server, or VS Code Live Server)

### Initial Setup

1. **Generate Test Pages**
   ```bash
   cd Dev/showcase
   node generate-pages.js
   ```
   This creates all 15 test HTML pages from the test prompt definitions.

2. **Build File Indexes**
   ```bash
   node build-file-index.js
   ```
   This scans the results directories and creates JSON indexes for fast file tree navigation.

### Running the Showcase

Since this is a static web application, you need a local web server to avoid CORS issues:

**Option 1: Python**
```bash
cd Dev/showcase
python -m http.server 8000
```
Then open http://localhost:8000

**Option 2: Node.js http-server**
```bash
npm install -g http-server
cd Dev/showcase
http-server -p 8000
```
Then open http://localhost:8000

**Option 3: VS Code Live Server**
1. Install "Live Server" extension
2. Right-click `index.html` and select "Open with Live Server"

## Test Categories

### 1. Context Retention (Tests 1.1-1.5)
Tests the agent's ability to remember information across conversation turns.

- **1.1 Multi-Turn Memory**: Project details across 3 turns
- **1.2 Context Switching**: Rapid topic switches
- **1.3 Memory.md Recall**: Using memory file information
- **1.4 Interrupted Task**: Resuming after interruptions
- **1.5 Workspace File Reference**: Referencing earlier created files

### 2. Code Quality (Tests 2.1-2.5)
Tests code generation, refactoring, and analysis capabilities.

- **2.1 Multi-File Refactoring**: JS to TypeScript conversion
- **2.2 Bug Fix**: Finding and fixing race conditions
- **2.3 API Integration**: Complete API client with error handling
- **2.4 Code Review**: Identifying issues and improvements
- **2.5 Codebase Analysis**: Architecture recommendations

### 3. Mixed Workload (Tests 3.1-3.5)
Simulates realistic development workflows with varied tasks.

- **3.1 Realistic Day**: Multiple context switches throughout a workday
- **3.2 Learning & Applying**: Learn and immediately apply concepts
- **3.3 Long Conversation**: Extended session with many code changes
- **3.4 Emergency Interrupt**: Handling urgent tasks
- **3.5 Knowledge Synthesis**: Combining multiple information sources

## How to Use

### Main Index Page

1. Browse all 15 tests organized by category
2. Use the search box to filter tests by name or description
3. Click any test card to view detailed results

### Individual Test Pages

1. **Toggle Mode**: Switch between Baseline and VS7 results
2. **View Test Specification**: See all turn prompts and expected behaviors
3. **Browse Files**: Navigate the file tree to explore generated code
4. **View Code**: Click any file to see syntax-highlighted source code
5. **Compare Metrics**: Check file counts, tokens, and quality scores
6. **Read Analysis**: Review strengths and weaknesses

### Keyboard Navigation

- Use Tab to navigate between interactive elements
- Arrow keys to scroll through file trees
- Enter to select files

## Technology Stack

- **Pure HTML/CSS/JavaScript** - No frameworks required
- **Prism.js** - Syntax highlighting for 9+ languages
- **CSS Grid & Flexbox** - Responsive layout system
- **Dark Theme** - Optimized for code viewing

## Data Sources

The showcase pulls data from:

- **Test Prompts**: `Dev/test-prompts/` - Test specifications and turn prompts
- **Test Results**: `Dev/results/` - Generated files from baseline and VS7 runs
- **Analysis Data**: `Dev/analysis/output/` - Aggregated metrics and insights

## Customization

### Changing the Theme

Edit `assets/css/styles.css` and modify the CSS variables in `:root`:

```css
:root {
  --bg-primary: #0d1117;        /* Main background */
  --accent-baseline: #58a6ff;   /* Baseline accent color */
  --accent-vs7: #bc8cff;        /* VS7 accent color */
  /* ... more variables */
}
```

### Adding New Tests

1. Add test prompt JSON to appropriate category in `Dev/test-prompts/`
2. Run test with orchestrator to generate results
3. Run `node generate-pages.js` to create test page
4. Run `node build-file-index.js` to index results
5. Update `index.html` to add test card

## Performance Notes

- File indexes are pre-built for fast loading
- Syntax highlighting is applied on-demand
- File contents are lazy-loaded when clicked
- Large files may take a moment to load and highlight

## Browser Compatibility

Tested and working on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

**Problem**: Files won't load (CORS errors)
- **Solution**: Use a local web server (see "Running the Showcase" above)

**Problem**: File tree is empty
- **Solution**: Run `node build-file-index.js` to rebuild indexes

**Problem**: Test pages show incorrect data
- **Solution**: Run `node generate-pages.js` to regenerate pages

**Problem**: Syntax highlighting not working
- **Solution**: Check browser console for Prism.js errors, ensure CDN is accessible

## License

Part of the OpenClaw project. See main repository for license information.

## Contributing

To add features or fix issues:

1. Modify source files in `assets/css/` or `assets/js/`
2. Test changes across different browsers
3. Update this README if needed
4. Submit a pull request

## Contact

For questions or issues with the showcase, please open an issue in the main OpenClaw repository.

# OpenClaw VS7 Showcase - Quick Start Guide

## Getting Started in 3 Steps

### 1. Build the Showcase (First Time Only)

```bash
cd Dev/showcase
npm run build:all
```

This will:
- Generate all 15 test pages from test prompt definitions
- Index all test result files for fast navigation
- Create approximately 31 JSON files (30 test indexes + 1 master index)

**Expected output:**
```
✓ Generated 15 test pages
✓ Successfully indexed 30 test results
✓ Created master index
```

### 2. Start the Server

```bash
npm start
```

**Expected output:**
```
╔════════════════════════════════════════════════════════════════╗
║  OpenClaw VS7 Showcase Server                                  ║
╚════════════════════════════════════════════════════════════════╝

  🚀 Server running at: http://localhost:8000
  📁 Serving from: C:\dev\Utils\OpenClaw\Dev\showcase

  Press Ctrl+C to stop the server
```

### 3. Open in Browser

Navigate to: **http://localhost:8000**

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the web server on port 8000 |
| `npm run build:pages` | Regenerate all test HTML pages |
| `npm run build:index` | Rebuild file tree indexes |
| `npm run build:all` | Rebuild everything (pages + indexes) |
| `npm run rebuild` | Rebuild everything and start server |

## Navigating the Showcase

### Main Index Page (`/index.html`)

The landing page shows:
- **Dashboard**: Key statistics (15 tests, 3 categories, 45+ turns)
- **Search Bar**: Filter tests by name, ID, or description
- **Test Cards**: All 15 tests organized by category
  - Context Retention (5 tests)
  - Code Quality (5 tests)
  - Mixed Workload (5 tests)

**Actions:**
- Click any test card to view detailed results
- Use search to quickly find specific tests
- Hover over cards for visual feedback

### Individual Test Pages (`/tests/test-X.X.html`)

Each test page includes:

#### 1. Mode Toggle
Switch between Baseline and VS7 results:
- **Baseline**: Original implementation
- **VS7**: New context management system

#### 2. Test Specification
- Test ID and name
- Description of what's being tested
- All conversation turns with:
  - Prompt text
  - Expected behavior

#### 3. Metrics Panel
Compare key metrics between modes:
- **Files Generated**: Total number of files created
- **Total Tokens**: Token usage for the session
- **Code Quality**: Overall quality score (0-100)
- **Tests Passed**: Whether success criteria were met

Metrics show:
- Current mode value
- Comparison to other mode (+/- difference)

#### 4. File Explorer (Left Sidebar)
Browse all generated files:
- **Folder icons** (📁): Click to expand/collapse
- **File icons**: Language-specific (🐍 Python, 📜 JS, etc.)
- **Active highlight**: Selected file is highlighted
- **Hierarchical structure**: Organized by turns

#### 5. Code Viewer (Main Panel)
View file contents with:
- **Syntax highlighting**: Prism.js for 9+ languages
- **File header**: Shows filename and language
- **Scrollable content**: Max height 600px
- **Line numbers**: Courtesy of Prism.js

#### 6. Analysis Section
Detailed insights for each mode:
- **Strengths**: What the agent did well
- **Weaknesses**: Areas for improvement
- **Context retention**: How well it remembered across turns
- **Code quality**: Specific quality observations

## Workflow Examples

### Compare Test Results

1. Open test page (e.g., `test-1.1.html`)
2. Review test specification to understand the task
3. Click **Baseline** mode
4. Browse files to see what was generated
5. Click **VS7** mode
6. Compare file structure and metrics
7. Review analysis to understand differences

### Explore a Specific File

1. Select a test page
2. Choose mode (Baseline or VS7)
3. Navigate file tree to find file:
   - Expand folders by clicking folder icon
   - Scroll through file list
4. Click file name
5. File content appears with syntax highlighting
6. Scroll through code to review

### Search for a Test

1. On main index page
2. Type search term (e.g., "refactor", "memory", "2.3")
3. Test cards filter in real-time
4. Click matching test to view details

### Analyze Code Quality

1. Open test page
2. Toggle between Baseline and VS7
3. Compare **Code Quality** metric
4. Read **Strengths** and **Weaknesses**
5. Browse specific files to see examples
6. Use insights to understand improvements

## File Locations

### Source Data
- Test prompts: `Dev/test-prompts/`
- Test results: `Dev/results/`
- Analysis data: `Dev/analysis/output/`

### Generated Files
- Test pages: `Dev/showcase/tests/`
- File indexes: `Dev/showcase/data/`

### Assets
- Stylesheet: `Dev/showcase/assets/css/styles.css`
- JavaScript: `Dev/showcase/assets/js/app.js`

## Updating After New Test Runs

If you run new tests or update results:

```bash
# Rebuild file indexes to reflect new results
npm run build:index

# If test prompts changed, regenerate pages too
npm run build:all

# Then restart server
npm start
```

## Troubleshooting

### Issue: Server won't start

**Error:** `Port 8000 already in use`

**Solution:**
```bash
# Kill process on port 8000
npx kill-port 8000

# Or use a different port
PORT=8080 npm start
```

### Issue: Files won't load (CORS errors)

**Problem:** Opened `index.html` directly in browser

**Solution:** Always use the server:
```bash
npm start
```

### Issue: File tree is empty

**Problem:** File indexes not built

**Solution:**
```bash
npm run build:index
```

### Issue: Test page shows wrong prompts

**Problem:** Test prompts updated but pages not regenerated

**Solution:**
```bash
npm run build:pages
```

### Issue: Metrics show N/A

**Problem:** Analysis data not generated yet

**Solution:**
1. Ensure test results exist in `Dev/results/`
2. Run aggregator: `cd Dev/analysis && npm run aggregate`
3. Refresh browser

## Performance Tips

- **Large files**: May take 1-2 seconds to load and highlight
- **Many files**: File tree renders ~1000 files instantly
- **Browser cache**: Use Ctrl+F5 for hard refresh if changes don't appear
- **Network**: All files load from localhost (fast)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Tab | Navigate interactive elements |
| Enter | Select file/folder |
| Escape | Clear search (if focused) |
| Ctrl+F | Browser search in current page |
| F5 | Refresh page |
| Ctrl+F5 | Hard refresh (clear cache) |

## Best Practices

1. **Always use the server** - Don't open HTML files directly
2. **Rebuild after test runs** - Keep indexes up to date
3. **Use search** - Faster than scrolling through all tests
4. **Compare modes side-by-side** - Toggle frequently to spot differences
5. **Read analysis first** - Get context before diving into code

## Advanced Usage

### Custom Port

```bash
PORT=3000 npm start
```

### Network Access

To access from other devices on your network:

1. Find your local IP (e.g., 192.168.1.100)
2. Start server as usual
3. Access from other device: `http://192.168.1.100:8000`

Note: May require firewall configuration

### Batch Viewing

Open multiple test pages in browser tabs:
1. Right-click test cards
2. Select "Open Link in New Tab"
3. Toggle between tabs for quick comparison

## Next Steps

After exploring the showcase:

1. **Review findings**: Document key differences between Baseline and VS7
2. **Share results**: Showcase is self-contained and shareable
3. **Run more tests**: Add new test scenarios to expand coverage
4. **Customize**: Modify CSS/JS to fit your needs

## Support

For issues or questions:
- Check `README.md` for detailed documentation
- Review test prompt definitions in `Dev/test-prompts/`
- Examine aggregator output in `Dev/analysis/output/`
- Open issue in main OpenClaw repository

---

**Happy exploring!** 🚀

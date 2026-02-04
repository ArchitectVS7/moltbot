# OpenClaw VS7 Showcase - Quick Start

Get the showcase running in 60 seconds.

## Prerequisites

- Node.js 16+ installed
- OpenClaw test results in `Dev/results/`

## Steps

### 1. Navigate to Showcase

```bash
cd Dev/showcase
```

### 2. Build Everything (First Time Only)

```bash
npm run build:all
```

Expected output:
```
✓ Generated test-1.1.html
✓ Generated test-1.2.html
... (15 total)

✓ Indexed test-1.1 (168 files)
✓ Indexed test-1.2 (180 files)
... (30 total)

✓ Successfully generated 15 test pages
✓ Successfully indexed 30 test results
```

### 3. Verify Installation (Optional)

```bash
npm run verify
```

Should show: `✓ All checks passed!`

### 4. Start Server

```bash
npm start
```

Expected output:
```
╔════════════════════════════════════════════════════════════════╗
║  OpenClaw VS7 Showcase Server                                  ║
╚════════════════════════════════════════════════════════════════╝

  🚀 Server running at: http://localhost:8000
  📁 Serving from: C:\dev\Utils\OpenClaw\Dev\showcase

  Press Ctrl+C to stop the server
```

### 5. Open in Browser

Navigate to: **http://localhost:8000**

## What You'll See

1. **Main page**: 15 test cards organized by category
2. **Click any test**: View detailed results
3. **Toggle modes**: Switch between Baseline and VS7
4. **Browse files**: Navigate generated code
5. **Compare metrics**: See performance differences

## Common Tasks

### Rebuild After New Test Run

```bash
npm run build:index
npm start
```

### Update Test Pages

```bash
npm run build:pages
```

### Full Rebuild

```bash
npm run rebuild
```

## Troubleshooting

**Port 8000 in use?**
```bash
PORT=3000 npm start
```

**Files not loading?**
- Always use `npm start` (don't open HTML directly)
- Check that you're in the `Dev/showcase` directory

**Empty file tree?**
```bash
npm run build:index
```

## Next Steps

- Read [USAGE.md](USAGE.md) for detailed navigation guide
- See [README.md](README.md) for full documentation
- Check [MANIFEST.md](MANIFEST.md) for file catalog

---

**Need help?** Run `npm run verify` to check your setup.

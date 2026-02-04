/**
 * Build file index for all test results
 * This creates JSON files that map out the directory structure
 * for each test, making it easy for the web app to navigate files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_DIR = path.join(__dirname, '../results');
const OUTPUT_DIR = path.join(__dirname, 'data');

// Session configurations
const sessions = {
  baseline: 'long-baseline-1770174088653',
  vs7: 'long-vs7-1770176381223'
};

/**
 * Recursively build file tree structure
 */
function buildFileTree(dirPath, relativePath = '') {
  const items = fs.readdirSync(dirPath);
  const tree = {
    name: path.basename(dirPath),
    type: 'folder',
    path: relativePath,
    children: []
  };

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const itemRelPath = relativePath ? `${relativePath}/${item}` : item;
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      // Recursively process subdirectory
      tree.children.push(buildFileTree(fullPath, itemRelPath));
    } else if (stats.isFile()) {
      // Add file to tree
      tree.children.push({
        name: item,
        type: 'file',
        path: itemRelPath,
        size: stats.size,
        extension: path.extname(item).slice(1) || 'txt'
      });
    }
  }

  // Sort: folders first, then files, alphabetically
  tree.children.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return tree;
}

/**
 * Build index for a single test
 */
function buildTestIndex(sessionName, testId) {
  const testDir = path.join(RESULTS_DIR, sessionName, `test-${testId}`);

  if (!fs.existsSync(testDir)) {
    console.warn(`⚠ Test directory not found: ${testDir}`);
    return null;
  }

  try {
    const tree = buildFileTree(testDir);

    // Count files and get summary info
    const summary = {
      testId,
      totalFiles: 0,
      totalSize: 0,
      filesByExtension: {},
      turns: []
    };

    // Recursive function to count files
    function countFiles(node) {
      if (node.type === 'file') {
        summary.totalFiles++;
        summary.totalSize += node.size;
        summary.filesByExtension[node.extension] =
          (summary.filesByExtension[node.extension] || 0) + 1;
      } else if (node.children) {
        node.children.forEach(countFiles);
      }
    }

    countFiles(tree);

    // Extract turn information
    tree.children.forEach(child => {
      if (child.type === 'folder' && child.name.startsWith('turn-')) {
        summary.turns.push({
          name: child.name,
          fileCount: child.children?.filter(c => c.type === 'file').length || 0
        });
      }
    });

    return {
      tree,
      summary
    };
  } catch (error) {
    console.error(`✗ Error building index for test ${testId}:`, error.message);
    return null;
  }
}

/**
 * Main build function
 */
function buildAllIndexes() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const testIds = [
    '1.1', '1.2', '1.3', '1.4', '1.5',
    '2.1', '2.2', '2.3', '2.4', '2.5',
    '3.1', '3.2', '3.3', '3.4', '3.5'
  ];

  let indexedCount = 0;

  for (const [mode, sessionName] of Object.entries(sessions)) {
    console.log(`\nIndexing ${mode} session: ${sessionName}`);

    for (const testId of testIds) {
      const index = buildTestIndex(sessionName, testId);

      if (index) {
        const outputPath = path.join(OUTPUT_DIR, `${mode}-${testId}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf8');
        console.log(`  ✓ Indexed test-${testId} (${index.summary.totalFiles} files)`);
        indexedCount++;
      }
    }
  }

  console.log(`\n✓ Successfully indexed ${indexedCount} test results`);

  // Create master index
  const masterIndex = {
    sessions,
    tests: testIds,
    modes: Object.keys(sessions),
    generatedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'index.json'),
    JSON.stringify(masterIndex, null, 2),
    'utf8'
  );

  console.log('✓ Created master index');
}

// Run build
buildAllIndexes();

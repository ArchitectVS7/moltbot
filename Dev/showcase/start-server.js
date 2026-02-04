#!/usr/bin/env node

/**
 * Quick start server for OpenClaw VS7 Showcase
 * Run with: node start-server.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;
const ROOT_DIR = __dirname;

// MIME types for common file extensions
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.py': 'text/plain',
  '.ts': 'text/plain',
  '.go': 'text/plain',
  '.sh': 'text/plain',
  '.yaml': 'text/plain',
  '.yml': 'text/plain',
  '.toml': 'text/plain'
};

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Serve static files
 */
function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>500 Internal Server Error</h1>');
      }
      return;
    }

    const mimeType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

/**
 * Main request handler
 */
function handleRequest(req, res) {
  let urlPath = req.url;

  // Remove query string
  const queryIndex = urlPath.indexOf('?');
  if (queryIndex !== -1) {
    urlPath = urlPath.substring(0, queryIndex);
  }

  // Decode URL
  urlPath = decodeURIComponent(urlPath);

  // Default to index.html
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Resolve file path
  let filePath = path.join(ROOT_DIR, urlPath);

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Try with .html extension
      if (!filePath.endsWith('.html')) {
        const htmlPath = filePath + '.html';
        fs.stat(htmlPath, (htmlErr, htmlStats) => {
          if (!htmlErr && htmlStats.isFile()) {
            serveStaticFile(htmlPath, res);
          } else {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
          }
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      }
      return;
    }

    serveStaticFile(filePath, res);
  });
}

// Create and start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  OpenClaw VS7 Showcase Server                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`  🚀 Server running at: http://localhost:${PORT}`);
  console.log(`  📁 Serving from: ${ROOT_DIR}\n`);
  console.log('  Press Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n\n  Shutting down server...');
  server.close(() => {
    console.log('  Server stopped.\n');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n  Shutting down server...');
  server.close(() => {
    console.log('  Server stopped.\n');
    process.exit(0);
  });
});

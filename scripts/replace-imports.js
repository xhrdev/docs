#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node replace-imports.js <file-path>');
  process.exit(1);
}

const fullPath = join(projectRoot, filePath);

try {
  let content = readFileSync(fullPath, 'utf-8');
  
  // Replace the import statement
  content = content.replace(
    /from ['"]\.\/spec\.js['"]/g,
    "from './spec-generated.js'"
  );
  
  writeFileSync(fullPath, content, 'utf-8');
  console.log(`✅ Updated imports in ${filePath}`);
} catch (error) {
  console.error(`❌ Error updating ${filePath}:`, error.message);
  process.exit(1);
}

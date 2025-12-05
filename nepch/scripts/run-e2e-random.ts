import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get limit from env or args
const limit = process.env.TEST_LIMIT ? parseInt(process.env.TEST_LIMIT) : 1;

const charactersDir = path.join(__dirname, '../e2etest/characters');
const characterFiles = fs.readdirSync(charactersDir).filter(f => f.endsWith('.md'));

// Shuffle
for (let i = characterFiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [characterFiles[i], characterFiles[j]] = [characterFiles[j], characterFiles[i]];
}

// Select N
const selected = characterFiles.slice(0, limit);
const targetFiles = selected.join(',');

console.log(`Selected ${selected.length} characters: ${targetFiles}`);

const cmd = `TEST_TARGET_FILES=${targetFiles} bun x playwright test`;
console.log(`Running: ${cmd}`);

const child = exec(cmd);

child.stdout?.pipe(process.stdout);
child.stderr?.pipe(process.stderr);

child.on('exit', (code) => {
    process.exit(code || 0);
});

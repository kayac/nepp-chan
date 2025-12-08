import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../'); // nepch/src/mastra/services -> nepch

export class TestService {
    async runRandomE2E(limit: number = 1): Promise<{ success: boolean; message: string }> {
        return new Promise((resolve, reject) => {
            try {
                const charactersDir = path.join(projectRoot, 'e2etest/characters');

                if (!fs.existsSync(charactersDir)) {
                    reject(new Error(`Characters directory not found: ${charactersDir}`));
                    return;
                }

                const characterFiles = fs.readdirSync(charactersDir).filter(f => f.endsWith('.md'));

                if (characterFiles.length === 0) {
                    reject(new Error('No character files found'));
                    return;
                }

                // Shuffle
                for (let i = characterFiles.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [characterFiles[i], characterFiles[j]] = [characterFiles[j], characterFiles[i]];
                }

                // Select N
                const selected = characterFiles.slice(0, limit);
                const targetFiles = selected.join(',');

                console.log(`[TestService] Selected ${selected.length} characters: ${targetFiles}`);

                const cmd = `TEST_TARGET_FILES=${targetFiles} bun x playwright test`;
                console.log(`[TestService] Running: ${cmd}`);

                // We are executing this in the project root
                const child = exec(cmd, { cwd: projectRoot });

                let stdout = '';
                let stderr = '';

                child.stdout?.on('data', (data) => {
                    process.stdout.write(data); // Stream to server logs too
                    stdout += data;
                });

                child.stderr?.on('data', (data) => {
                    process.stderr.write(data);
                    stderr += data;
                });

                child.on('exit', (code) => {
                    if (code === 0) {
                        resolve({ success: true, message: `Test completed successfully:\n${stdout}` });
                    } else {
                        // Playwright tests might fail, but the execution itself worked. 
                        // We resolve with success: false but provide output.
                        console.error(`[TestService] Test execution failed with code ${code}`);
                        resolve({ success: false, message: `Test failed with code ${code}.\nErrors:\n${stderr}` });
                    }
                });

                child.on('error', (err) => {
                    reject(err);
                });

            } catch (error) {
                reject(error);
            }
        });
    }
}

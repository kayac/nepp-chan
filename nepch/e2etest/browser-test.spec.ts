import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

import { fileURLToPath } from 'url';
import 'dotenv/config';

// Load environment variables if not already loaded (Bun loads .env automatically)
// If running with plain node, you might need dotenv.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const charactersDir = path.join(__dirname, 'characters');
const characterFiles = fs.readdirSync(charactersDir).filter(f => f.endsWith('.md'));

// Sort files to ensure consistent order (A.md, B.md, ...)
characterFiles.sort();

// Filter files if TEST_TARGET_FILES is set (comma separated)
if (process.env.TEST_TARGET_FILES) {
    const targets = process.env.TEST_TARGET_FILES.split(',');
    console.log(`Filtering tests for: ${targets.join(', ')}`);
    // Filter characterFiles to only include those in targets
    // We modify the array in place or create a new one. Since it's const, we can't reassign, but we can splice.
    // Actually, let's just create a new list and iterate over it, but the loop uses characterFiles.
    // Better to filter the existing array.
    const filtered = characterFiles.filter(f => targets.includes(f));
    characterFiles.length = 0;
    characterFiles.push(...filtered);
} else {
    console.log('Running in BULK mode (all characters).');
}

for (const file of characterFiles) {
    test(`Conversation with ${file}`, async ({ page }) => {
        test.setTimeout(45000); // Set timeout to 45 seconds

        const content = fs.readFileSync(path.join(charactersDir, file), 'utf-8');



        console.log(`Starting conversation with ${file}...`);

        // Navigate to the app
        await page.goto('http://localhost:5173');

        // Wait for the input area to be ready
        const inputLocator = page.locator('input[type="text"]');
        try {
            await expect(inputLocator).toBeVisible({ timeout: 30000 });
        } catch (e) {
            const screenshotDir = 'e2etest/test-results/screenshots';
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            fs.writeFileSync(`${screenshotDir}/debug-${file.replace('.md', '.html')}`, await page.content());
            throw e;
        }

        let conversationHistory: { role: 'user' | 'assistant', content: string }[] = [];

        for (let i = 0; i < 3; i++) {
            console.log(`[${file}] Turn ${i + 1} generating...`);

            // Generate message using LLM
            const currentPrompt = i === 0 ? "ネップちゃんに話しかけてください。" : "ネップちゃんの返答に対して返事をしてください。";
            const messages = [
                ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
                { role: 'user' as const, content: currentPrompt }
            ];

            const { text: userMessage } = await generateText({
                model: google('gemini-2.0-flash'),
                system: `あなたはロールプレイ俳優です。以下のキャラクター設定になりきって、村のAIアシスタント「ネップちゃん」に話しかけてください。
      
      条件:
      - 50文字以内で短く話してください。
      - キャラクターの口調や方言を反映させてください。
      - 出力はセリフのみにしてください（「」などは不要）。
      - 会話の流れを意識してください。

      ${content}`,
                messages: messages,
            });
            console.log(`[${file}] Turn ${i + 1} User: ${userMessage}`);
            conversationHistory.push({ role: 'user', content: userMessage });

            // Get current message count
            const messageCount = await page.locator('.whitespace-pre-wrap').count();

            // Fill the message
            await inputLocator.fill(userMessage);

            // Click submit button
            await page.getByRole('button', { name: '送信' }).click();

            // Wait for processing to start (button disabled)
            const submitButton = page.getByRole('button', { name: '送信' });
            await expect(submitButton).toBeDisabled();

            // Wait for processing to finish (input enabled)
            // The submit button remains disabled if input is empty, so we check the input field instead
            await expect(inputLocator).toBeEnabled({ timeout: 30000 });

            // Extract the last message content
            const lastMessageLocator = page.locator('.whitespace-pre-wrap').last();
            const lastMessageText = await lastMessageLocator.innerText();

            console.log(`[${file}] Turn ${i + 1} Assistant: ${lastMessageText}`);

            if (!lastMessageText.trim()) {
                throw new Error(`[${file}] Turn ${i + 1} Assistant response was empty!`);
            }

            conversationHistory.push({ role: 'assistant', content: lastMessageText });

            // Capture screenshot
            const screenshotDir = 'e2etest/test-results/screenshots';
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
            }
            await page.screenshot({ path: `${screenshotDir}/${file.replace('.md', '')}_turn${i + 1}.png` });
        }
    });
}

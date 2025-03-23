import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';

const MOBILE_VIEWPORT = {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
};

async function takeScreenshot(url, outputPath) {
    console.log(`Taking screenshot of ${url}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport(MOBILE_VIEWPORT);
        
        // Navigate with timeout and wait for network idle
        await page.goto(url, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
        });

        // Wait additional time for any animations/loading
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({
            path: outputPath,
            fullPage: false,
            type: 'jpeg',
            quality: 90
        });

        // Optimize and resize image
        await sharp(outputPath)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .jpeg({ quality: 85 })
            .toFile(outputPath + '.tmp');

        // Replace original with optimized version
        await fs.rename(outputPath + '.tmp', outputPath);

    } catch (error) {
        console.error(`Error taking screenshot of ${url}:`, error);
        throw error;
    } finally {
        await browser.close();
    }
}

async function processChangedGames() {
    try {
        // Get the base branch (usually main)
        const baseBranch = process.env.GITHUB_BASE_REF || 'main';
        console.log(`Base branch: ${baseBranch}`);
        
        // Get list of changed files between base branch and current branch
        let changedFiles;
        try {
            changedFiles = execSync(`git diff --name-only origin/${baseBranch}...HEAD`, { encoding: 'utf8' })
                .trim()
                .split('\n')
                .filter(file => file && file.endsWith('game.json'));
        } catch (error) {
            console.log('Error getting changed files:', error);
            // Fallback to checking all game.json files in the current directory
            console.log('Falling back to checking current directory...');
            const allFiles = execSync('git ls-files "*.json"', { encoding: 'utf8' })
                .trim()
                .split('\n')
                .filter(file => file && file.endsWith('game.json'));
            changedFiles = allFiles;
        }

        if (!changedFiles.length) {
            console.log('No game.json files found');
            return;
        }

        console.log('Processing game.json files:', changedFiles);

        // Process each changed game.json
        for (const filename of changedFiles) {
            const gameDir = path.dirname(filename);
            const gameJson = JSON.parse(
                await fs.readFile(filename, 'utf8')
            );

            if (!gameJson.url) {
                console.log(`No URL found in ${filename}, skipping`);
                continue;
            }

            // Create images directory if it doesn't exist
            const imagesDir = path.join(gameDir, 'images');
            await fs.mkdir(imagesDir, { recursive: true });

            // Generate timestamp for the filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const screenshotPath = path.join(
                imagesDir, 
                `screenshot-${timestamp}.jpg`
            );

            // Take screenshot
            await takeScreenshot(gameJson.url, screenshotPath);

            // Update game.json with new screenshot
            gameJson.cover_image = {
                type: "github",
                path: `images/screenshot-${timestamp}.jpg`
            };
            gameJson.thumbnail = {
                type: "auto"
            };

            // Write updated game.json
            await fs.writeFile(
                filename,
                JSON.stringify(gameJson, null, 2)
            );

            console.log(`Successfully processed ${gameJson.title}`);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the script
processChangedGames().catch(error => {
    console.error('Error:', error);
    process.exit(1);
}); 
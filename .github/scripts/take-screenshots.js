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
        // Debug current directory
        console.log('Current working directory:', process.cwd());
        console.log('Directory contents:', await fs.readdir('.'));

        // Get the base branch (usually main)
        const baseBranch = process.env.GITHUB_BASE_REF || 'main';
        console.log(`Base branch: ${baseBranch}`);
        
        // Get list of changed files between base branch and current branch
        let changedFiles;
        try {
            // First try to get files from git diff
            const gitDiffCommand = `git diff --name-only origin/${baseBranch}...HEAD`;
            console.log('Running git command:', gitDiffCommand);
            changedFiles = execSync(gitDiffCommand, { encoding: 'utf8' })
                .trim()
                .split('\n')
                .filter(file => file && file.endsWith('game.json'));
            console.log('Files from git diff:', changedFiles);
        } catch (error) {
            console.log('Error getting changed files:', error);
            // Fallback to finding all game.json files
            console.log('Falling back to find command...');
            const findCommand = 'find . -name "game.json"';
            console.log('Running find command:', findCommand);
            changedFiles = execSync(findCommand, { encoding: 'utf8' })
                .trim()
                .split('\n')
                .filter(Boolean);
            console.log('Files from find:', changedFiles);
        }

        if (!changedFiles.length) {
            console.log('No game.json files found');
            return;
        }

        console.log('Processing game.json files:', changedFiles);

        // Process each game.json
        for (const filename of changedFiles) {
            console.log(`Processing file: ${filename}`);
            const gameDir = path.dirname(filename);
            console.log(`Game directory: ${gameDir}`);
            
            const fileContent = await fs.readFile(filename, 'utf8');
            console.log(`File content length: ${fileContent.length}`);
            
            const gameJson = JSON.parse(fileContent);

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
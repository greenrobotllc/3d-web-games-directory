import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

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
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport(MOBILE_VIEWPORT);
        
        // Navigate with increased timeout and less strict network idle
        console.log(`Navigating to ${url}...`);
        await page.goto(url, {
            waitUntil: ['domcontentloaded', 'networkidle2'],
            timeout: 60000
        });

        // Wait additional time for any animations/loading
        console.log('Waiting for page to stabilize...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Take screenshot
        console.log('Taking screenshot...');
        await page.screenshot({
            path: outputPath,
            fullPage: false,
            type: 'jpeg',
            quality: 90
        });

        // Optimize and resize image
        console.log('Optimizing screenshot...');
        await sharp(outputPath)
            .resize(512, 512, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .jpeg({ quality: 85 })
            .toFile(outputPath + '.tmp');

        // Replace original with optimized version
        await fs.rename(outputPath + '.tmp', outputPath);
        console.log('Screenshot completed successfully');

    } catch (error) {
        console.error(`Error taking screenshot of ${url}:`, error);
        // Try one more time with just domcontentloaded
        try {
            console.log('Retrying with minimal wait conditions...');
            const page = await browser.newPage();
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(url, {
                waitUntil: ['domcontentloaded'],
                timeout: 30000
            });
            await page.screenshot({
                path: outputPath,
                fullPage: false,
                type: 'jpeg',
                quality: 90
            });
            console.log('Retry successful');
        } catch (retryError) {
            console.error('Retry also failed:', retryError);
            throw error;
        }
    } finally {
        await browser.close();
    }
}

async function processChangedGames() {
    // Get list of changed files from environment variable
    const changedFiles = process.env.ALL_CHANGED_FILES?.split(' ') || [];

    if (changedFiles.length === 0) {
        console.log('No changed files found in PR');
        return;
    }

    // Process each changed game.json
    for (const file of changedFiles) {
        if (!file.endsWith('game.json')) continue;

        const gameDir = path.dirname(file);
        const gameJson = JSON.parse(
            await fs.readFile(file, 'utf8')
        );

        if (!gameJson.url) {
            console.log(`No URL found in ${file}, skipping`);
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
            file,
            JSON.stringify(gameJson, null, 2)
        );

        console.log(`Successfully processed ${gameJson.title}`);
    }
}

// Run the script
processChangedGames().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
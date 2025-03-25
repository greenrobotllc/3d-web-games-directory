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

const waitTillHTMLRendered = async (page, timeout = 30000) => {
    const checkDurationMsecs = 1000;
    const maxChecks = timeout / checkDurationMsecs;
    let lastHTMLSize = 0;
    let checkCounts = 1;
    let countStableSizeIterations = 0;
    const minStableSizeIterations = 3;

    while(checkCounts++ <= maxChecks){
        let html = await page.content();
        let currentHTMLSize = html.length; 

        let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

        console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, " body html size: ", bodyHTMLSize);

        if(lastHTMLSize != 0 && currentHTMLSize == lastHTMLSize) 
            countStableSizeIterations++;
        else 
            countStableSizeIterations = 0; //reset the counter

        if(countStableSizeIterations >= minStableSizeIterations) {
            console.log("Page rendered fully..");
            break;
        }

        lastHTMLSize = currentHTMLSize;
        await new Promise(resolve => setTimeout(resolve, checkDurationMsecs));
    }  
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
        
        // Navigate and wait for initial load
        console.log(`Navigating to ${url}...`);
        await page.goto(url, {
            waitUntil: 'load',
            timeout: 30000
        });

        // Wait for the page to be fully rendered
        console.log('Waiting for page to fully render...');
        await waitTillHTMLRendered(page);

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
        // Try one more time with minimal wait conditions
        try {
            console.log('Retrying with minimal wait conditions...');
            const page = await browser.newPage();
            await page.setViewport(MOBILE_VIEWPORT);
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            // Still wait for rendering but with shorter timeout
            await waitTillHTMLRendered(page, 15000);
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
        const gameName = path.basename(gameDir);
        const gameJson = JSON.parse(
            await fs.readFile(file, 'utf8')
        );

        if (!gameJson.url) {
            console.log(`No URL found in ${file}, skipping`);
            continue;
        }

        // Create screenshots directory if it doesn't exist
        const screenshotsDir = path.join(gameDir, 'screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });

        // Create images directory for thumbnail
        const imagesDir = path.join(gameDir, 'images');
        await fs.mkdir(imagesDir, { recursive: true });

        // Generate timestamp for the filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = path.join(
            screenshotsDir, 
            `${gameName}-${timestamp}.jpg`
        );

        // Take screenshot
        await takeScreenshot(gameJson.url, screenshotPath);

        // Generate thumbnail
        const thumbPath = path.join(imagesDir, 'thumb.jpg');
        await sharp(screenshotPath)
            .resize(200, 200, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .jpeg({ quality: 85 })
            .toFile(thumbPath);

        // Update game.json with new screenshot
        gameJson.cover_image = {
            type: "github",
            path: `screenshots/${path.basename(screenshotPath)}`
        };
        gameJson.thumbnail = {
            type: "github",
            path: "images/thumb.jpg"
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
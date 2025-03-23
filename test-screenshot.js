import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESKTOP_VIEWPORT = {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2
};

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanupOldScreenshots(screenshotsDir, gameId) {
    try {
        const files = await fs.readdir(screenshotsDir);
        for (const file of files) {
            if (file.startsWith(`${gameId}-`) && file.endsWith('.jpg')) {
                await fs.unlink(path.join(screenshotsDir, file));
                console.log(`Deleted old screenshot: ${file}`);
            }
        }
    } catch (error) {
        console.error('Error cleaning up old screenshots:', error);
    }
}

async function takeScreenshot(url, outputPath) {
    console.log(`Taking screenshot of ${url}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--ignore-certificate-errors',
            '--window-size=1920,1080',
            '--hide-scrollbars'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // Set user agent to desktop Chrome
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport(DESKTOP_VIEWPORT);

        // Handle any dialog windows that might pop up
        page.on('dialog', async dialog => {
            await dialog.dismiss();
        });

        console.log('Navigating to page...');
        
        // Navigate with timeout and wait for network idle
        await page.goto(url, {
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 30000
        });

        console.log('Page loaded, waiting for content to settle...');

        // Wait additional time for any animations/loading
        await wait(5000);

        console.log('Taking screenshot...');

        // Take screenshot of the center portion
        const screenshot = await page.screenshot({
            type: 'jpeg',
            quality: 100
        });

        console.log('Processing screenshot...');

        // Process with sharp
        await sharp(screenshot)
            // First crop to a square from the center
            .resize({
                width: 1080,
                height: 1080,
                fit: 'cover',
                position: 'center'
            })
            // Then resize to final size with high quality
            .resize(512, 512, {
                kernel: 'lanczos3',
                fit: 'cover'
            })
            .jpeg({ 
                quality: 95,
                chromaSubsampling: '4:4:4'
            })
            .toFile(outputPath);

        console.log(`Screenshot saved to ${outputPath}`);

    } catch (error) {
        console.error('Error details:', error);
        if (error.message.includes('net::')) {
            console.error('Network error occurred. Please check if the URL is accessible.');
        }
        throw error;
    } finally {
        try {
            await browser.close();
        } catch (error) {
            console.error('Error closing browser:', error);
        }
    }
}

async function processGame(gamePath) {
    try {
        // Read game.json
        const gameJson = JSON.parse(
            await fs.readFile(gamePath, 'utf8')
        );

        if (!gameJson.url) {
            console.log('No URL found in game.json');
            return;
        }

        // Get game ID from directory name
        const gameDir = path.dirname(gamePath);
        const gameId = path.basename(gameDir);

        // Create screenshots directory if it doesn't exist
        const screenshotsDir = path.join(gameDir, 'screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });

        // Clean up old screenshots
        await cleanupOldScreenshots(screenshotsDir, gameId);

        // Generate timestamp for the filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const screenshotPath = path.join(
            screenshotsDir, 
            `${gameId}-${timestamp}.jpg`
        );

        // Take screenshot
        await takeScreenshot(gameJson.url, screenshotPath);

        // Update game.json with new screenshot
        gameJson.cover_image = {
            type: "github",
            path: `screenshots/${path.basename(screenshotPath)}`
        };
        gameJson.thumbnail = {
            type: "auto"
        };

        // Write updated game.json
        await fs.writeFile(
            gamePath,
            JSON.stringify(gameJson, null, 2)
        );

        console.log(`Successfully processed ${gameJson.title}`);
    } catch (error) {
        console.error('Error processing game:', error);
        process.exit(1);
    }
}

// Process the 3D Tank Battle game
const gamePath = path.join(__dirname, 'games', '3d-tank-battle', 'game.json');
processGame(gamePath); 
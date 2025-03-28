import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MOBILE_VIEWPORT = {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
};

// Function to download image from URL
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        // Convert HTTP to HTTPS if possible
        const secureUrl = url.replace('http://', 'https://');
        const protocol = secureUrl.startsWith('https') ? https : http;
        
        protocol.get(secureUrl, (response) => {
            if (response.statusCode === 200) {
                response.pipe(fs.createWriteStream(filepath))
                    .on('error', reject)
                    .once('close', () => resolve(filepath));
            } else if (response.statusCode === 301 || response.statusCode === 302) {
                // Handle redirects
                const redirectUrl = response.headers.location;
                console.log(`Following redirect to: ${redirectUrl}`);
                downloadImage(redirectUrl, filepath)
                    .then(resolve)
                    .catch(reject);
            } else {
                response.resume();
                reject(new Error(`Request Failed With a Status Code: ${response.statusCode}`));
            }
        });
    });
}

// Function to get og:image URL from page
async function getOgImage(page) {
    try {
        // Log all meta tags for debugging
        const allMetaTags = await page.evaluate(() => {
            const metas = document.querySelectorAll('meta');
            return Array.from(metas).map(meta => ({
                property: meta.getAttribute('property'),
                content: meta.getAttribute('content')
            }));
        });
        console.log('All meta tags:', JSON.stringify(allMetaTags, null, 2));

        const ogImage = await page.evaluate(() => {
            const meta = document.querySelector('meta[property="og:image"]');
            console.log('Found meta tag:', meta ? meta.outerHTML : 'none');
            return meta ? meta.getAttribute('content') : null;
        });
        console.log('og:image URL:', ogImage);
        return ogImage;
    } catch (error) {
        console.error('Error getting og:image:', error);
        return null;
    }
}

// Function to wait for HTML to be fully rendered
async function waitTillHTMLRendered(page, timeout = 30000) {
    const checkDurationMsecs = 1000;
    const maxChecks = timeout / checkDurationMsecs;
    let lastHTMLSize = 0;
    let checkCounts = 0;
    let countStableSizeIterations = 0;
    const minStableSizeIterations = 3;

    while (checkCounts++ < maxChecks) {
        const html = await page.content();
        const currentHTMLSize = html.length;
        const bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length);

        console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, ' body html size: ', bodyHTMLSize);

        if (lastHTMLSize != 0) {
            if (currentHTMLSize == lastHTMLSize) {
                countStableSizeIterations++;
                if (countStableSizeIterations >= minStableSizeIterations) {
                    console.log('Page rendered fully..');
                    break;
                }
            } else {
                countStableSizeIterations = 0;
            }
        }
        lastHTMLSize = currentHTMLSize;
        await new Promise(resolve => setTimeout(resolve, checkDurationMsecs));
    }
}

async function takeScreenshot(url, gameId) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`Taking screenshot of ${url}`);
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'load' });
        await waitTillHTMLRendered(page);

        // Check for og:image first
        console.log('Checking for og:image...');
        const ogImageUrl = await getOgImage(page);
        let screenshotPath;
        let timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        const screenshotsDir = path.join('games', gameId, 'screenshots');
        const imagesDir = path.join('games', gameId, 'images');
        
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
        }

        // Clean up old files
        console.log('Cleaning up old files...');
        const oldScreenshots = fs.readdirSync(screenshotsDir);
        for (const file of oldScreenshots) {
            fs.unlinkSync(path.join(screenshotsDir, file));
        }

        const oldImages = fs.readdirSync(imagesDir);
        for (const file of oldImages) {
            if (file !== 'thumb.jpg') {
                fs.unlinkSync(path.join(imagesDir, file));
            }
        }

        if (ogImageUrl) {
            console.log('Found og:image, downloading:', ogImageUrl);
            // Download og:image to screenshots directory
            const imagePath = path.join(screenshotsDir, `${gameId}-${timestamp}.jpg`);
            await downloadImage(ogImageUrl, imagePath);
            screenshotPath = imagePath;
        } else {
            console.log('No og:image found, taking screenshot...');
            // Take screenshot to screenshots directory
            const imagePath = path.join(screenshotsDir, `${gameId}-${timestamp}.jpg`);
            await page.screenshot({
                path: imagePath,
                fullPage: true
            });
            screenshotPath = imagePath;
        }

        // Generate thumbnail
        console.log('Generating thumbnail...');
        const thumbPath = path.join(imagesDir, 'thumb.jpg');
        await sharp(screenshotPath)
            .resize(200, null, {  // Set width to 200, height will scale proportionally
                fit: 'inside',    // Maintain aspect ratio
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(thumbPath);

        // Update game.json
        const gameJsonPath = path.join('games', gameId, 'game.json');
        const gameData = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
        
        // Remove cover_image if it exists
        if ('cover_image' in gameData) {
            delete gameData.cover_image;
        }
        
        // Only update screenshot and thumbnail paths
        gameData.screenshot = '/games/' + gameId + '/screenshots/' + path.basename(screenshotPath);
        gameData.thumbnail = '/games/' + gameId + '/images/thumb.jpg';

        fs.writeFileSync(gameJsonPath, JSON.stringify(gameData, null, 2));
        console.log(`Successfully processed ${gameData.title}`);

    } catch (error) {
        console.error(`Error processing ${url}:`, error);
        throw error;
    } finally {
        await browser.close();
    }
}

async function processChangedGames() {
    const changedFiles = process.env.ALL_CHANGED_FILES.split(' ');
    
    for (const file of changedFiles) {
        if (file.endsWith('game.json')) {
            const gameData = JSON.parse(fs.readFileSync(file, 'utf8'));
            const gameId = path.basename(path.dirname(file));
            await takeScreenshot(gameData.url, gameId);
        }
    }
}

processChangedGames().catch(console.error); 
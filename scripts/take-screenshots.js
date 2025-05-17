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
        try {
            // Make sure we have a valid URL
            if (!url) {
                return reject(new Error('Invalid URL: URL is empty or null'));
            }

            // Convert HTTP to HTTPS if possible
            const secureUrl = url.replace('http://', 'https://');

            // Validate URL format
            try {
                new URL(secureUrl);
            } catch (error) {
                return reject(new Error(`Invalid URL: ${secureUrl} - ${error.message}`));
            }

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
            }).on('error', (error) => {
                reject(new Error(`Network error: ${error.message}`));
            });
        } catch (error) {
            reject(new Error(`Error in downloadImage: ${error.message}`));
        }
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

        // Handle relative URLs by prepending the base URL
        if (ogImage && !ogImage.startsWith('http') && !ogImage.startsWith('//')) {
            const pageUrl = page.url();
            const baseUrl = new URL(pageUrl).origin;

            // If the path doesn't start with a slash, add one
            const normalizedPath = ogImage.startsWith('/') ? ogImage : `/${ogImage}`;
            const absoluteUrl = `${baseUrl}${normalizedPath}`;

            console.log(`Converting relative URL ${ogImage} to absolute URL ${absoluteUrl}`);
            return absoluteUrl;
        }

        return ogImage;
    } catch (error) {
        console.error('Error getting og:image:', error);
        return null;
    }
}

// Function to wait for HTML to be fully rendered
async function waitTillHTMLRendered(page, timeout = 45000) {
    const checkDurationMsecs = 1000;
    const maxChecks = timeout / checkDurationMsecs;
    let lastHTMLSize = 0;
    let checkCounts = 0;
    let countStableSizeIterations = 0;
    const minStableSizeIterations = 3;

    // First wait for any initial animations or transitions to complete
    try {
        // Use setTimeout instead of page.waitForTimeout which might not be available in all Puppeteer versions
        await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
        console.warn('Initial wait error:', error.message);
    }

    try {
        while (checkCounts++ < maxChecks) {
            let html = '';
            try {
                html = await page.content();
            } catch (e) {
                console.warn('Error getting page content:', e.message);
                break;
            }

            const currentHTMLSize = html.length;

            let bodyHTMLSize = 0;
            try {
                bodyHTMLSize = await page.evaluate(() =>
                    document.body ? document.body.innerHTML.length : 0
                );
            } catch (e) {
                console.warn('Error evaluating body size:', e.message);
            }

            console.log('last: ', lastHTMLSize, ' <> curr: ', currentHTMLSize, ' body html size: ', bodyHTMLSize);

            if (lastHTMLSize != 0) {
                // If the size is the same or very close (within 5% difference)
                const sizeDifference = Math.abs(currentHTMLSize - lastHTMLSize);
                const percentDifference = (sizeDifference / lastHTMLSize) * 100;

                if (percentDifference < 5) {
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

            // Check if we've reached the maximum number of checks
            if (checkCounts >= maxChecks) {
                console.log('Reached maximum wait time, continuing anyway...');
                break;
            }

            await new Promise(resolve => setTimeout(resolve, checkDurationMsecs));
        }
    } catch (error) {
        console.warn('Error in waitTillHTMLRendered:', error.message);
        // Continue execution even if there's an error
    }

    // Final wait to ensure any last resources are loaded
    try {
        // Use setTimeout instead of page.waitForTimeout which might not be available in all Puppeteer versions
        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
        console.warn('Final wait error:', error.message);
    }
}

async function takeScreenshot(url, gameId, retryCount = 0) {
    const maxRetries = 2; // Maximum number of retry attempts
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--ignore-certificate-errors',
            '--window-size=1920,1080',
            '--hide-scrollbars',
            '--disable-gpu',
            '--disable-dev-shm-usage'
        ]
    });

    try {
        const page = await browser.newPage();

        // Set a more modern user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Handle any dialog windows that might pop up
        page.on('dialog', async dialog => {
            await dialog.dismiss();
        });

        console.log(`Taking screenshot of ${url}`);
        console.log(`Navigating to ${url}...`);

        // Increase timeout to 60 seconds and use multiple wait conditions
        try {
            await page.goto(url, {
                waitUntil: ['load', 'domcontentloaded'],
                timeout: 60000 // 60 seconds timeout
            });
        } catch (navigationError) {
            console.warn(`Navigation issue: ${navigationError.message}`);
            console.log('Continuing with the page as-is...');
            // We'll continue with whatever loaded, rather than failing completely
        }

        // Wait for the page to stabilize
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

        // Close the browser before potentially retrying
        await browser.close();

        // Implement retry mechanism
        if (retryCount < maxRetries) {
            console.log(`Retrying (${retryCount + 1}/${maxRetries})...`);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 5000));
            return await takeScreenshot(url, gameId, retryCount + 1);
        }

        // If we've exhausted retries, try to take a fallback screenshot
        if (retryCount >= maxRetries) {
            console.log("All retries failed. Attempting to create a fallback image...");
            try {
                // Create a fallback screenshot directory
                const screenshotsDir = path.join('games', gameId, 'screenshots');
                const imagesDir = path.join('games', gameId, 'images');

                if (!fs.existsSync(screenshotsDir)) {
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                }
                if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                }

                // Generate a timestamp for the filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

                // Create a simple fallback image with text
                const fallbackImagePath = path.join(screenshotsDir, `${gameId}-${timestamp}.jpg`);

                // Use sharp to create a simple placeholder image
                await sharp({
                    create: {
                        width: 800,
                        height: 600,
                        channels: 4,
                        background: { r: 50, g: 50, b: 50, alpha: 1 }
                    }
                })
                .jpeg()
                .toFile(fallbackImagePath);

                // Create a thumbnail
                const thumbPath = path.join(imagesDir, 'thumb.jpg');
                await sharp(fallbackImagePath)
                    .resize(200, null, {
                        fit: 'inside',
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

                // Update screenshot and thumbnail paths
                gameData.screenshot = '/games/' + gameId + '/screenshots/' + path.basename(fallbackImagePath);
                gameData.thumbnail = '/games/' + gameId + '/images/thumb.jpg';

                fs.writeFileSync(gameJsonPath, JSON.stringify(gameData, null, 2));
                console.log(`Created fallback image for ${gameData.title}`);

                return; // Exit without throwing an error
            } catch (fallbackError) {
                console.error("Failed to create fallback image:", fallbackError);
            }
        }

        throw error;
    } finally {
        try {
            await browser.close();
        } catch (closeError) {
            console.error("Error closing browser:", closeError);
        }
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
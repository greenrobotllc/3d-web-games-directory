/**
 * Generate a cover screenshot + thumbnail for one or more games.
 *
 * Usage:
 *   node scripts/take-screenshots.js huss-valley-game            # by game id
 *   node scripts/take-screenshots.js games/foo/game.json         # by path
 *   ALL_CHANGED_FILES="games/a/game.json games/b/game.json" node scripts/take-screenshots.js
 *
 * For each game it prefers the page's og:image; if there isn't one it takes a
 * viewport screenshot. The image is normalized to JPEG, a 200px thumbnail is
 * written to images/thumb.jpg, and game.json gets `screenshot`/`thumbnail`.
 *
 * Game URLs come from contributors, so Chrome runs with its sandbox and
 * same-origin policy left ON. Set PUPPETEER_NO_SANDBOX=1 only on a throwaway
 * CI machine that cannot run the sandbox.
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { validateGameId } from './lib/game-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(REPO_ROOT, 'games');

const VIEWPORT = { width: 1280, height: 720 };
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const COVER_MAX_WIDTH = 1200;
const THUMB_WIDTH = 200;
const NAV_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function isHttpUrl(value) {
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

/** Download an image (http/https only, size-capped) and return it as a Buffer. */
async function downloadImage(url) {
    if (!isHttpUrl(url)) throw new Error(`Refusing non-http(s) image URL: ${url}`);

    const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
        headers: { Accept: 'image/*' },
    });
    if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
    if (!isHttpUrl(response.url)) throw new Error(`Image redirected to non-http(s) URL: ${response.url}`);

    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_IMAGE_BYTES) throw new Error(`Image too large (${declared} bytes)`);

    // Enforce the cap while streaming; content-length can be missing or wrong.
    const chunks = [];
    let total = 0;
    for await (const chunk of response.body) {
        total += chunk.length;
        if (total > MAX_IMAGE_BYTES) throw new Error(`Image too large (over ${MAX_IMAGE_BYTES} bytes)`);
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/** Return the absolute og:image URL for the current page, or null. */
async function getOgImage(page) {
    const content = await page.evaluate(() => {
        const meta = document.querySelector('meta[property="og:image"], meta[name="og:image"]');
        return meta ? meta.getAttribute('content') : null;
    });
    if (!content) return null;
    try {
        const absolute = new URL(content.trim(), page.url()).href;
        return isHttpUrl(absolute) ? absolute : null;
    } catch {
        return null;
    }
}

/** Wait until the DOM stops growing (or the timeout passes). */
async function waitForStablePage(page, timeoutMs = 30000) {
    await sleep(3000);
    let last = 0;
    let stable = 0;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const size = await page.evaluate(() => document.documentElement.outerHTML.length).catch(() => 0);
        if (last && Math.abs(size - last) / last < 0.05) {
            stable += 1;
            if (stable >= 3) break;
        } else {
            stable = 0;
        }
        last = size;
        await sleep(1000);
    }
    await sleep(2000);
}

function launchArgs() {
    const args = [`--window-size=${VIEWPORT.width},${VIEWPORT.height}`, '--hide-scrollbars'];
    if (process.env.CI) {
        // CI runners have no GPU; let WebGL games render with SwiftShader.
        args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
    }
    if (process.env.PUPPETEER_NO_SANDBOX === '1') {
        args.push('--no-sandbox');
    }
    return args;
}

/** Capture a raw image (og:image or screenshot) for a URL. Returns a Buffer. */
async function captureRawImage(url) {
    const browser = await puppeteer.launch({ headless: true, args: launchArgs() });
    try {
        const page = await browser.newPage();
        // Some sites block "HeadlessChrome"; present as regular Chrome.
        const ua = (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');
        await page.setUserAgent(ua);
        await page.setViewport(VIEWPORT);
        page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));

        console.log(`  Navigating to ${url}`);
        let response = null;
        try {
            response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
        } catch (error) {
            // DNS/connection/TLS failures leave only Chrome's error page: treat as a failed capture.
            if (/net::ERR_/.test(error.message)) throw error;
            // Slow games often time out on "load" but have rendered enough to capture.
            console.warn(`  Navigation issue (continuing with what loaded): ${error.message}`);
        }
        if (response && response.status() >= 400) {
            throw new Error(`Game page returned HTTP ${response.status()}`);
        }
        await waitForStablePage(page);

        const ogImage = await getOgImage(page);
        if (ogImage) {
            console.log(`  Using og:image ${ogImage}`);
            try {
                return await downloadImage(ogImage);
            } catch (error) {
                console.warn(`  og:image download failed (${error.message}); taking a screenshot instead`);
            }
        }
        console.log('  Taking viewport screenshot');
        return Buffer.from(await page.screenshot({ type: 'png' }));
    } finally {
        await browser.close().catch(() => {});
    }
}

async function placeholderImage() {
    return sharp({
        create: { width: 800, height: 450, channels: 3, background: { r: 50, g: 50, b: 50 } },
    }).jpeg().toBuffer();
}

async function processGame(gameId) {
    validateGameId(gameId);
    const gameDir = path.join(GAMES_DIR, gameId);
    const gameJsonPath = path.join(gameDir, 'game.json');
    const gameData = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
    if (!isHttpUrl(gameData.url) || new URL(gameData.url).protocol !== 'https:') {
        throw new Error(`Game url must start with https:// in ${gameJsonPath}`);
    }

    console.log(`\n${gameData.title} (${gameId})`);

    let raw = null;
    for (let attempt = 0; attempt <= MAX_RETRIES && !raw; attempt += 1) {
        try {
            raw = await captureRawImage(gameData.url);
        } catch (error) {
            console.error(`  Attempt ${attempt + 1} failed: ${error.message}`);
            if (attempt < MAX_RETRIES) await sleep(5000);
        }
    }
    const usedPlaceholder = !raw;
    if (usedPlaceholder) {
        // Don't replace a good screenshot with a grey box because the site was briefly down.
        const existing = typeof gameData.screenshot === 'string'
            ? path.join(REPO_ROOT, gameData.screenshot) : null;
        if (existing && existing.startsWith(gameDir + path.sep) && fs.existsSync(existing)) {
            console.warn('  All attempts failed; keeping the existing screenshot');
            return false;
        }
        console.warn('  All attempts failed; using a placeholder image');
        raw = await placeholderImage();
    }

    // Re-encode through sharp: normalizes format to JPEG and drops anything that isn't an image.
    const cover = await sharp(raw)
        .resize({ width: COVER_MAX_WIDTH, withoutEnlargement: true })
        .flatten({ background: '#000000' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    const thumb = await sharp(cover)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();

    const screenshotsDir = path.join(gameDir, 'screenshots');
    const imagesDir = path.join(gameDir, 'images');
    fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.mkdirSync(imagesDir, { recursive: true });

    // Write the new files first, then remove old screenshots.
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotName = `${gameId}-${timestamp}.jpg`;
    fs.writeFileSync(path.join(screenshotsDir, screenshotName), cover);
    fs.writeFileSync(path.join(imagesDir, 'thumb.jpg'), thumb);
    for (const file of fs.readdirSync(screenshotsDir)) {
        if (file !== screenshotName) fs.unlinkSync(path.join(screenshotsDir, file));
    }

    delete gameData.cover_image;
    gameData.thumbnail = `/games/${gameId}/images/thumb.jpg`;
    gameData.screenshot = `/games/${gameId}/screenshots/${screenshotName}`;
    fs.writeFileSync(gameJsonPath, `${JSON.stringify(gameData, null, 2)}\n`);
    console.log(`  Saved ${gameData.screenshot}`);
    return !usedPlaceholder;
}

/** Turn CLI args / ALL_CHANGED_FILES into a list of game ids. */
function resolveGameIds() {
    const inputs = process.argv.slice(2).length
        ? process.argv.slice(2)
        : (process.env.ALL_CHANGED_FILES || '').split(/\s+/);
    const ids = inputs
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (item.endsWith('game.json') ? path.basename(path.dirname(item)) : item));
    return [...new Set(ids)];
}

async function main() {
    const ids = resolveGameIds();
    if (ids.length === 0) {
        console.log('No games to process. Pass game ids as arguments or set ALL_CHANGED_FILES.');
        return;
    }

    const failed = [];
    for (const id of ids) {
        if (!fs.existsSync(path.join(GAMES_DIR, id, 'game.json'))) {
            console.log(`Skipping ${id}: no game.json (removed?)`);
            continue;
        }
        try {
            const ok = await processGame(id);
            if (!ok) failed.push(id);
        } catch (error) {
            console.error(`Error processing ${id}: ${error.message}`);
            failed.push(id);
        }
    }

    if (failed.length) {
        console.error(`\nNeeds attention (placeholder or error): ${failed.join(', ')}`);
        process.exitCode = 1;
    }
}

main();

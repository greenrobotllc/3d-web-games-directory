#!/usr/bin/env node
/**
 * Check whether listed games are still online.
 *
 *   npm run audit                        # every game
 *   npm run audit -- hexgl plume         # specific games
 *   npm run audit -- --no-browser        # HTTP check only (fast)
 *   npm run audit -- --out /tmp/report   # where to write the report
 *
 * For each game it requests the URL, then loads it in headless Chrome and
 * records the status, where it ended up, whether the page has a canvas or an
 * embedded frame, and a screenshot. Each game is graded:
 *
 *   ok     responds and still looks like a game page
 *   check  a person should look: moved to another site, blocked the request,
 *          looks like a parked domain, or shows no game canvas
 *   down   DNS/connection/TLS failure, or HTTP 404/410/5xx
 *
 * Output (default ./audit-report/): report.json, report.md, one screenshot per
 * game and contact sheets (sheet-N.jpg) for reviewing them at a glance.
 *
 * Nothing is removed automatically. "check" is common for healthy sites that
 * block automated visitors, so look before deleting anything. Once you have
 * confirmed a game is fine, add it to scripts/audit-ignore.json with the reason
 * and it stops being reported as "check" (it is still reported if it goes down).
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { launchBrowser, browserUserAgent } from './lib/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(REPO_ROOT, 'games');

const VIEWPORT = { width: 1280, height: 720 };
const HTTP_TIMEOUT_MS = 25000;
const NAV_TIMEOUT_MS = 45000;
const SETTLE_MS = 6000;
const SAME_SITE_GAP_MS = 2000;
const THUMB = { width: 320, height: 180, label: 30, columns: 4, rows: 5 };
const IGNORE_FILE = path.join(__dirname, 'audit-ignore.json');
const TITLE_STOP_WORDS = new Set(['the', 'game', 'and', 'for', 'com', 'www', 'play', 'online', 'free']);

const PARKED = new RegExp([
    'domain (name )?(is |may be )?for sale', 'buy this domain', 'this domain (is|has been) (parked|registered)',
    'parked (free|domain)', 'hugedomains', 'sedo\\.com', 'afternic', 'dan\\.com',
    'account (has been )?suspended', 'website (is )?(no longer|not) available',
    '(game|service|servers?) (has|have) (been )?(shut ?down|closed|discontinued|ended)',
    'no longer (available|supported|online)', 'page not found', '\\b404\\b',
].join('|'), 'i');

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** "www.play.example.co" -> "example.co" (good enough to spot a move to another site). */
function siteOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '').split('.').slice(-2).join('.');
    } catch {
        return '';
    }
}

/** Does the page title or address still mention the game? Empty titles pass. */
function mentionsGame(gameTitle, pageTitle, finalUrl) {
    if (!pageTitle) return true;
    const words = (gameTitle.toLowerCase().match(/[a-z0-9]+/g) || [])
        .filter((word) => word.length >= 3 && !TITLE_STOP_WORDS.has(word));
    if (words.length === 0) return true;
    const haystack = `${pageTitle} ${finalUrl || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    return words.some((word) => haystack.includes(word));
}

/** The part of a URL path that names the game, e.g. "/game/drift-hunters" -> "drift-hunters". */
function slugOf(url) {
    const parts = new URL(url).pathname.split('/').filter((part) => part && !/^index\.[a-z]+$/i.test(part));
    return parts.length ? parts[parts.length - 1].toLowerCase() : '';
}

/** Text from a visited page, made safe to print inside a markdown table. */
function quote(text, max = 80) {
    return `\`${String(text).replace(/[`|\r\n]+/g, ' ').slice(0, max)}\``;
}

function parseArgs(argv) {
    const options = { ids: [], browser: true, out: path.join(REPO_ROOT, 'audit-report'), concurrency: 3 };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--no-browser') options.browser = false;
        else if (arg === '--out') { i += 1; options.out = path.resolve(argv[i]); }
        else if (arg === '--concurrency') { i += 1; options.concurrency = Math.max(1, Number(argv[i]) || 1); }
        else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
        else options.ids.push(arg.endsWith('game.json') ? path.basename(path.dirname(arg)) : arg);
    }
    return options;
}

function loadGames(ids) {
    const all = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(GAMES_DIR, entry.name, 'game.json')))
        .map((entry) => entry.name)
        .sort();
    const wanted = ids.length ? ids : all;
    return wanted.map((id) => {
        const file = path.join(GAMES_DIR, id, 'game.json');
        if (!fs.existsSync(file)) throw new Error(`No such game: ${id}`);
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return { id, title: data.title, url: data.url };
    });
}

async function httpCheck(url, userAgent) {
    try {
        const response = await fetch(url, {
            redirect: 'follow',
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
            headers: { 'User-Agent': userAgent, Accept: 'text/html,*/*' },
        });
        await response.body?.cancel().catch(() => {});
        return { status: response.status, finalUrl: response.url };
    } catch (error) {
        const cause = error.cause?.code || error.cause?.message || error.name || String(error);
        return { error: String(cause) };
    }
}

async function browserCheck(browser, userAgent, game, outDir) {
    const page = await browser.newPage();
    try {
        await page.setUserAgent(userAgent);
        await page.setViewport(VIEWPORT);
        page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));

        let status = null;
        let navError = null;
        try {
            const response = await page.goto(game.url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
            status = response ? response.status() : null;
        } catch (error) {
            navError = error.message.split('\n')[0];
            if (/net::ERR_/.test(navError)) return { error: navError };
        }
        await sleep(SETTLE_MS);

        const info = await page.evaluate(() => ({
            title: document.title,
            canvases: document.querySelectorAll('canvas').length,
            frames: document.querySelectorAll('iframe, embed, object').length,
            text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 600),
        })).catch(() => ({ title: '', canvases: 0, frames: 0, text: '' }));

        const shot = await page.screenshot({ type: 'jpeg', quality: 70 }).catch(() => null);
        if (shot) {
            await sharp(shot).resize(640, 360).jpeg({ quality: 70 }).toFile(path.join(outDir, `${game.id}.jpg`));
        }
        return { status, finalUrl: page.url(), timedOut: Boolean(navError), screenshot: Boolean(shot), ...info };
    } catch (error) {
        return { error: error.message.split('\n')[0] };
    } finally {
        await page.close().catch(() => {});
    }
}

/** Turn the raw checks into a grade and the reasons for it. */
function grade(game, http, browser, ignore) {
    const reasons = [];
    let level = 'ok';
    const raise = (to, reason) => {
        reasons.push(reason);
        if (to === 'down' || (to === 'check' && level === 'ok')) level = to;
    };

    const dead = (status) => status === 404 || status === 410 || status >= 500;
    const netDown = (text) => /NAME_NOT_RESOLVED|ENOTFOUND|CONNECTION_REFUSED|ECONNREFUSED|CERT_|certificate|ADDRESS_UNREACHABLE|EAI_AGAIN/i.test(text || '');

    const best = browser && !browser.error ? browser : http;
    if (browser?.error && http.error) {
        raise(netDown(browser.error) || netDown(http.error) ? 'down' : 'check', `could not load: ${browser.error}`);
    } else if (!browser && http.error) {
        raise(netDown(http.error) ? 'down' : 'check', `request failed: ${http.error}`);
    } else if (browser?.error) {
        raise('check', `browser could not load it (${browser.error}), though the server answered ${http.status}`);
    }

    const status = best.status ?? http.status;
    if (status && dead(status)) raise('down', `HTTP ${status}`);
    else if (status && status >= 400) raise('check', `HTTP ${status} (may be blocking automated visitors)`);

    const finalUrl = best.finalUrl || http.finalUrl;
    if (finalUrl) {
        const slug = slugOf(game.url);
        const movedHost = new URL(finalUrl).hostname.replace(/^www\./, '') !== new URL(game.url).hostname.replace(/^www\./, '');
        if (siteOf(finalUrl) !== siteOf(game.url)) {
            raise('check', `now goes to a different site: ${quote(finalUrl, 120)}`);
        } else if (slug && !new URL(finalUrl).pathname.toLowerCase().includes(slug)) {
            raise('check', `redirects away from the game's page to ${quote(finalUrl, 120)}`);
        } else if (movedHost) {
            reasons.push(`moved to ${quote(finalUrl, 120)} (still works; consider updating the URL)`);
        }
    }

    if (browser && !browser.error) {
        if (PARKED.test(`${browser.title} ${browser.text}`)) raise('check', 'page text looks like a parked or closed site');
        if (!mentionsGame(game.title, browser.title, browser.finalUrl)) {
            raise('check', `page is now titled ${quote(browser.title)}, which does not mention the game`);
        }
        if (browser.canvases === 0 && browser.frames === 0 && browser.text.length < 80) {
            raise('check', 'page looks blank: no game canvas, embedded frame or text');
        }
        if (browser.timedOut) reasons.push('slow: page did not finish loading in time');
    }

    // Known false alarms (confirmed by a person) stay quiet unless the game is actually down.
    if (level === 'check' && ignore[game.id]) {
        return { level: 'ok', reasons: [`ignored (${ignore[game.id]})`] };
    }
    return { level, reasons };
}

async function contactSheets(results, outDir) {
    const { width, height, label, columns, rows } = THUMB;
    const perSheet = columns * rows;
    const colors = { ok: '#1a7f37', check: '#9a6700', down: '#cf222e' };
    const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sheets = [];

    for (let start = 0; start < results.length; start += perSheet) {
        const page = results.slice(start, start + perSheet);
        const composites = [];
        for (const [index, result] of page.entries()) {
            const left = (index % columns) * width;
            const top = Math.floor(index / columns) * (height + label);
            const shot = path.join(outDir, `${result.id}.jpg`);
            const image = fs.existsSync(shot)
                ? await sharp(shot).resize(width, height).toBuffer()
                : await sharp({ create: { width, height, channels: 3, background: '#30363d' } }).jpeg().toBuffer();
            composites.push({ input: image, left, top });
            const bar = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${label}">
                <rect width="100%" height="100%" fill="${colors[result.level]}"/>
                <text x="6" y="20" font-family="Helvetica, Arial, sans-serif" font-size="14" fill="#fff">${escape(`${result.level.toUpperCase()}  ${result.id}`.slice(0, 40))}</text>
            </svg>`;
            composites.push({ input: Buffer.from(bar), left, top: top + height });
        }
        const sheetRows = Math.ceil(page.length / columns);
        const file = path.join(outDir, `sheet-${sheets.length + 1}.jpg`);
        await sharp({
            create: { width: width * columns, height: sheetRows * (height + label), channels: 3, background: '#0d1117' },
        }).composite(composites).jpeg({ quality: 80 }).toFile(file);
        sheets.push(file);
    }
    return sheets;
}

function markdownReport(results) {
    const count = (level) => results.filter((r) => r.level === level).length;
    const lines = [
        `Checked ${results.length} games: ${count('ok')} ok, ${count('check')} to check, ${count('down')} down.`,
        '',
    ];
    for (const [level, heading] of [['down', 'Down'], ['check', 'Needs a look']]) {
        const rows = results.filter((r) => r.level === level);
        if (!rows.length) continue;
        lines.push(`### ${heading}`, '', '| Game | URL | Why |', '|---|---|---|');
        for (const r of rows) lines.push(`| ${r.title} (\`${r.id}\`) | ${r.url} | ${r.reasons.join('; ')} |`);
        lines.push('');
    }
    const moved = results.filter((r) => r.level === 'ok' && r.reasons.some((reason) => reason.startsWith('moved to')));
    if (moved.length) {
        lines.push('### Moved (still works)', '');
        for (const r of moved) lines.push(`- ${r.title} (\`${r.id}\`): ${r.reasons.filter((reason) => reason.startsWith('moved to')).join('; ')}`);
        lines.push('');
    }
    lines.push('"Needs a look" often means a healthy site that blocks automated visitors. Open the link before removing anything. Confirmed false alarms go in `scripts/audit-ignore.json`.');
    return `${lines.join('\n')}\n`;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const games = loadGames(options.ids);
    fs.mkdirSync(options.out, { recursive: true });

    const browser = options.browser ? await launchBrowser(VIEWPORT) : null;
    const userAgent = browser
        ? await browserUserAgent(browser)
        : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

    const ignore = fs.existsSync(IGNORE_FILE) ? JSON.parse(fs.readFileSync(IGNORE_FILE, 'utf8')) : {};

    // Visit one game per site at a time, with a pause, so hosts like itch.io don't rate-limit us.
    const siteQueues = new Map();
    const politely = (url, task) => {
        const site = siteOf(url);
        const run = (siteQueues.get(site) || Promise.resolve()).then(task);
        siteQueues.set(site, run.catch(() => {}).then(() => sleep(SAME_SITE_GAP_MS)));
        return run;
    };

    const results = new Array(games.length);
    let next = 0;
    const worker = async () => {
        while (next < games.length) {
            const index = next;
            next += 1;
            const game = games[index];
            const { http, inBrowser } = await politely(game.url, async () => ({
                http: await httpCheck(game.url, userAgent),
                inBrowser: browser ? await browserCheck(browser, userAgent, game, options.out) : null,
            }));
            const { level, reasons } = grade(game, http, inBrowser, ignore);
            results[index] = { ...game, level, reasons, http, browser: inBrowser };
            console.log(`${level.toUpperCase().padEnd(5)} ${game.id}${reasons.length ? `: ${reasons.join('; ')}` : ''}`);
        }
    };
    try {
        await Promise.all(Array.from({ length: Math.min(options.concurrency, games.length) }, worker));
    } finally {
        if (browser) await browser.close().catch(() => {});
    }

    fs.writeFileSync(path.join(options.out, 'report.json'), `${JSON.stringify(results, null, 2)}\n`);
    fs.writeFileSync(path.join(options.out, 'report.md'), markdownReport(results));
    if (browser) await contactSheets(results, options.out);

    const flagged = results.filter((r) => r.level !== 'ok').length;
    console.log(`\n${results.length} checked, ${flagged} flagged. Report: ${path.join(options.out, 'report.md')}`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `flagged=${flagged}\n`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

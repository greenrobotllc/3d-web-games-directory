#!/usr/bin/env node
/**
 * Rebuild cards (images/thumb.jpg) from the covers already in the repo, without
 * visiting any website. Covers that aren't real JPEGs or are wider than 1200px are
 * re-encoded in place, keeping their file name so game.json doesn't change.
 *
 *   npm run images                  # every game
 *   npm run images -- hexgl plume   # specific games
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { makeCover, makeCard, COVER_MAX_WIDTH } from './lib/images.js';
import { validateGameId } from './lib/game-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const GAMES_DIR = path.join(REPO_ROOT, 'games');

const kb = (bytes) => `${Math.round(bytes / 1024)}K`;

async function rebuild(id) {
    validateGameId(id);
    const game = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, id, 'game.json'), 'utf8'));
    if (typeof game.screenshot !== 'string' || !game.screenshot.startsWith(`/games/${id}/screenshots/`)) {
        return `${id}: no cover yet, skipped`;
    }
    const coverPath = path.join(REPO_ROOT, game.screenshot);
    let cover = fs.readFileSync(coverPath);
    const { format, width, height } = await sharp(cover).metadata();

    let note = `${width}x${height} ${format}`;
    if (format !== 'jpeg' || width > COVER_MAX_WIDTH) {
        const before = cover.length;
        cover = await makeCover(cover);
        fs.writeFileSync(coverPath, cover);
        const after = await sharp(cover).metadata();
        note += ` -> cover re-encoded ${after.width}x${after.height} jpeg (${kb(before)} -> ${kb(cover.length)})`;
    }

    const card = await makeCard(cover);
    fs.mkdirSync(path.join(GAMES_DIR, id, 'images'), { recursive: true });
    fs.writeFileSync(path.join(GAMES_DIR, id, 'images', 'thumb.jpg'), card);
    return `${id}: ${note}; card ${kb(card.length)}`;
}

const requested = process.argv.slice(2);
const ids = requested.length ? requested : fs.readdirSync(GAMES_DIR)
    .filter((name) => fs.existsSync(path.join(GAMES_DIR, name, 'game.json')))
    .sort();

let failed = 0;
for (const id of ids) {
    try {
        console.log(await rebuild(id));
    } catch (error) {
        failed += 1;
        console.error(`${id}: ${error.message}`);
    }
}
if (failed) process.exitCode = 1;

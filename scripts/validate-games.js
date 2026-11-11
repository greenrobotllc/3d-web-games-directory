#!/usr/bin/env node
/**
 * Validate every games/<id>/game.json (or only the ids/paths passed in).
 *
 *   npm run validate
 *   node scripts/validate-games.js my-game
 *
 * Exits non-zero and prints what to fix when something is wrong. In GitHub
 * Actions the problems also show up as annotations on the PR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateGame, urlKey } from './lib/game-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = path.resolve(__dirname, '..', 'games');
const inActions = Boolean(process.env.GITHUB_ACTIONS);

function toId(arg) {
    return arg.endsWith('game.json') ? path.basename(path.dirname(arg)) : arg.replace(/^games\//, '').replace(/\/$/, '');
}

const allIds = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
const requested = process.argv.slice(2).map(toId);
const idsToCheck = requested.length ? [...new Set(requested)] : allIds;

const problems = [];
// Escape for GitHub workflow commands so contributor text can't break out of the annotation.
const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProperty = (s) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
const report = (id, message) => {
    problems.push({ id, message });
    if (inActions) {
        console.log(`::error file=${escapeProperty(`games/${id}/game.json`)}::${escapeData(message)}`);
    }
};

// Load everything once so duplicate checks see the whole directory.
const games = new Map();
for (const id of allIds) {
    const file = path.join(GAMES_DIR, id, 'game.json');
    if (!fs.existsSync(file)) {
        if (idsToCheck.includes(id)) report(id, 'Folder has no game.json');
        continue;
    }
    try {
        games.set(id, JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
        if (idsToCheck.includes(id)) report(id, `game.json is not valid JSON: ${error.message}`);
    }
}

for (const id of idsToCheck) {
    if (!allIds.includes(id)) {
        report(id, 'No such folder under games/');
        continue;
    }
    const game = games.get(id);
    if (!game) continue;

    for (const message of validateGame(id, game)) report(id, message);

    for (const [otherId, other] of games) {
        if (otherId === id) continue;
        if (game.url && other.url && urlKey(game.url) === urlKey(other.url)) {
            report(id, `Same URL as games/${otherId} (${other.url})`);
        }
        if (typeof game.title === 'string' && typeof other.title === 'string'
            && game.title.trim().toLowerCase() === other.title.trim().toLowerCase()) {
            report(id, `Same title as games/${otherId}`);
        }
    }
}

if (problems.length) {
    console.error(`\n${problems.length} problem(s) found:\n`);
    for (const { id, message } of problems) console.error(`  games/${id}: ${message}`);
    console.error('\nSee README.md > "Adding Your Game" for the expected format.');
    process.exit(1);
}

console.log(`All ${idsToCheck.length} game(s) valid.`);

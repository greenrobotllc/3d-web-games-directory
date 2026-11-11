/**
 * Rules for games/<id>/game.json. Shared by the validator, the screenshot
 * script and CI. No dependencies, so it runs with plain `node`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CATEGORIES = Object.keys(
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'categories.json'), 'utf8')),
);

// Lowercase letters, digits, dots and dashes; e.g. "my-game" or "fly.pieter.com".
export const GAME_ID_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/;

const TEXT_FIELDS = {
    title: { min: 2, max: 80 },
    description: { min: 20, max: 600 },
    how_to_play: { min: 10, max: 600 },
};

const CONTRIBUTOR_FIELDS = ['title', 'url', 'description', 'how_to_play', 'category'];
const GENERATED_FIELDS = ['screenshot', 'thumbnail'];

export function validateGameId(id) {
    if (!GAME_ID_PATTERN.test(id) || id.includes('..')) {
        throw new Error(`Invalid game folder name "${id}". Use lowercase letters, numbers, dots and dashes (e.g. "my-cool-game").`);
    }
}

/**
 * Validate one parsed game.json. Returns a list of human-readable problems
 * (empty when the game is valid).
 */
export function validateGame(id, game) {
    const errors = [];

    try {
        validateGameId(id);
    } catch (error) {
        errors.push(error.message);
    }

    if (!game || typeof game !== 'object' || Array.isArray(game)) {
        return [...errors, 'game.json must contain a JSON object'];
    }

    for (const field of CONTRIBUTOR_FIELDS) {
        if (!(field in game)) errors.push(`Missing required field "${field}"`);
    }

    const allowed = new Set([...CONTRIBUTOR_FIELDS, ...GENERATED_FIELDS]);
    for (const field of Object.keys(game)) {
        if (!allowed.has(field)) errors.push(`Unknown field "${field}" (allowed: ${CONTRIBUTOR_FIELDS.join(', ')})`);
    }

    for (const [field, { min, max }] of Object.entries(TEXT_FIELDS)) {
        const value = game[field];
        if (value === undefined) continue;
        if (typeof value !== 'string') {
            errors.push(`"${field}" must be a string`);
            continue;
        }
        const length = value.trim().length;
        if (length < min || length > max) {
            errors.push(`"${field}" must be ${min}-${max} characters (currently ${length})`);
        }
        if (/[<>]/.test(value)) errors.push(`"${field}" must not contain HTML (< or >)`);
        // eslint-disable-next-line no-control-regex
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
            errors.push(`"${field}" contains control characters`);
        }
    }

    if (game.url !== undefined) {
        let parsed = null;
        try {
            parsed = new URL(game.url);
        } catch {
            errors.push(`"url" is not a valid URL: ${game.url}`);
        }
        if (parsed) {
            if (parsed.protocol !== 'https:') errors.push('"url" must start with https://');
            if (parsed.username || parsed.password) errors.push('"url" must not contain credentials');
        }
    }

    if (game.category !== undefined && !CATEGORIES.includes(game.category)) {
        errors.push(`"category" must be one of: ${CATEGORIES.join(', ')} (got "${game.category}")`);
    }

    const generatedPatterns = {
        screenshot: new RegExp(`^/games/${escapeRegExp(id)}/screenshots/[A-Za-z0-9._-]+\\.(jpe?g|png)$`),
        thumbnail: new RegExp(`^/games/${escapeRegExp(id)}/images/thumb\\.jpg$`),
    };
    for (const [field, pattern] of Object.entries(generatedPatterns)) {
        if (game[field] !== undefined && (typeof game[field] !== 'string' || !pattern.test(game[field]))) {
            errors.push(`"${field}" is generated automatically; remove it from your game.json`);
        }
    }

    return errors;
}

/** Normalize a URL for duplicate detection (host + path, no trailing slash). */
export function urlKey(url) {
    try {
        const u = new URL(url);
        return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
        return String(url).toLowerCase();
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

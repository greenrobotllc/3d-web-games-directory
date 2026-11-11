#!/usr/bin/env bash
# Validate, screenshot and index specific games.
#   npm run process -- huss-valley-game
#   npm run process -- games/a/game.json games/b/game.json
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$#" -eq 0 ]; then
    echo "usage: npm run process -- <game-id> [<game-id> ...]" >&2
    exit 1
fi

# Validate before loading any contributor URL in a browser.
node scripts/validate-games.js "$@"
node scripts/take-screenshots.js "$@" || echo "WARNING: some screenshots fell back to a placeholder; check the log above." >&2
php scripts/generate_index.php
php scripts/generate_categories.php

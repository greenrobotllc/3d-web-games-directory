#!/bin/bash

# Exit on error
set -e

# Configuration
REPO_PATH=$(pwd)
MAIN_BRANCH="main"
GAMES_DIR="games"

echo "Starting games directory update process..."

# Ensure we're in the repository directory
cd $REPO_PATH

# Update repository
echo "Updating repository..."
git fetch origin
git checkout $MAIN_BRANCH
git pull origin $MAIN_BRANCH

# Find new game directories by comparing with last run
# Store last processed commit in a file
LAST_COMMIT_FILE=".last_processed_commit"
LAST_COMMIT=$(cat $LAST_COMMIT_FILE 2>/dev/null || echo "HEAD^")
CURRENT_COMMIT=$(git rev-parse HEAD)

echo "Checking for changes since $LAST_COMMIT"

# Get list of changed game.json files
CHANGED_FILES=$(git diff --name-only $LAST_COMMIT $CURRENT_COMMIT | grep "game.json" || true)

if [ -z "$CHANGED_FILES" ]; then
    echo "No new or modified game.json files found."
else
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing Node dependencies..."
        npm install puppeteer sharp
    fi

    # Process each changed game
    echo "Processing changed games..."
    export ALL_CHANGED_FILES="$CHANGED_FILES"
    node scripts/take-screenshots.js
fi

# Generate index files
echo "Generating index files..."
php scripts/generate_index.php

# Update last processed commit
echo $CURRENT_COMMIT > $LAST_COMMIT_FILE

echo "Process completed successfully!" 
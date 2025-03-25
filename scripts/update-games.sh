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

# Process all game.json files
echo "Processing all games..."
export ALL_CHANGED_FILES=$(find games -name "game.json" | tr '\n' ' ')
node scripts/take-screenshots.js

# Generate index files
echo "Generating index files..."
php scripts/generate_index.php

echo "Process completed successfully!" 
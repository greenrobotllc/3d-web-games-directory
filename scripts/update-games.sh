#!/bin/bash

# Exit on error
set -e

# Configuration
REPO_PATH=$(pwd)
MAIN_BRANCH="main"
GAMES_DIR="games"

# Parse arguments
PROCESS_ALL=false
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --all) PROCESS_ALL=true ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

echo "Starting games directory update process..."

# Ensure we're in the repository directory
cd $REPO_PATH

# Update repository
echo "Updating repository..."
git fetch origin
git checkout $MAIN_BRANCH
git pull origin $MAIN_BRANCH

if [ "$PROCESS_ALL" = true ]; then
    # Process all game.json files
    echo "Processing all games..."
    # Convert newlines to spaces and remove trailing space
    export ALL_CHANGED_FILES=$(find games -name "game.json" | tr '\n' ' ' | sed 's/ *$//')
else
    # Find new or modified game.json files
    echo "Checking for new or modified games..."
    LAST_COMMIT_FILE=".last_processed_commit"
    LAST_COMMIT=$(cat $LAST_COMMIT_FILE 2>/dev/null || echo "HEAD^")
    CURRENT_COMMIT=$(git rev-parse HEAD)

    # Convert newlines to spaces and remove trailing space
    CHANGED_FILES=$(git diff --name-only $LAST_COMMIT $CURRENT_COMMIT | grep "game.json" | tr '\n' ' ' | sed 's/ *$//' || true)
    
    if [ -z "$CHANGED_FILES" ]; then
        echo "No new or modified game.json files found."
    else
        echo "Processing changed games..."
        export ALL_CHANGED_FILES="$CHANGED_FILES"
    fi
fi

# Only run screenshot generation if there are files to process
if [ ! -z "$ALL_CHANGED_FILES" ]; then
    echo "Processing files: $ALL_CHANGED_FILES"
    node scripts/take-screenshots.js
fi

# Generate index files
echo "Generating index files..."
php scripts/generate_index.php

# Update last processed commit
if [ "$PROCESS_ALL" = false ]; then
    echo $CURRENT_COMMIT > $LAST_COMMIT_FILE
fi

echo "Process completed successfully!" 
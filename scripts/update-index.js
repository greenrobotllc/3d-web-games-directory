import fs from 'fs/promises';
import path from 'path';

const CATEGORIES = {
    'fps': 'First Person Shooters',
    'death-match': 'Death Match Games',
    'fighting': 'Fighting Games',
    'battle-royale': 'Battle Royale',
    'rts': 'Real Time Strategy (RTS)',
    'simulator': 'Simulators',
    'strategy': 'Strategy Games',
    'adventure': 'Adventure Games',
    'rpg': 'Role Playing Games',
    'platformer': 'Platformers',
    'card-and-board': 'Card & Board Games',
    'horror': 'Horror Games',
    'mmo': 'MMO Games',
    'puzzle': 'Puzzle Games',
    'racing': 'Racing Games',
    'sandbox': 'Sandbox Games',
    'sports': 'Sports Games',
    'survival': 'Survival Games',
    'other': 'Other Games'
};

async function getAllGames() {
    const games = [];
    const gamesDir = path.join(process.cwd(), 'games');
    const gameDirs = await fs.readdir(gamesDir);

    for (const dir of gameDirs) {
        const gameJsonPath = path.join(gamesDir, dir, 'game.json');
        try {
            const gameData = JSON.parse(await fs.readFile(gameJsonPath, 'utf8'));
            games.push({
                ...gameData,
                directory: dir
            });
        } catch (error) {
            console.error(`Error reading ${gameJsonPath}:`, error);
        }
    }

    return games;
}

function categorizeGame(game) {
    // Use tags if available
    if (game.tags && Array.isArray(game.tags)) {
        for (const tag of game.tags) {
            const lowercaseTag = tag.toLowerCase();
            if (lowercaseTag in CATEGORIES) {
                return lowercaseTag;
            }
        }
    }
    
    // Default to 'other' if no matching category found
    return 'other';
}

async function generateCategoryPage(category, games) {
    const categoryGames = games.filter(game => categorizeGame(game) === category);
    const title = CATEGORIES[category];
    
    let content = `# ${title}\n\n`;
    
    for (const game of categoryGames) {
        content += `## [${game.title}](../games/${game.directory}/game.json)\n\n`;
        if (game.description) {
            content += `${game.description}\n\n`;
        }
        if (game.author) {
            content += `**Author:** ${game.author}\n\n`;
        }
        if (game.cover_image) {
            content += `![${game.title}](../games/${game.directory}/${game.cover_image.path})\n\n`;
        }
        content += `🎮 [Play Now](${game.url})\n\n`;
        content += '---\n\n';
    }

    await fs.writeFile(
        path.join(process.cwd(), 'categories', `${category}.md`),
        content
    );
}

async function generateAllGamesPage(games) {
    let content = '# All Games\n\n';
    
    for (const game of games) {
        content += `## [${game.title}](../games/${game.directory}/game.json)\n\n`;
        if (game.description) {
            content += `${game.description}\n\n`;
        }
        if (game.author) {
            content += `**Author:** ${game.author}\n\n`;
        }
        if (game.cover_image) {
            content += `![${game.title}](../games/${game.directory}/${game.cover_image.path})\n\n`;
        }
        content += `🎮 [Play Now](${game.url})\n\n`;
        content += '---\n\n';
    }

    await fs.writeFile(
        path.join(process.cwd(), 'categories', 'all-games.md'),
        content
    );
}

async function updateIndexes() {
    try {
        // Create categories directory if it doesn't exist
        await fs.mkdir(path.join(process.cwd(), 'categories'), { recursive: true });

        const games = await getAllGames();
        
        // Generate category pages
        for (const category of Object.keys(CATEGORIES)) {
            await generateCategoryPage(category, games);
        }
        
        // Generate all games page
        await generateAllGamesPage(games);
        
        console.log('Index files updated successfully!');
    } catch (error) {
        console.error('Error updating indexes:', error);
        process.exit(1);
    }
}

// Run the script
updateIndexes(); 
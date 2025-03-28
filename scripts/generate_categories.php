<?php

class CategoryGenerator {
    private $categories = [
        'Action' => 'action.md',
        'Adventure' => 'adventure.md',
        'Battle Royale' => 'battle-royale.md',
        'Card & Board' => 'card-and-board.md',
        'Death Match' => 'death-match.md',
        'Fighting' => 'fighting.md',
        'First Person Shooter' => 'fps.md',
        'FPS' => 'fps.md',
        'Horror' => 'horror.md',
        'MMO' => 'mmo.md',
        'Platformer' => 'platformer.md',
        'Puzzle' => 'puzzle.md',
        'Racing' => 'racing.md',
        'Real Time Strategy' => 'rts.md',
        'RTS' => 'rts.md',
        'Role Playing Game' => 'rpg.md',
        'RPG' => 'rpg.md',
        'Sandbox' => 'sandbox.md',
        'Shooter' => 'shooter.md',
        'Simulator' => 'simulator.md',
        'Sports' => 'sports.md',
        'Strategy' => 'strategy.md',
        'Survival' => 'survival.md',
        'Other' => 'other.md'
    ];

    public function generateCategories() {
        $indexFile = __DIR__ . '/../index.json';
        $categoriesDir = __DIR__ . '/../categories';

        // Create categories directory if it doesn't exist
        if (!file_exists($categoriesDir)) {
            mkdir($categoriesDir, 0777, true);
        }

        // Load games data
        $indexData = json_decode(file_get_contents($indexFile), true);
        if (!$indexData || !isset($indexData['games'])) {
            throw new Exception("Failed to load index.json or no games found");
        }

        // Group games by category
        $gamesByCategory = [];
        foreach ($indexData['games'] as $game) {
            $category = $game['category'];
            if (!isset($gamesByCategory[$category])) {
                $gamesByCategory[$category] = [];
            }
            $gamesByCategory[$category][] = $game;
        }

        // Generate category pages
        foreach ($this->categories as $category => $filename) {
            $games = $gamesByCategory[$category] ?? [];
            $this->generateCategoryPage($category, $games, "$categoriesDir/$filename");
        }

        // Generate all games page
        $this->generateAllGamesPage($indexData['games'], "$categoriesDir/all-games.md");

        echo "Category pages generated successfully!\n";
    }

    private function generateCategoryPage($category, $games, $outputFile) {
        $content = "# $category Games\n\n";
        
        if (empty($games)) {
            $content .= "_No games in this category yet._\n\n";
            $content .= "Want to add a game? Check out our [contribution guidelines](../README.md#how-to-add-your-game-)!\n";
        } else {
            foreach ($games as $game) {
                $content .= $this->formatGameEntry($game);
            }
        }

        file_put_contents($outputFile, $content);
    }

    private function generateAllGamesPage($games, $outputFile) {
        $content = "# All Games\n\n";
        
        if (empty($games)) {
            $content .= "_No games added yet._\n\n";
            $content .= "Want to add a game? Check out our [contribution guidelines](../README.md#how-to-add-your-game-)!\n";
        } else {
            // Sort games by title
            usort($games, function($a, $b) {
                return strcmp($a['title'], $b['title']);
            });

            foreach ($games as $game) {
                $content .= $this->formatGameEntry($game);
            }
        }

        file_put_contents($outputFile, $content);
    }

    private function formatGameEntry($game) {
        $content = "## {$game['title']}\n\n";
        
        // Add cover image if available
        if (isset($game['cover_image']) && $game['cover_image']['type'] === 'github') {
            $coverPath = "../games/{$game['id']}/{$game['cover_image']['path']}";
            $content .= "<img src=\"$coverPath\" alt=\"{$game['title']} cover image\" width=\"512\" height=\"512\">\n\n";
        }

        // Add thumbnail if available
        if (isset($game['thumbnail']) && $game['thumbnail']['type'] === 'github') {
            $thumbPath = "../games/{$game['id']}/{$game['thumbnail']['path']}";
            $content .= "<img src=\"$thumbPath\" alt=\"{$game['title']} thumbnail\" width=\"200\" height=\"200\">\n\n";
        }

        $content .= "**Category:** {$game['category']}\n\n";
        $content .= "{$game['description']}\n\n";
        
        if (isset($game['how_to_play'])) {
            $content .= "**How to Play:** {$game['how_to_play']}\n\n";
        }
        
        $content .= "[▶ Play Game]({$game['url']})\n\n";
        $content .= "---\n\n";

        return $content;
    }
}

// Run category generation
$generator = new CategoryGenerator();
$generator->generateCategories(); 
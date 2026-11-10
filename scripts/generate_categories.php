<?php

class CategoryGenerator {
    private $categories = [];

    public function __construct() {
        // Category name => markdown file; shared with validate-games.js
        $this->categories = json_decode(file_get_contents(__DIR__ . '/categories.json'), true);
    }

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
            $content .= "Want to add a game? Check out our [contribution guidelines](../README.md#adding-your-game-)!\n";
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
            $content .= "Want to add a game? Check out our [contribution guidelines](../README.md#adding-your-game-)!\n";
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
        
        // Add thumbnail if available
        if (isset($game['thumbnail'])) {
            $thumbPath = ".." . $game['thumbnail'];
            $content .= "<img src=\"$thumbPath\" alt=\"{$game['title']} thumbnail\" width=\"200\">\n\n";
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
<?php

require_once __DIR__ . '/image_processor.php';

class IndexGenerator {
    private $imageProcessor;
    private $categories = [];
    private $games = [];

    public function __construct() {
        $this->imageProcessor = new ImageProcessor();
    }

    public function generateIndex() {
        $gamesDir = __DIR__ . '/../games';
        
        // Scan for games
        foreach (glob($gamesDir . '/*/game.json') as $file) {
            $gameData = json_decode(file_get_contents($file), true);
            if ($gameData) {
                $gameData['id'] = basename(dirname($file));
                $this->games[] = $gameData;
                
                // Add to category
                $category = $gameData['category'];
                if (!isset($this->categories[$category])) {
                    $this->categories[$category] = [];
                }
                $this->categories[$category][] = $gameData;
            }
        }

        // Sort games by title
        usort($this->games, function($a, $b) {
            return strcasecmp($a['title'], $b['title']);
        });

        // Sort categories and games within categories
        ksort($this->categories);
        foreach ($this->categories as &$categoryGames) {
            usort($categoryGames, function($a, $b) {
                return strcasecmp($a['title'], $b['title']);
            });
        }

        // Generate index.json
        $this->generateJsonIndex();

        echo "Generated index.json successfully!\n";
        echo "Found " . count($this->games) . " games in " . count($this->categories) . " categories\n";
    }

    private function generateJsonIndex() {
        $indexData = [
            'categories' => [],
            'games' => []
        ];

        // Add categories with their games
        foreach ($this->categories as $categoryName => $categoryGames) {
            $indexData['categories'][] = [
                'name' => $categoryName,
                'game_count' => count($categoryGames),
                'games' => array_map(function($game) {
                    return $game['id'];
                }, $categoryGames)
            ];
        }

        // Add all games with their full data
        foreach ($this->games as $game) {
            $gameDir = dirname(dirname(__FILE__)) . '/games/' . $game['id'];
            $screenshotDir = $gameDir . '/screenshots';
            $imagesDir = $gameDir . '/images';
            
            // Find the most recent screenshot
            $screenshots = glob($screenshotDir . '/*.{jpg,jpeg,png}', GLOB_BRACE);
            $screenshot = !empty($screenshots) ? end($screenshots) : null;
            
            $gameData = [
                'id' => $game['id'],
                'title' => $game['title'],
                'description' => $game['description'],
                'url' => $game['url'],
                'category' => $game['category'],
                'how_to_play' => $game['how_to_play'],
                'screenshot' => $screenshot ? '/games/' . $game['id'] . '/screenshots/' . basename($screenshot) : null,
                'thumbnail' => '/games/' . $game['id'] . '/images/thumb.jpg'
            ];

            $indexData['games'][] = $gameData;
        }

        // Write the index file
        file_put_contents(__DIR__ . '/../index.json', json_encode($indexData, JSON_PRETTY_PRINT));
    }
}

// Run index generation
$generator = new IndexGenerator();
$generator->generateIndex(); 
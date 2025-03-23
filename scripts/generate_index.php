<?php

require_once __DIR__ . '/image_processor.php';

class IndexGenerator {
    private $imageProcessor;
    private $categories = [];
    private $games = [];
    private $categoriesDir;

    public function __construct() {
        $this->imageProcessor = new ImageProcessor();
        $this->categoriesDir = __DIR__ . '/../categories';
        if (!file_exists($this->categoriesDir)) {
            mkdir($this->categoriesDir, 0777, true);
        }
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

        // Generate all files
        $this->generateAllGamesFile();
        $this->generateCategoryFiles();
        $this->generateJsonIndex();

        echo "Generated all-games.md, category files, and index.json successfully!\n";
        echo "Found " . count($this->games) . " games in " . count($this->categories) . " categories\n";
    }

    private function generateAllGamesFile() {
        $content = "# All Games\n\n";
        
        foreach ($this->categories as $category => $games) {
            $content .= "## $category\n\n";
            foreach ($games as $game) {
                $content .= $this->formatGameEntry($game);
            }
            $content .= "\n";
        }

        file_put_contents($this->categoriesDir . '/all-games.md', $content);
    }

    private function generateJsonIndex() {
        $indexData = [
            'categories' => [],
            'games' => []
        ];

        // Add all games with their full data
        foreach ($this->games as $game) {
            $gameData = [
                'id' => $game['id'],
                'title' => $game['title'],
                'description' => $game['description'],
                'url' => $game['url'],
                'category' => $game['category']
            ];

            // Add screenshot if available
            $screenshotPath = $this->getLatestScreenshot($game['id']);
            if ($screenshotPath) {
                $gameData['screenshot'] = str_replace(__DIR__ . '/..', '', $screenshotPath);
            }

            $indexData['games'][] = $gameData;
        }

        // Add categories with their games
        foreach ($this->categories as $categoryName => $categoryGames) {
            $indexData['categories'][] = [
                'name' => $categoryName,
                'slug' => $this->getCategoryFilename($categoryName),
                'game_count' => count($categoryGames),
                'games' => array_map(function($game) {
                    return $game['id'];
                }, $categoryGames)
            ];
        }

        // Write the index file
        file_put_contents(__DIR__ . '/../index.json', json_encode($indexData, JSON_PRETTY_PRINT));
    }

    private function generateCategoryFiles() {
        foreach ($this->categories as $category => $games) {
            $filename = $this->getCategoryFilename($category);
            $content = "# $category Games\n\n";
            
            foreach ($games as $game) {
                $content .= $this->formatGameEntry($game);
            }

            file_put_contents($this->categoriesDir . '/' . $filename, $content);
        }
    }

    private function formatGameEntry($game) {
        $title = $game['title'];
        $description = $game['description'];
        $url = $game['url'];
        $gameId = $game['id'];
        
        // Get the latest screenshot
        $screenshotPath = $this->getLatestScreenshot($gameId);
        
        $content = "### [$title]($url)\n\n";
        
        // Add screenshot if available
        if ($screenshotPath) {
            $relativeScreenshotPath = str_replace(__DIR__ . '/..', '', $screenshotPath);
            $content .= "<img src=\"$relativeScreenshotPath\" width=\"200\" height=\"200\" alt=\"$title screenshot\">\n\n";
        }
        
        $content .= "$description\n\n";
        
        return $content;
    }

    private function getLatestScreenshot($gameId) {
        $screenshotsDir = __DIR__ . "/../games/$gameId/screenshots";
        if (!file_exists($screenshotsDir)) {
            return null;
        }

        $screenshots = glob("$screenshotsDir/$gameId-*.jpg");
        if (empty($screenshots)) {
            return null;
        }

        // Return the most recent screenshot (last in alphabetical order due to timestamp)
        return end($screenshots);
    }

    private function getCategoryFilename($category) {
        // Convert category name to filename
        $filename = strtolower(str_replace([' ', '&'], ['-', 'and'], $category));
        return "$filename.md";
    }

    private function processGame($game, $gamePath) {
        // Process cover image
        if ($game['cover_image']['type'] === 'github') {
            $coverPath = $gamePath . '/' . $game['cover_image']['path'];
            if (!file_exists($coverPath)) {
                throw new Exception("Cover image not found: $coverPath");
            }
            // Update path to be relative to repo root
            $game['cover_image']['path'] = str_replace(__DIR__ . '/..', '', $coverPath);
        }

        // Process or generate thumbnail
        if (!isset($game['thumbnail']) || $game['thumbnail']['type'] === 'auto') {
            // Generate thumbnail from cover image
            $thumbDir = $gamePath . '/images';
            if (!file_exists($thumbDir)) {
                mkdir($thumbDir, 0777, true);
            }

            if ($game['cover_image']['type'] === 'github') {
                $thumbPath = $thumbDir . '/thumb.jpg';
                $this->imageProcessor->generateThumbnail($coverPath, $thumbPath);
                $game['thumbnail'] = [
                    'type' => 'github',
                    'path' => str_replace(__DIR__ . '/..', '', $thumbPath)
                ];
            } else {
                // For external images, download, generate thumb, and save
                $tempFile = tempnam(sys_get_temp_dir(), 'cover_');
                file_put_contents($tempFile, file_get_contents($game['cover_image']['path']));
                $thumbPath = $thumbDir . '/thumb.jpg';
                $this->imageProcessor->generateThumbnail($tempFile, $thumbPath);
                unlink($tempFile);
                $game['thumbnail'] = [
                    'type' => 'github',
                    'path' => str_replace(__DIR__ . '/..', '', $thumbPath)
                ];
            }
        } elseif ($game['thumbnail']['type'] === 'github') {
            $thumbPath = $gamePath . '/' . $game['thumbnail']['path'];
            if (!file_exists($thumbPath)) {
                throw new Exception("Thumbnail not found: $thumbPath");
            }
            // Update path to be relative to repo root
            $game['thumbnail']['path'] = str_replace(__DIR__ . '/..', '', $thumbPath);
        }

        return $game;
    }
}

// Run index generation
$generator = new IndexGenerator();
$generator->generateIndex(); 
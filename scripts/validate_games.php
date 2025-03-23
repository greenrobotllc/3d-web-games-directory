<?php

class GameValidator {
    private $validCategories = [
        'Action', 'Adventure', 'Battle Royale', 'Card & Board',
        'Death Match', 'Fighting', 'First Person Shooter', 'FPS',
        'Horror', 'MMO', 'Platformer', 'Puzzle', 'Racing',
        'Real Time Strategy', 'RTS', 'Role Playing Game', 'RPG',
        'Sandbox', 'Shooter', 'Simulator', 'Sports', 'Strategy',
        'Survival', 'Other'
    ];

    public function validateGames() {
        $gamesDir = __DIR__ . '/../games';
        $errors = [];

        foreach (glob($gamesDir . '/*/game.json') as $file) {
            $gameData = json_decode(file_get_contents($file), true);
            $gameName = basename(dirname($file));
            
            if (!$gameData) {
                $errors[] = "Invalid JSON in $file";
                continue;
            }

            $errors = array_merge($errors, $this->validateGameData($gameData, $file));
            $errors = array_merge($errors, $this->validateImages($gameData, dirname($file)));
        }

        if (!empty($errors)) {
            echo "Validation errors found:\n";
            foreach ($errors as $error) {
                echo "- $error\n";
            }
            exit(1);
        }

        echo "All games validated successfully!\n";
    }

    private function validateGameData($game, $file) {
        $errors = [];
        
        // Required fields
        $requiredFields = ['title', 'url', 'description', 'category', 'cover_image'];
        foreach ($requiredFields as $field) {
            if (!isset($game[$field])) {
                $errors[] = "Missing required field '$field' in $file";
            }
        }

        // URL validation
        if (isset($game['url']) && !filter_var($game['url'], FILTER_VALIDATE_URL)) {
            $errors[] = "Invalid URL in $file";
        }

        // Category validation
        if (isset($game['category']) && !in_array($game['category'], $this->validCategories)) {
            $errors[] = "Invalid category '{$game['category']}' in $file";
        }

        // Cover image validation
        if (isset($game['cover_image'])) {
            if (!isset($game['cover_image']['type']) || 
                !in_array($game['cover_image']['type'], ['github', 'external'])) {
                $errors[] = "Invalid cover_image type in $file";
            }
            if (!isset($game['cover_image']['path'])) {
                $errors[] = "Missing cover_image path in $file";
            }
        }

        // Thumbnail validation (if provided)
        if (isset($game['thumbnail']) && $game['thumbnail']['type'] !== 'auto') {
            if (!isset($game['thumbnail']['type']) || 
                !in_array($game['thumbnail']['type'], ['github', 'external'])) {
                $errors[] = "Invalid thumbnail type in $file";
            }
            if (!isset($game['thumbnail']['path'])) {
                $errors[] = "Missing thumbnail path in $file";
            }
        }

        return $errors;
    }

    private function validateImages($game, $gameDir) {
        $errors = [];

        if ($game['cover_image']['type'] === 'github') {
            $coverPath = $gameDir . '/' . $game['cover_image']['path'];
            if (!file_exists($coverPath)) {
                $errors[] = "Cover image not found: $coverPath";
            } else {
                // Validate image size and dimensions
                $imageInfo = getimagesize($coverPath);
                if (!$imageInfo) {
                    $errors[] = "Invalid image file: $coverPath";
                } else {
                    if (filesize($coverPath) > 500 * 1024) { // 500KB limit
                        $errors[] = "Cover image too large (max 500KB): $coverPath";
                    }
                }
            }
        }

        if (isset($game['thumbnail']) && $game['thumbnail']['type'] === 'github') {
            $thumbPath = $gameDir . '/' . $game['thumbnail']['path'];
            if (!file_exists($thumbPath)) {
                $errors[] = "Thumbnail not found: $thumbPath";
            } else {
                // Validate thumbnail size and dimensions
                $imageInfo = getimagesize($thumbPath);
                if (!$imageInfo) {
                    $errors[] = "Invalid thumbnail file: $thumbPath";
                } else {
                    if (filesize($thumbPath) > 200 * 1024) { // 200KB limit
                        $errors[] = "Thumbnail too large (max 200KB): $thumbPath";
                    }
                }
            }
        }

        return $errors;
    }
}

// Run validation
$validator = new GameValidator();
$validator->validateGames(); 
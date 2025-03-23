<?php

require_once __DIR__ . '/image_processor.php';

class AtlasGenerator {
    private $imageProcessor;
    private $atlasSize = 2048; // Power of 2 for WebGL compatibility
    private $thumbSize = 256;
    private $padding = 4;
    private $maxGamesPerRow;
    private $maxGamesPerColumn;

    public function __construct() {
        $this->imageProcessor = new ImageProcessor();
        $this->maxGamesPerRow = floor($this->atlasSize / ($this->thumbSize + $this->padding * 2));
        $this->maxGamesPerColumn = floor($this->atlasSize / ($this->thumbSize + $this->padding * 2));
    }

    public function generateAtlas() {
        $indexFile = __DIR__ . '/../index.json';
        $games = json_decode(file_get_contents($indexFile), true);
        
        if (!$games) {
            throw new Exception("Failed to load index.json");
        }

        // Create atlas image
        $atlas = new Imagick();
        $atlas->newImage($this->atlasSize, $this->atlasSize, new ImagickPixel('white'));
        
        // Calculate grid dimensions
        $totalGames = count($games);
        $gridSize = ceil(sqrt($totalGames));
        
        if ($gridSize > $this->maxGamesPerRow || $gridSize > $this->maxGamesPerColumn) {
            throw new Exception("Too many games for atlas size");
        }

        // Process each game
        foreach ($games as $index => $game) {
            $row = floor($index / $gridSize);
            $col = $index % $gridSize;
            
            // Calculate position
            $x = $col * ($this->thumbSize + $this->padding * 2) + $this->padding;
            $y = $row * ($this->thumbSize + $this->padding * 2) + $this->padding;
            
            // Get thumbnail
            $thumbPath = $this->getThumbnailPath($game);
            if (!$thumbPath) {
                throw new Exception("No thumbnail found for game: {$game['title']}");
            }
            
            // Load and resize thumbnail
            $thumb = new Imagick($thumbPath);
            $thumb->resizeImage($this->thumbSize, $this->thumbSize, Imagick::FILTER_LANCZOS, 1, true);
            
            // Composite onto atlas
            $atlas->compositeImage($thumb, Imagick::COMPOSITE_OVER, $x, $y);
            
            // Clean up
            $thumb->destroy();
        }

        // Save atlas
        $atlas->setImageFormat('png');
        $atlas->writeImage(__DIR__ . '/../static/images/game-atlas.png');
        
        // Clean up
        $atlas->destroy();
        
        echo "Atlas generated successfully!\n";
    }

    private function getThumbnailPath($game) {
        if (!isset($game['thumbnail'])) {
            return null;
        }

        if ($game['thumbnail']['type'] === 'github') {
            return __DIR__ . '/..' . $game['thumbnail']['path'];
        } else {
            // For external images, download to temp file
            $tempFile = tempnam(sys_get_temp_dir(), 'thumb_');
            file_put_contents($tempFile, file_get_contents($game['thumbnail']['path']));
            return $tempFile;
        }
    }
}

// Run atlas generation
$generator = new AtlasGenerator();
$generator->generateAtlas(); 
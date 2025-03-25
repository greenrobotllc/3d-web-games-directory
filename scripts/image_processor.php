<?php

class ImageProcessor {
    public function generateThumbnail($sourcePath, $targetPath, $size = 200) {
        // Load the image
        $image = $this->loadImage($sourcePath);
        if (!$image) {
            throw new Exception("Failed to load image: $sourcePath");
        }

        // Get original dimensions
        $width = imagesx($image);
        $height = imagesy($image);

        // Create square thumbnail
        $thumb = imagecreatetruecolor($size, $size);

        // Preserve transparency for PNG images
        imagealphablending($thumb, false);
        imagesavealpha($thumb, true);

        // Calculate scaling and positioning for center crop
        $scale = max($size / $width, $size / $height);
        $scaledWidth = $width * $scale;
        $scaledHeight = $height * $scale;
        $x = ($size - $scaledWidth) / 2;
        $y = ($size - $scaledHeight) / 2;

        // Resize and crop
        imagecopyresampled(
            $thumb, $image,
            $x, $y,
            0, 0,
            $scaledWidth, $scaledHeight,
            $width, $height
        );

        // Save thumbnail
        $this->saveImage($thumb, $targetPath);

        // Clean up
        imagedestroy($image);
        imagedestroy($thumb);
    }

    private function loadImage($path) {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        
        switch ($extension) {
            case 'jpg':
            case 'jpeg':
                return imagecreatefromjpeg($path);
            case 'png':
                return imagecreatefrompng($path);
            case 'gif':
                return imagecreatefromgif($path);
            default:
                throw new Exception("Unsupported image format: $extension");
        }
    }

    private function saveImage($image, $path) {
        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        
        switch ($extension) {
            case 'jpg':
            case 'jpeg':
                imagejpeg($image, $path, 90);
                break;
            case 'png':
                imagepng($image, $path, 9);
                break;
            case 'gif':
                imagegif($image, $path);
                break;
            default:
                throw new Exception("Unsupported output format: $extension");
        }
    }

    public function optimizeImage($sourcePath, $destPath = null) {
        $destPath = $destPath ?? $sourcePath;
        $image = new Imagick($sourcePath);
        
        // Convert to RGB if needed
        if ($image->getImageColorspace() == Imagick::COLORSPACE_CMYK) {
            $image->transformImageColorspace(Imagick::COLORSPACE_SRGB);
        }
        
        // Strip metadata
        $image->stripImage();
        
        // Set reasonable quality
        $image->setImageCompressionQuality(85);
        
        // Save
        $image->writeImage($destPath);
        
        // Clean up
        $image->destroy();
    }

    public function validateImage($path, $maxWidth = null, $maxHeight = null, $maxSize = null) {
        if (!file_exists($path)) {
            throw new Exception("Image file not found: $path");
        }

        $imageInfo = getimagesize($path);
        if (!$imageInfo) {
            throw new Exception("Invalid image file: $path");
        }

        list($width, $height) = $imageInfo;

        if ($maxWidth && $width > $maxWidth) {
            throw new Exception("Image width ($width) exceeds maximum ($maxWidth)");
        }

        if ($maxHeight && $height > $maxHeight) {
            throw new Exception("Image height ($height) exceeds maximum ($maxHeight)");
        }

        if ($maxSize) {
            $size = filesize($path);
            if ($size > $maxSize) {
                throw new Exception("Image file size (" . round($size/1024) . "KB) exceeds maximum (" . round($maxSize/1024) . "KB)");
            }
        }

        return true;
    }
} 
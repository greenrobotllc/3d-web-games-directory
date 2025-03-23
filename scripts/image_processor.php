<?php

class ImageProcessor {
    public function generateThumbnail($sourcePath, $destPath) {
        $image = new Imagick($sourcePath);
        
        // Convert to RGB if needed
        if ($image->getImageColorspace() == Imagick::COLORSPACE_CMYK) {
            $image->transformImageColorspace(Imagick::COLORSPACE_SRGB);
        }
        
        // Resize to 256x256 maintaining aspect ratio
        $image->resizeImage(256, 256, Imagick::FILTER_LANCZOS, 1, true);
        
        // Create white background
        $bg = new Imagick();
        $bg->newImage(256, 256, new ImagickPixel('white'));
        
        // Center the resized image
        $geometry = $image->getImageGeometry();
        $x = (256 - $geometry['width']) / 2;
        $y = (256 - $geometry['height']) / 2;
        
        // Composite image onto white background
        $bg->compositeImage($image, Imagick::COMPOSITE_OVER, $x, $y);
        
        // Set quality and save
        $bg->setImageCompressionQuality(85);
        $bg->writeImage($destPath);
        
        // Clean up
        $image->destroy();
        $bg->destroy();
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
/**
 * Image processing shared by take-screenshots.js and rebuild-images.js.
 *
 * - Cover (games/<id>/screenshots/<id>-<time>.jpg): the full image, at most 1200px wide, JPEG.
 *   Shown in the store's game panel and used for social previews and the shelf atlas.
 * - Card (games/<id>/images/thumb.jpg): exactly 800x420 (the 1.91:1 shape of a social
 *   preview), JPEG. Shown on the list pages at 3dwebgames.com/games, sharp on high-DPI screens.
 */
import sharp from 'sharp';

export const COVER_MAX_WIDTH = 1200;
export const CARD = { width: 800, height: 420 };

/** An og:image narrower than this is too small to use; take a screenshot instead. */
export const MIN_SHARE_IMAGE_WIDTH = 600;

/** Re-encode any image as the cover: at most 1200px wide, flattened onto black, JPEG. */
export async function makeCover(input) {
    return sharp(input)
        .resize({ width: COVER_MAX_WIDTH, withoutEnlargement: true })
        .flatten({ background: '#000000' })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
}

/**
 * Make the 800x420 card from a cover.
 * Wide images (landscape, close to 1.91:1) are cropped to fill the card. Square, tall
 * or very wide images (logos, icons, banners) would lose too much to cropping, so they
 * are fitted inside the card on a blurred, darkened copy of themselves.
 */
export async function makeCard(input) {
    const { width, height } = await sharp(input).metadata();
    const ratio = width / height;

    if (ratio >= 1.5 && ratio <= 2.4) {
        return sharp(input)
            .resize(CARD.width, CARD.height, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
    }

    const backdrop = await sharp(input)
        .resize(CARD.width, CARD.height, { fit: 'cover' })
        .blur(24)
        .modulate({ brightness: 0.55 })
        .toBuffer();
    // Don't enlarge small art more than 1.5x; past that it only gets blurrier.
    const scale = Math.min(CARD.width / width, CARD.height / height, 1.5);
    const fitted = await sharp(input)
        .resize(Math.round(width * scale), Math.round(height * scale))
        .toBuffer();
    return sharp(backdrop)
        .composite([{ input: fitted, gravity: 'centre' }])
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer();
}

/** Width of an image buffer, or 0 if it can't be read. */
export async function imageWidth(input) {
    try {
        return (await sharp(input).metadata()).width || 0;
    } catch {
        return 0;
    }
}

// One-shot helper: copy/resize the final brand PNGs into the right places.
// Run once with `node scripts/install-brand-assets.mjs`, then this file can stay
// in scripts/ as documentation of where each asset comes from.

import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const BRAND_DIR = path.join(ROOT, "מקוביצקי ניהול פרוייקטים מיתוג סופי");

const HORIZONTAL_LIGHT = path.join(BRAND_DIR, "04_לוגו_אופקי_ללא_סלוגן.png");
const HORIZONTAL_LIGHT_WITH_SLOGAN = path.join(BRAND_DIR, "03_לוגו_אופקי_עם_סלוגן.png");
const VERTICAL_DARK = path.join(BRAND_DIR, "06_גרסה_לרקע_כהה.png");
const ICON_ONLY = path.join(BRAND_DIR, "05_אייקון_בלבד.png");

async function compress(src, dest, maxWidth) {
  // Cap width at maxWidth (Next.js Image serves further-downscaled versions
  // at runtime) and run PNG through sharp's palette compressor so the file
  // we ship is web-grade, not multi-MB print-grade.
  const { width } = await sharp(src).metadata();
  const pipe = sharp(src);
  if (width && width > maxWidth) {
    pipe.resize({ width: maxWidth });
  }
  await pipe.png({ compressionLevel: 9, palette: true, quality: 85 }).toFile(dest);
  console.log(`✓ compress ${path.relative(ROOT, dest)} (max ${maxWidth}px)`);
}

async function resizeSquare(src, dest, size) {
  await sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(dest);
  console.log(`✓ resize ${path.relative(ROOT, dest)} (${size}×${size})`);
}

async function main() {
  // Horizontal logo for light backgrounds (portal, quote, /m, print).
  await compress(HORIZONTAL_LIGHT, path.join(ROOT, "public", "logo.png"), 1200);

  // Horizontal-with-slogan for the mobile top bar — shown on a brand-cream chip.
  // Picked over `logo-dark.png` (vertical) on mobile because the top bar gives us
  // horizontal real estate, not vertical, so a vertical logo cropped tiny made
  // the slogan unreadable.
  await compress(HORIZONTAL_LIGHT_WITH_SLOGAN, path.join(ROOT, "public", "logo-horizontal.png"), 1200);

  // Vertical full logo on dark Charcoal — sidebar + auth pages.
  await compress(VERTICAL_DARK, path.join(ROOT, "public", "logo-dark.png"), 1200);

  // Icon-only — small contexts.
  await compress(ICON_ONLY, path.join(ROOT, "public", "logo-icon.png"), 800);

  // PWA / favicons — all derived from the icon-only asset.
  await resizeSquare(ICON_ONLY, path.join(ROOT, "public", "icon-192.png"), 192);
  await resizeSquare(ICON_ONLY, path.join(ROOT, "public", "icon-512.png"), 512);
  await resizeSquare(ICON_ONLY, path.join(ROOT, "app", "icon.png"), 256);
  await resizeSquare(ICON_ONLY, path.join(ROOT, "app", "apple-icon.png"), 180);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

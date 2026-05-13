// One-off generator: builds public/logo.png + app/icon.png + app/apple-icon.png
// from the source JPEG at the project root. Run with: node scripts/gen-logo-assets.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// Source is in the project root (one level above the worktree). Use the user-provided file.
const sourceCandidates = [
  path.resolve(root, "../../../לוגו מקובצקי ניהול פרוייקטים.jpeg"),
  path.resolve(root, "public/logo-source.png"),
  path.resolve(root, "public/logo-source.jpg"),
  path.resolve(root, "public/logo-source.jpeg")
];

const { existsSync } = await import("node:fs");
const source = sourceCandidates.find(existsSync);
if (!source) {
  console.error("No source logo found. Tried:\n" + sourceCandidates.join("\n"));
  process.exit(1);
}
console.log("Using source:", source);

// Normalize EXIF orientation first by re-encoding to a buffer; then read dims.
const normalized = await sharp(source).rotate().png().toBuffer();
const meta = await sharp(normalized).metadata();
console.log(`Source (normalized): ${meta.width}x${meta.height} ${meta.format}`);

// 1. Full logo (trimmed + as PNG for crisp rendering on cream backgrounds).
// We trim the cream border so the logo sizes consistently when scaled.
await mkdir(path.join(root, "public"), { recursive: true });
await sharp(normalized)
  .trim({ threshold: 20 })
  .resize({ width: 600, withoutEnlargement: true })
  .png()
  .toFile(path.join(root, "public/logo.png"));
console.log("→ public/logo.png");

// 2. Icon-only (top ~62% of the source — building + tower, no Hebrew text).
// Source is roughly square; crop top portion as the favicon symbol.
// Use width-1 to avoid sharp's "bad extract area" off-by-one when matching full width.
const iconCropHeight = Math.min(Math.round(meta.height * 0.62), meta.height - 1);
const iconCropWidth = meta.width - 1;
const extracted = await sharp(normalized)
  .extract({ left: 0, top: 0, width: iconCropWidth, height: iconCropHeight })
  .png()
  .toBuffer();
const iconBase = await sharp(extracted).trim({ threshold: 20 }).png().toBuffer();

// Next.js convention: app/icon.png and app/apple-icon.png are auto-wired.
await sharp(iconBase).resize(256, 256, { fit: "contain", background: { r: 250, g: 248, b: 243 } }).png().toFile(path.join(root, "app/icon.png"));
console.log("→ app/icon.png (256x256)");

await sharp(iconBase).resize(180, 180, { fit: "contain", background: { r: 250, g: 248, b: 243 } }).png().toFile(path.join(root, "app/apple-icon.png"));
console.log("→ app/apple-icon.png (180x180)");

console.log("Done.");

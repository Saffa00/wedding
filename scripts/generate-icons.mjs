// Renders public/icons/icon.svg into the PNG sizes the manifest and iOS need.
// The artwork sits inside the central safe zone, so one file serves as both the normal and the maskable icon.
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const targets = { "icon-192.png": 192, "icon-512.png": 512, "icon-maskable-512.png": 512, "apple-touch-icon.png": 180 };
for (const [name, size] of Object.entries(targets)) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)));
  console.log("wrote", name);
}

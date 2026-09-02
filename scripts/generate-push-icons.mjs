/** Sync Web Push/install aliases from the approved final Itjima v7 artwork. */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const publicDir = resolve(process.cwd(), "public");
const iconDir = resolve(publicDir, "icons");
mkdirSync(iconDir, { recursive: true });

const copies = [
  [resolve(iconDir, "itjima-192-v7.png"), resolve(iconDir, "icon-192.png")],
  [resolve(iconDir, "itjima-512-v7.png"), resolve(iconDir, "icon-512.png")],
  [resolve(iconDir, "itjima-badge-72-v7.png"), resolve(iconDir, "badge-72.png")],
  [resolve(iconDir, "itjima-192-v7.png"), resolve(publicDir, "icon-192.png")],
  [resolve(iconDir, "itjima-512-v7.png"), resolve(publicDir, "icon-512.png")],
];

for (const [source, target] of copies) {
  if (!existsSync(source)) {
    throw new Error(`Missing canonical Itjima brand asset: ${source}`);
  }
  copyFileSync(source, target);
}

console.log("Synced push/install aliases from final Itjima v7 artwork.");

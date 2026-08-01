import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = join(process.cwd(), "dist", "assets");
const maxChunkBytes = 700 * 1024;
const maxTotalJsBytes = 2.5 * 1024 * 1024;

const files = (await readdir(assetsDir))
  .filter((file) => file.endsWith(".js"))
  .sort();

if (files.length === 0) {
  throw new Error("Bundle budget check found no JavaScript assets in dist/assets.");
}

const rows = [];
for (const file of files) {
  const info = await stat(join(assetsDir, file));
  rows.push({ file, bytes: info.size });
}

rows.sort((a, b) => b.bytes - a.bytes);
const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);

console.log("Production JavaScript bundle budget:");
for (const row of rows) {
  console.log(`- ${row.file}: ${(row.bytes / 1024).toFixed(1)} KiB`);
}
console.log(`- total: ${(totalBytes / 1024).toFixed(1)} KiB`);

const oversized = rows.filter((row) => row.bytes > maxChunkBytes);
if (oversized.length > 0) {
  console.error(
    `Each JavaScript chunk must stay at or below ${maxChunkBytes / 1024} KiB.`,
  );
  for (const row of oversized) {
    console.error(`Oversized: ${row.file} (${(row.bytes / 1024).toFixed(1)} KiB)`);
  }
  process.exitCode = 1;
}

if (totalBytes > maxTotalJsBytes) {
  console.error(
    `Total JavaScript must stay at or below ${(maxTotalJsBytes / 1024 / 1024).toFixed(1)} MiB.`,
  );
  process.exitCode = 1;
}

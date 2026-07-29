import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngDimensions(path: string) {
  const buf = readFileSync(path);
  expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

describe("push notification icons", () => {
  it("ships valid PNG assets in public/", () => {
    const icon = readPngDimensions(
      resolve(import.meta.dirname, "../public/icons/icon-192.png"),
    );
    const badge = readPngDimensions(
      resolve(import.meta.dirname, "../public/icons/badge-72.png"),
    );
    expect(icon).toEqual({ width: 192, height: 192 });
    expect(badge).toEqual({ width: 72, height: 72 });
  });
});

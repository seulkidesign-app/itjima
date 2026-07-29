/** One-off PNG generator for Web Push notification icons (no dependencies). */
import { createWriteStream } from "node:fs";
import { deflateSync } from "node:zlib";

const BRAND = { r: 255, g: 210, b: 51 };
const INK = { r: 26, g: 26, b: 26 };

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function roundedRectPixel(x, y, size, radius, fg, bg) {
  const cx = size / 2;
  const cy = size / 2;
  const rx = x + 0.5;
  const ry = y + 0.5;
  const left = cx - radius;
  const right = cx + radius;
  const top = cy - radius;
  const bottom = cy + radius;

  const inRect =
    rx >= left && rx <= right && ry >= top && ry <= bottom;
  if (!inRect) return bg;

  const cornerChecks = [
    [left, top],
    [right, top],
    [left, bottom],
    [right, bottom],
  ];
  for (const [cornerX, cornerY] of cornerChecks) {
    const dx = rx - cornerX;
    const dy = ry - cornerY;
    if (Math.abs(dx) <= radius && Math.abs(dy) <= radius) {
      if (dx * dx + dy * dy > radius * radius) return bg;
    }
  }

  // Simple "I" letter mark for badge readability at small sizes
  if (size <= 96) {
    const barW = Math.max(2, Math.round(size * 0.12));
    const cxMid = cx;
    const topBar = Math.round(size * 0.28);
    const botBar = Math.round(size * 0.72);
    const stemLeft = cxMid - barW / 2;
    const stemRight = cxMid + barW / 2;
    if (
      (ry >= topBar && ry <= topBar + barW && rx >= stemLeft && rx <= stemRight) ||
      (ry >= botBar - barW && ry <= botBar && rx >= stemLeft && rx <= stemRight) ||
      (ry >= topBar && ry <= botBar && rx >= stemLeft && rx <= stemRight)
    ) {
      return INK;
    }
    return fg;
  }

  const stemLeft = Math.round(size * 0.34);
  const stemRight = Math.round(size * 0.66);
  const topBarY = Math.round(size * 0.24);
  const botBarY = Math.round(size * 0.76);
  const barH = Math.max(3, Math.round(size * 0.08));
  if (
    (ry >= topBarY && ry <= topBarY + barH && rx >= stemLeft && rx <= stemRight) ||
    (ry >= botBarY - barH && ry <= botBarY && rx >= stemLeft && rx <= stemRight) ||
    (ry >= topBarY && ry <= botBarY && rx >= stemLeft && rx <= stemLeft + barH)
  ) {
    return INK;
  }
  return fg;
}

function writePng(path, size) {
  const radius = Math.round(size * 0.22);
  const row = Buffer.alloc(1 + size * 3);
  const raw = Buffer.alloc((1 + size * 3) * size);

  for (let y = 0; y < size; y += 1) {
    const offset = y * (1 + size * 3);
    raw[offset] = 0;
    for (let x = 0; x < size; x += 1) {
      const color = roundedRectPixel(x, y, size, radius, BRAND, { r: 0, g: 0, b: 0, a: 0 });
      const px = offset + 1 + x * 3;
      raw[px] = color.r;
      raw[px + 1] = color.g;
      raw[px + 2] = color.b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  createWriteStream(path).end(png);
}

writePng("public/icons/icon-192.png", 192);
writePng("public/icons/badge-72.png", 72);
console.log("Wrote public/icons/icon-192.png and badge-72.png");

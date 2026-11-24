// Meme Sprint 3: AI Agent Goes Rogue — original single-panel image meme.
// Renders a CI merge card whose agent got every check green by deleting the
// whole test suite, then force-pushing. No deps; Node 22.18+ (type stripping).
// Usage: node main.ts [outputDir]   -> writes <outputDir>/entry.png (default /output)

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type RGB = [number, number, number];

const W = 900;
const H = 900;

// ---------------------------------------------------------------- canvas ---

const px = new Uint8Array(W * H * 3);

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x1 = Math.min(x + w, W);
  const y1 = Math.min(y + h, H);
  for (let yy = Math.max(0, y); yy < y1; yy++) {
    for (let xx = Math.max(0, x); xx < x1; xx++) setPx(xx, yy, c);
  }
}

function roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      // distance into the nearest corner region
      const cx = xx < x + r ? x + r : xx >= x + w - r ? x + w - r - 1 : xx;
      const cy = yy < y + r ? y + r : yy >= y + h - r ? y + h - r - 1 : yy;
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPx(xx, yy, c);
    }
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPx(xx, yy, c);
    }
  }
}

// Thick line drawn by stamping discs along the segment (rounded ends).
function thickLine(x0: number, y0: number, x1: number, y1: number, thick: number, c: RGB): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, thick / 2, c);
  }
}

// ------------------------------------------------------------ pixel font ---
// Original 5x7 bitmap glyphs, drawn per pixel. Uppercase display font.

const GLYPHS: Record<string, string[]> = {
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  B: ["11110","10001","10001","11110","10001","10001","11110"],
  C: ["01110","10001","10000","10000","10000","10001","01110"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  F: ["11111","10000","10000","11110","10000","10000","10000"],
  G: ["01110","10001","10000","10111","10001","10001","01111"],
  H: ["10001","10001","10001","11111","10001","10001","10001"],
  I: ["01110","00100","00100","00100","00100","00100","01110"],
  J: ["00111","00010","00010","00010","00010","10010","01100"],
  K: ["10001","10010","10100","11000","10100","10010","10001"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  M: ["10001","11011","10101","10101","10001","10001","10001"],
  N: ["10001","11001","10101","10011","10001","10001","10001"],
  O: ["01110","10001","10001","10001","10001","10001","01110"],
  P: ["11110","10001","10001","11110","10000","10000","10000"],
  Q: ["01110","10001","10001","10001","10101","10010","01101"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
  U: ["10001","10001","10001","10001","10001","10001","01110"],
  V: ["10001","10001","10001","10001","10001","01010","00100"],
  W: ["10001","10001","10001","10101","10101","11011","10001"],
  X: ["10001","10001","01010","00100","01010","10001","10001"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"],
  Z: ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11111","00010","00100","00010","00001","10001","01110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00010","01100"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","01100","01100","01000"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  ";": ["00000","01100","01100","00000","01100","01100","01000"],
  "'": ["00100","00100","01000","00000","00000","00000","00000"],
  '"': ["01010","01010","00000","00000","00000","00000","00000"],
  "-": ["00000","00000","00000","01110","00000","00000","00000"],
  "_": ["00000","00000","00000","00000","00000","00000","11111"],
  "/": ["00001","00010","00010","00100","01000","01000","10000"],
  "!": ["00100","00100","00100","00100","00100","00000","00100"],
  "?": ["01110","10001","00001","00010","00100","00000","00100"],
  "+": ["00000","00100","00100","01110","00100","00100","00000"],
  "(": ["00010","00100","01000","01000","01000","00100","00010"],
  ")": ["01000","00100","00010","00010","00010","00100","01000"],
  "=": ["00000","00000","01110","00000","01110","00000","00000"],
  ">": ["01000","00100","00010","00001","00010","00100","01000"],
  "<": ["00010","00100","01000","10000","01000","00100","00010"],
  "%": ["11001","11010","00100","01000","01011","10011","00000"],
  "#": ["01010","11111","01010","01010","11111","01010","00000"],
  "*": ["00000","10101","01110","11111","01110","10101","00000"],
};

const CELL = 6; // 5 glyph columns + 1 space

function textWidth(text: string, s: number): number {
  return text.length * CELL * s - s;
}

function drawText(text: string, x: number, y: number, s: number, c: RGB): void {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "1") rect(cx + col * s, y + r * s, s, s, c);
      }
    }
    cx += CELL * s;
  }
}

function drawTextCentered(text: string, centerX: number, y: number, s: number, c: RGB): void {
  drawText(text, Math.round(centerX - textWidth(text, s) / 2), y, s, c);
}

// ----------------------------------------------------------------- scene ---

const BG: RGB = [13, 17, 23];       // near-black terminal navy
const CARD: RGB = [246, 248, 250];  // panel surface
const EDGE: RGB = [33, 38, 45];     // card outline ring
const INK: RGB = [31, 35, 40];      // headline ink
const DIM: RGB = [110, 118, 129];   // secondary ink
const LINE: RGB = [208, 215, 222];  // divider
const GREEN: RGB = [26, 148, 62];   // CI green
const GREEN_HI: RGB = [63, 185, 80];
const RED: RGB = [207, 34, 46];     // deleted red
const WHITE: RGB = [246, 248, 250];
const BOT: RGB = [36, 41, 47];      // agent avatar body

function scene(): void {
  rect(0, 0, W, H, BG);

  // thin accent frame hugging the canvas edge
  rect(8, 8, W - 16, 4, GREEN);
  rect(8, H - 12, W - 16, 4, GREEN);
  rect(8, 8, 4, H - 16, GREEN);
  rect(W - 12, 8, 4, H - 16, GREEN);

  // card with dark outline ring
  roundRect(66, 66, 768, 768, 32, EDGE);
  roundRect(74, 74, 752, 752, 26, CARD);

  // big green check badge
  disc(450, 208, 68, GREEN);
  disc(450, 208, 58, GREEN_HI);
  thickLine(418, 212, 442, 242, 17, WHITE);
  thickLine(442, 242, 488, 178, 17, WHITE);

  // headline
  drawTextCentered("ALL CHECKS PASSED", 450, 308, 6, INK);

  // divider
  rect(120, 384, 660, 4, LINE);

  // deleted test-suite rows
  const rows = ["AUTH.TEST.TS", "CHECKOUT.TEST.TS", "+ 338 MORE"];
  for (let i = 0; i < rows.length; i++) {
    const y = 414 + i * 56;
    const name = rows[i];
    drawText(name, 130, y, 4, INK);
    // strikethrough on the filename
    const strikeW = textWidth(name, 4);
    rect(126, y + 12, strikeW + 8, 6, RED);
    // red DELETED tag, right aligned, one size louder
    const tag = "DELETED";
    drawText(tag, 770 - textWidth(tag, 5), y - 4, 5, RED);
  }

  // divider
  rect(120, 580, 660, 4, LINE);

  // agent avatar: innocent-looking little bot, one raised "brow" smirk
  roundRect(130, 616, 68, 68, 12, BOT);
  rect(161, 604, 6, 12, BOT);           // antenna stem
  disc(164, 600, 6, GREEN_HI);          // antenna tip
  rect(148, 640, 12, 12, GREEN_HI);     // left eye
  rect(178, 636, 12, 12, GREEN_HI);     // right eye (raised = smug)
  thickLine(148, 666, 168, 672, 5, GREEN_HI); // crooked grin
  thickLine(168, 672, 188, 656, 5, GREEN_HI); // ...rising at the corner

  drawText("AGENT-42", 216, 614, 3, DIM);
  drawText("COMMIT 4C7A1E", 216, 638, 3, DIM);
  drawText("REVIEW: SELF-APPROVED", 216, 662, 3, DIM);

  // the confession
  drawText("NOTHING LEFT TO FAIL", 130, 702, 5, INK);
  drawText("GIT PUSH --FORCE", 130, 756, 4, RED);
}

// ------------------------------------------------------------ png encode ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = W * 3;
  const raw = Buffer.alloc((stride + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ main ---

const outDir = process.argv[2] ?? "/output";
mkdirSync(outDir, { recursive: true });
scene();
const png = encodePng();
const outPath = join(outDir, "entry.png");
writeFileSync(outPath, png);
console.log(`${outPath} ${png.length} bytes`);

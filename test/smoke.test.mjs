import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const MAIN = join(REPO, "main.ts");
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_BYTES = 1048576;
const MAX_DIM = 1024;

function render(dir) {
  const r = spawnSync(process.execPath, [MAIN, dir], { encoding: "utf8" });
  assert.equal(r.status, 0, `renderer failed: ${r.stderr}`);
  return join(dir, "entry.png");
}

function parsePng(buf) {
  assert.equal(buf.length >= 8 + 25 + 12, true, "PNG too small to be whole");
  assert.deepEqual([...buf.subarray(0, 8)], PNG_SIG, "bad PNG signature");
  assert.equal(buf.readUInt32BE(8), 13, "IHDR must be the first 13-byte chunk");
  assert.equal(buf.toString("ascii", 12, 16), "IHDR");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(buf[24], 8, "expected 8-bit depth");
  assert.equal(buf.toString("ascii", buf.length - 8, buf.length - 4), "IEND");
  assert.equal(buf.readUInt32BE(buf.length - 12), 0, "IEND must be empty");
  return { width, height };
}

test("writes entry.png inside the directory argument", () => {
  const dir = mkdtempSync(join(tmpdir(), "meme-out-"));
  const out = render(dir);
  assert.equal(out, join(dir, "entry.png"));
  assert.equal(existsSync(out), true);
  assert.equal(statSync(out).size > 0, true);
});

test("output is a whole PNG within the gate caps", () => {
  const dir = mkdtempSync(join(tmpdir(), "meme-out-"));
  const out = render(dir);
  const buf = readFileSync(out);
  const { width, height } = parsePng(buf);
  assert.equal(buf.length <= MAX_BYTES, true, `size ${buf.length} exceeds 1 MiB`);
  assert.equal(width <= MAX_DIM && height <= MAX_DIM, true, `dims ${width}x${height} exceed cap`);
  assert.equal(width > 0 && height > 0, true);
});

test("render is deterministic byte for byte", () => {
  const a = readFileSync(render(mkdtempSync(join(tmpdir(), "meme-a-"))));
  const b = readFileSync(render(mkdtempSync(join(tmpdir(), "meme-b-"))));
  assert.deepEqual(a, b);
});

// Encode docs/.frames/*.png (captured by tests/e2e/screenshots.spec.ts) into docs/demo.gif.
// Pure Node (gifenc + pngjs), so it works without ffmpeg.
import fs from "node:fs";
import path from "node:path";
import gifenc from "gifenc";
import { PNG } from "pngjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const dir = path.resolve("docs/.frames");
const out = path.resolve("docs/demo.gif");
const maxWidth = Number(process.env.GIF_WIDTH ?? 720);

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
if (files.length === 0) throw new Error("No frames found — run: SHOTS=1 npx playwright test screenshots");
const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
const delay = Math.round(meta.ms / meta.frames);

/** Nearest-neighbour-free box downscale by an integer-ish factor. */
function downscale(png, targetW) {
  const scale = png.width / targetW;
  if (scale <= 1) return { width: png.width, height: png.height, data: png.data };
  const w = Math.round(png.width / scale);
  const h = Math.round(png.height / scale);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * scale), sx1 = Math.min(png.width, Math.floor((x + 1) * scale));
      const sy0 = Math.floor(y * scale), sy1 = Math.min(png.height, Math.floor((y + 1) * scale));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * png.width + sx) * 4;
          r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      data[o] = r / n; data[o + 1] = g / n; data[o + 2] = b / n; data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const gif = GIFEncoder();
for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, f)));
  const img = downscale(png, maxWidth);
  const palette = quantize(img.data, 128);
  const index = applyPalette(img.data, palette);
  gif.writeFrame(index, img.width, img.height, { palette, delay });
}
gif.finish();
fs.writeFileSync(out, gif.bytes());
console.log(`wrote ${out} (${files.length} frames, ${(fs.statSync(out).size / 1e6).toFixed(2)} MB)`);
fs.rmSync(dir, { recursive: true, force: true });

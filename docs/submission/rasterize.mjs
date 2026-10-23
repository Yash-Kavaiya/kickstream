import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(dir, "../../apps/web/package.json"));
const { chromium } = require("@playwright/test");

const W = 2560;
const H = 1440;
const names = ["architecture", "sequence", "flow", "deployment", "agents"];

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error("not a png");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.toString("ascii", offset, offset + 4);
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`color type ${colorType}`);
  const raw = require("node:zlib").inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let index = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[index];
    index += 1;
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[index];
      index += 1;
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
      let next = value;
      if (filter === 1) next = (value + left) & 255;
      else if (filter === 2) next = (value + up) & 255;
      else if (filter === 3) next = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        const base = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        next = (value + base) & 255;
      } else if (filter !== 0) throw new Error(`filter ${filter}`);
      pixels[row + x] = next;
    }
  }
  return { width, height, channels, pixels };
}

function ink(decoded) {
  const { width, height, channels, pixels } = decoded;
  const background = [pixels[0], pixels[1], pixels[2]];
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      const distance =
        Math.abs(pixels[index] - background[0]) +
        Math.abs(pixels[index + 1] - background[1]) +
        Math.abs(pixels[index + 2] - background[2]);
      if (distance <= 36) continue;
      count += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    ratio: count / (width * height),
    widthCover: count ? (maxX - minX + 1) / width : 0,
    heightCover: count ? (maxY - minY + 1) / height : 0,
  };
}

function mae(left, right) {
  const samples = Math.min(left.pixels.length, right.pixels.length);
  const channels = Math.min(left.channels, right.channels, 3);
  let total = 0;
  let count = 0;
  const strideL = left.channels;
  const strideR = right.channels;
  const pixels = Math.floor(samples / Math.max(strideL, strideR));
  for (let i = 0; i < pixels; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      total += Math.abs(left.pixels[i * strideL + c] - right.pixels[i * strideR + c]);
      count += 1;
    }
  }
  return total / count;
}

async function shoot(page, name) {
  const htmlPath = join(dir, `${name}.html`);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
  await page.evaluate(async () => {
    const nodes = [...document.querySelectorAll("image")];
    await Promise.all(
      nodes.map(
        (node) =>
          new Promise((resolve) => {
            const href = node.getAttribute("href");
            if (!href) {
              resolve();
              return;
            }
            const probe = new Image();
            probe.onload = () => resolve();
            probe.onerror = () => resolve();
            probe.src = new URL(href, document.baseURI).href;
          }),
      ),
    );
  });
  const box = await page.locator("svg").boundingBox();
  if (!box || box.width !== W || box.height !== H) {
    throw new Error(`${name} surface ${box && box.width}x${box && box.height}`);
  }
  return page.screenshot({
    type: "png",
    clip: { x: 0, y: 0, width: W, height: H },
  });
}

function writeJpeg(pngPath, jpgPath) {
  const code = [
    "from PIL import Image",
    "import sys",
    "image = Image.open(sys.argv[1]).convert('RGB')",
    "image.save(sys.argv[2], format='JPEG', quality=95, subsampling=0, optimize=True)",
    "print(image.size)",
  ].join("\n");
  const result = spawnSync("python", ["-c", code, pngPath, jpgPath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "jpeg encode failed");
  }
}

async function openRaster(page, filePath) {
  await page.goto(pathToFileURL(filePath).href, { waitUntil: "load" });
  return page.evaluate(() => {
    const image = document.querySelector("img");
    if (!image) return { width: 0, height: 0 };
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
}

const check = process.argv.includes("--check");
const outFlag = process.argv.indexOf("--out");
const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : null;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const report = [];
try {
  for (const name of names) {
    const fresh = await shoot(page, name);
    const pngPath = join(dir, `${name}.png`);
    const jpgPath = join(dir, `${name}.jpg`);
    if (!check) {
      writeFileSync(pngPath, fresh);
      writeJpeg(pngPath, jpgPath);
    }
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, `${name}.png`), fresh);
    }
    const committed = decodePng(readFileSync(pngPath));
    const again = decodePng(fresh);
    const pngMae = mae(committed, again);
    if (committed.width !== W || committed.height !== H) {
      throw new Error(`${name} png is ${committed.width}x${committed.height}`);
    }
    const coverage = ink(again);
    report.push(`${name} png ${committed.width}x${committed.height} ${readFileSync(pngPath).length} bytes mae ${pngMae.toFixed(4)} pageErrors ${errors.length} ink ${coverage.ratio.toFixed(4)} cover ${coverage.widthCover.toFixed(4)}x${coverage.heightCover.toFixed(4)}`);
    if (committed.width < 1920 || committed.height < 1080) {
      throw new Error(`${name} png is below 1920x1080`);
    }
    if (pngMae >= 2) throw new Error(`${name} png mae ${pngMae}`);
    if (coverage.ratio < 0.03 || coverage.widthCover < 0.9 || coverage.heightCover < 0.9) {
      throw new Error(`${name} ink ${coverage.ratio} ${coverage.widthCover} ${coverage.heightCover}`);
    }
    if (errors.length) throw new Error(`${name} page errors ${errors.join(" | ")}`);
    if (check) {
      const openedPng = await openRaster(page, pngPath);
      const openedJpg = await openRaster(page, jpgPath);
      if (openedPng.width !== committed.width || openedPng.height !== committed.height) {
        throw new Error(`${name} opened png ${openedPng.width}x${openedPng.height}`);
      }
      if (openedJpg.width !== committed.width || openedJpg.height !== committed.height) {
        throw new Error(`${name} opened jpg ${openedJpg.width}x${openedJpg.height}`);
      }
      const jpegMae = await page.evaluate(async ({ pngB64, jpgB64 }) => {
        const load = (src) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("image decode failed"));
            image.src = src;
          });
        const [png, jpg] = await Promise.all([
          load(`data:image/png;base64,${pngB64}`),
          load(`data:image/jpeg;base64,${jpgB64}`),
        ]);
        const canvas = document.createElement("canvas");
        canvas.width = png.naturalWidth;
        canvas.height = png.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(png, 0, 0);
        const a = context.getImageData(0, 0, canvas.width, canvas.height).data;
        context.drawImage(jpg, 0, 0);
        const b = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let total = 0;
        const pixels = canvas.width * canvas.height;
        for (let i = 0; i < pixels; i += 1) {
          total += Math.abs(a[i * 4] - b[i * 4]);
          total += Math.abs(a[i * 4 + 1] - b[i * 4 + 1]);
          total += Math.abs(a[i * 4 + 2] - b[i * 4 + 2]);
        }
        return { mae: total / (pixels * 3), width: png.naturalWidth, height: png.naturalHeight, jpgWidth: jpg.naturalWidth, jpgHeight: jpg.naturalHeight };
      }, {
        pngB64: readFileSync(pngPath).toString("base64"),
        jpgB64: readFileSync(jpgPath).toString("base64"),
      });
      report.push(`${name} jpeg ${jpegMae.jpgWidth}x${jpegMae.jpgHeight} mae ${jpegMae.mae.toFixed(4)}`);
      if (jpegMae.jpgWidth !== committed.width || jpegMae.jpgHeight !== committed.height) {
        throw new Error(`${name} jpeg size mismatch`);
      }
      if (jpegMae.mae >= 15) throw new Error(`${name} jpeg mae ${jpegMae.mae}`);
    }
    errors.length = 0;
  }
} finally {
  await browser.close();
}
console.log(report.join("\n"));

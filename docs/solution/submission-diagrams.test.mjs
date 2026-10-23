import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "submission");
const names = ["architecture", "sequence", "flow", "deployment", "agents"];

const labels = {
  architecture: [
    "Vite",
    "React",
    "Fluent UI",
    "FastAPI",
    "Ingest",
    "Interpret",
    "Explain",
    "Render",
    "Gateway",
    "Chromium",
    "ffmpeg",
    "YouTube",
    "Facebook",
    "Twitch",
    "Container Apps",
    "one replica",
    "Container Registry",
    "Azure Files",
    "share data",
    "Cosmos DB",
    "kickstream",
    "match_log",
    "Communication Services",
    "Speech",
    "Log Analytics",
    "Entra ID",
    "Microsoft Foundry",
    "existing project",
    "Terraform does not create",
  ],
  sequence: ["Match source", "Ingest", "Interpret", "Explain", "Render / overlay", "Gateway", "Browser", "SSE/WebSocket"],
  flow: [
    "Ingest",
    "Interpret",
    "Explain",
    "Render",
    "Personalize / Gateway",
    "publish onto this same stream",
    "Event Interpreter",
    "Tactical Analyst",
    "Player Tracking Agent",
    "Prediction Agent",
    "Explainability Agent",
    "Visualization Agent",
    "Highlights Agent",
    "ffmpeg",
    "YouTube",
    "Facebook",
    "Twitch",
  ],
  deployment: [
    "Process memory",
    ".data/",
    "Resource group",
    "Log Analytics",
    "Container Registry",
    "Storage account",
    "Azure Files",
    "Share data",
    "Communication Services",
    "Speech",
    "Cosmos DB",
    "kickstream",
    "match_log",
    "Container Apps environment",
    "Container App",
    "One replica",
    "Entra app registration",
    "Microsoft Entra ID",
    "Terraform does not create Foundry",
  ],
  agents: [
    "Match Reading",
    "Forecast",
    "Story",
    "Event Interpreter",
    "Tactical Analyst",
    "Player Tracking Agent",
    "Prediction Agent",
    "Explainability Agent",
    "Visualization Agent",
    "Highlights Agent",
    "Commentator",
    "Recap Writer",
    "Localizer",
    "Template fallback",
    "No model is set",
    "Scripted",
  ],
};

const sequenceOrder = [
  "Match events into Ingest",
  "Normalized events to Interpret",
  "Stats to the match agents and Foundry narration",
  "Narration and findings to Render",
  "Overlay picture to the Gateway",
  "SSE and WebSocket to the browser",
];

const architectureIcons = [
  "icons/container-apps.svg",
  "icons/container-registry.svg",
  "icons/azure-files.svg",
  "icons/cosmos-db.svg",
  "icons/communication-services.svg",
  "icons/speech.svg",
  "icons/log-analytics.svg",
  "icons/entra-id.svg",
  "icons/foundry-project.svg",
];

const deploymentIcons = [
  "icons/resource-groups.svg",
  "icons/log-analytics.svg",
  "icons/container-registry.svg",
  "icons/storage-account.svg",
  "icons/azure-files.svg",
  "icons/communication-services.svg",
  "icons/speech.svg",
  "icons/cosmos-db.svg",
  "icons/container-apps-environments.svg",
  "icons/container-apps.svg",
  "icons/app-registrations.svg",
  "icons/entra-id.svg",
  "icons/foundry-project.svg",
];

function read(name) {
  return readFileSync(join(root, name));
}

function textOf(html) {
  return [...html.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]).join(" ");
}

function iconHrefs(html) {
  return [...html.matchAll(/href="(icons\/[a-z0-9-]+\.svg)"/g)].map((match) => match[1]);
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonal = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
  if (upDistance <= diagonal) return up;
  return upLeft;
}

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(buffer.subarray(0, 8), signature);
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
    offset += length + 4;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  assert.equal(bitDepth, 8);
  const channels = { 2: 3, 6: 4 }[colorType];
  assert.ok(channels, `unexpected color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
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
      else if (filter === 4) next = (value + paeth(left, up, upLeft)) & 255;
      else assert.equal(filter, 0);
      pixels[row + x] = next;
    }
  }
  return { width, height, channels, pixels };
}

function jpegSize(buffer) {
  assert.equal(buffer[0], 0xff);
  assert.equal(buffer[1], 0xd8);
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = buffer.readUInt16BE(offset);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error("jpeg has no SOF marker");
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
    widthCover: (maxX - minX + 1) / width,
    heightCover: (maxY - minY + 1) / height,
  };
}

function sampleDistance(left, right) {
  const pixels = left.width * left.height;
  let total = 0;
  let count = 0;
  for (let i = 0; i < pixels; i += 8) {
    const a = i * left.channels;
    const b = i * right.channels;
    total += Math.abs(left.pixels[a] - right.pixels[b]);
    total += Math.abs(left.pixels[a + 1] - right.pixels[b + 1]);
    total += Math.abs(left.pixels[a + 2] - right.pixels[b + 2]);
    count += 3;
  }
  return total / count;
}

const html = Object.fromEntries(names.map((name) => [name, read(`${name}.html`).toString("utf8")]));
const png = Object.fromEntries(names.map((name) => [name, decodePng(read(`${name}.png`))]));

test("each diagram is a paired PNG and JPEG at the authored size", () => {
  for (const name of names) {
    const image = png[name];
    const jpeg = jpegSize(read(`${name}.jpg`));
    assert.ok(image.width >= 1920 && image.height >= 1080, `${name} png ${image.width}x${image.height}`);
    assert.equal(jpeg.width, image.width);
    assert.equal(jpeg.height, image.height);
    assert.ok(statSync(join(root, `${name}.png`)).size > 20_000);
    assert.ok(statSync(join(root, `${name}.jpg`)).size > 20_000);
    const coverage = ink(image);
    assert.ok(coverage.ratio >= 0.03, `${name} ink ratio ${coverage.ratio}`);
    assert.ok(coverage.widthCover >= 0.9, `${name} width cover ${coverage.widthCover}`);
    assert.ok(coverage.heightCover >= 0.9, `${name} height cover ${coverage.heightCover}`);
  }
});

test("the five diagrams are different pictures with their own labels", () => {
  const seen = new Set();
  for (const name of names) {
    const text = textOf(html[name]);
    assert.ok(text.length > 400, name);
    for (const phrase of labels[name]) assert.ok(text.includes(phrase), `${name} missing ${phrase}`);
    const digest = createHash("sha256").update(text).digest("hex");
    assert.equal(seen.has(digest), false);
    seen.add(digest);
    for (const banned of ["Event Hubs", "Web PubSub", "Media Services"]) {
      assert.equal(html[name].includes(banned), false);
    }
  }
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const distance = sampleDistance(png[names[i]], png[names[j]]);
      assert.ok(distance > 10, `${names[i]} vs ${names[j]} distance ${distance}`);
    }
  }
  assert.ok(textOf(html.architecture).includes(">X<") === false);
  const architectureText = [...html.architecture.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
  assert.ok(architectureText.includes("X"));
  const flowText = [...html.flow.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
  assert.ok(flowText.includes("X"));
});

test("the sequence diagram states the causal order in arrow labels", () => {
  const text = textOf(html.sequence);
  let at = -1;
  for (const phrase of sequenceOrder) {
    const found = text.indexOf(phrase, at + 1);
    assert.ok(found > at, phrase);
    at = found;
  }
});

test("architecture and deployment use distinct on-disk Azure icons", () => {
  const checks = [
    ["architecture", architectureIcons],
    ["deployment", deploymentIcons],
  ];
  for (const [name, required] of checks) {
    const used = new Set(iconHrefs(html[name]));
    for (const href of required) assert.ok(used.has(href), `${name} missing ${href}`);
    assert.ok(used.size >= 8, `${name} only uses ${used.size} icons`);
    const hashes = new Set();
    for (const href of used) {
      const file = read(href);
      assert.ok(file.length > 800, href);
      assert.ok(file.includes(Buffer.from("<svg")));
      assert.ok(file.includes(Buffer.from("<path")));
      hashes.add(createHash("sha256").update(file).digest("hex"));
    }
    assert.equal(hashes.size, used.size);
  }
});

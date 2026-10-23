import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const W = 2560;
const H = 1440;
const FONT = "Segoe UI, Segoe UI Variable, sans-serif";

const icon = {
  containerApps: "icons/container-apps.svg",
  containerEnv: "icons/container-apps-environments.svg",
  registry: "icons/container-registry.svg",
  files: "icons/azure-files.svg",
  storage: "icons/storage-account.svg",
  cosmos: "icons/cosmos-db.svg",
  acs: "icons/communication-services.svg",
  speech: "icons/speech.svg",
  logs: "icons/log-analytics.svg",
  rg: "icons/resource-groups.svg",
  appReg: "icons/app-registrations.svg",
  entra: "icons/entra-id.svg",
  foundry: "icons/foundry-project.svg",
  identity: "icons/managed-identities.svg",
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function n(value) {
  return Math.round(value);
}

function push(parts, chunk) {
  parts.push(chunk);
}

function rect(parts, x, y, w, h, options = {}) {
  const rx = options.rx ?? 0;
  const fill = options.fill ?? "none";
  const stroke = options.stroke ?? "none";
  const sw = options.sw ?? (stroke === "none" ? 0 : 1.5);
  const dash = options.dash ? ` stroke-dasharray="${options.dash}"` : "";
  push(
    parts,
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}/>`,
  );
}

function text(parts, x, y, value, options = {}) {
  const size = options.size ?? 18;
  const weight = options.weight ?? 400;
  const fill = options.fill ?? "#242424";
  const anchor = options.anchor ?? "start";
  push(
    parts,
    `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(value)}</text>`,
  );
}

function lines(parts, x, y, rows, options = {}) {
  const lh = options.lh ?? Math.round((options.size ?? 18) * 1.35);
  rows.forEach((row, index) => text(parts, x, y + index * lh, row, options));
  return y + rows.length * lh;
}

function iconImage(parts, href, x, y, size = 36) {
  push(
    parts,
    `<image href="${href}" x="${n(x)}" y="${n(y)}" width="${size}" height="${size}"></image>`,
  );
}

function arrow(parts, x1, y1, x2, y2, marker = "arr") {
  push(
    parts,
    `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${marker === "arrw" ? "#FFFFFF" : "#0078D4"}" stroke-width="2.5" marker-end="url(#${marker})"/>`,
  );
}

function chrome(parts, title, subtitle) {
  rect(parts, 0, 0, W, H, { fill: "#F4F7FB" });
  rect(parts, 0, 0, W, 78, { fill: "#0B3A67" });
  rect(parts, 24, 18, 22, 22, { rx: 4, fill: "#0078D4" });
  rect(parts, 24, 46, 22, 8, { rx: 2, fill: "#50E6FF" });
  text(parts, 56, 38, "Kickstream", { size: 22, weight: 700, fill: "#FFFFFF" });
  text(parts, 56, 62, "Football live broadcast", { size: 16, fill: "#C5DDF5" });
  text(parts, W - 28, 38, title, { size: 30, weight: 700, fill: "#FFFFFF", anchor: "end" });
  text(parts, W - 28, 62, subtitle, { size: 16, fill: "#D6E6F5", anchor: "end" });
}

function footer(parts, left) {
  rect(parts, 0, 1406, W, 34, { fill: "#0B3A67" });
  text(parts, 24, 1428, left, { size: 16, fill: "#E5F0FA" });
  text(parts, W - 28, 1428, "Kickstream submission", {
    size: 16,
    fill: "#E5F0FA",
    anchor: "end",
  });
}

function card(parts, x, y, w, h, options = {}) {
  rect(parts, x, y, w, h, {
    rx: options.rx ?? 12,
    fill: options.fill ?? "#FFFFFF",
    stroke: options.stroke ?? "#D0D7E2",
    sw: options.sw ?? 1.5,
    dash: options.dash,
  });
}

function wrap(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  html, body { margin: 0; padding: 0; background: #F4F7FB; width: ${W}px; height: ${H}px; overflow: hidden; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0 0 L10 5 L0 10 Z" fill="#0078D4"/>
    </marker>
    <marker id="arrw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0 0 L10 5 L0 10 Z" fill="#FFFFFF"/>
    </marker>
    <marker id="arrg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
      <path d="M0 0 L10 5 L0 10 Z" fill="#0E7A3D"/>
    </marker>
  </defs>
  ${body.join("\n  ")}
</svg>
</body>
</html>
`;
}

function architecture() {
  const p = [];
  chrome(p, "Technical architecture", "What this repository ships today");

  const sources = [
    ["Simulator", "Synthetic match. Ninety minutes in about three minutes."],
    ["Detector file", "JSON Lines events. Set KICKSTREAM_DETECTOR_FILE."],
    ["StatsBomb", "Past-match replay. Non-commercial, with attribution."],
    ["API-Football", "Live fixtures. Optional key. Off on a deploy."],
    ["OpenLigaDB", "Live scores for listed leagues. Off on Azure."],
  ];
  text(p, 24, 108, "Match source", { size: 16, weight: 700, fill: "#0B3A67" });
  sources.forEach((source, index) => {
    const x = 24 + index * 506;
    card(p, x, 118, 492, 86);
    text(p, x + 16, 148, source[0], { size: 20, weight: 700 });
    text(p, x + 16, 176, source[1], { size: 16, fill: "#3D3D3D" });
  });
  arrow(p, 670, 204, 670, 236);
  text(p, 684, 226, "into Ingest", { size: 16, weight: 650, fill: "#0B3A67" });

  card(p, 24, 248, 500, 360);
  text(p, 40, 278, "Vite, React, and Fluent UI", { size: 22, weight: 700 });
  lines(p, 40, 310, [
    "The web app in apps/web. Fluent UI v9.",
    "On Azure the pipeline serves the built app.",
    "Locally Vite listens on port 5173.",
  ], { size: 18, fill: "#3D3D3D", lh: 26 });
  const pages = ["Home", "Studio", "Match", "Live", "Dashboard", "Guest"];
  pages.forEach((label, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 40 + col * 156;
    const y = 400 + row * 44;
    rect(p, x, y, 144, 32, { rx: 16, fill: "#E8F3FC" });
    text(p, x + 72, y + 22, label, { size: 16, weight: 650, fill: "#0B3A67", anchor: "middle" });
  });
  text(p, 40, 520, "Studio output is /studio?output at 1920 by 1080.", {
    size: 16,
    fill: "#3D3D3D",
  });
  text(p, 40, 548, "Auto live output is /live?output, captured the same way.", {
    size: 16,
    fill: "#3D3D3D",
  });
  text(p, 40, 580, "Python FastAPI on port 8000 is the API the app calls.", {
    size: 16,
    fill: "#3D3D3D",
  });

  card(p, 24, 624, 500, 168);
  iconImage(p, icon.entra, 40, 644, 40);
  text(p, 92, 670, "Microsoft Entra ID", { size: 22, weight: 700 });
  lines(p, 40, 712, [
    "Signs the studio in. Audience AzureADMyOrg.",
    "Guests stay open. /live and /match can be public.",
  ], { size: 18, fill: "#3D3D3D", lh: 26 });

  card(p, 24, 808, 500, 344);
  text(p, 40, 842, "Browser over SSE and WebSocket", { size: 22, weight: 700 });
  lines(p, 40, 880, [
    "The gateway fans the match out.",
    "Personalize filters mode, language, and favourite.",
    "A late joiner gets the newest pitch scene",
    "and the newest player report.",
    "WebSockets are accepted only from the host",
    "the pipeline was reached at.",
  ], { size: 18, fill: "#3D3D3D", lh: 28 });

  card(p, 540, 248, 1188, 904, { fill: "#E8F3FC", stroke: "#0078D4", sw: 2 });
  iconImage(p, icon.containerEnv, 560, 264, 36);
  text(p, 608, 288, "Azure Container Apps environment", { size: 22, weight: 700, fill: "#0B3A67" });
  text(p, 608, 314, "One environment. Logs go to Log Analytics.", { size: 16, fill: "#0F548C" });

  card(p, 560, 336, 1148, 796, { fill: "#FFFFFF", stroke: "#0078D4", sw: 2 });
  iconImage(p, icon.containerApps, 580, 352, 40);
  text(p, 632, 376, "Azure Container Apps · one replica", { size: 22, weight: 700 });
  text(p, 632, 404, "Python 3.13 · FastAPI · port 8000 · 2 vCPU · 4 GiB · min and max replicas 1", {
    size: 16,
    fill: "#3D3D3D",
  });

  const stages = [
    ["1", "Ingest", "Events arrive", "Then Interpret"],
    ["2", "Interpret", "Stats, pressure", "Then Explain"],
    ["3", "Explain", "Fan and Analyst", "Then Render"],
    ["4", "Render", "Overlay, scenes", "Then Gateway"],
    ["5", "Gateway", "Personalize", "SSE, WebSocket"],
  ];
  stages.forEach((stage, index) => {
    const x = 580 + index * 222;
    card(p, x, 428, 200, 132, { fill: "#F4F8FC", stroke: "#0078D4" });
    rect(p, x + 12, 442, 28, 28, { rx: 14, fill: "#0078D4" });
    text(p, x + 26, 462, stage[0], { size: 16, weight: 700, fill: "#FFFFFF", anchor: "middle" });
    text(p, x + 48, 462, stage[1], { size: 20, weight: 700 });
    text(p, x + 16, 502, stage[2], { size: 16, fill: "#3D3D3D" });
    text(p, x + 16, 528, stage[3], { size: 16, fill: "#0F548C" });
    if (index < stages.length - 1) arrow(p, x + 200, 494, x + 216, 494);
  });

  card(p, 580, 576, 1108, 150, { fill: "#F8F2FC", stroke: "#5C2D91" });
  text(p, 596, 606, "Seven match agents publish onto this stream", { size: 20, weight: 700, fill: "#5C2D91" });
  lines(p, 596, 638, [
    "Match Reading: Event Interpreter, Tactical Analyst, Player Tracking Agent.",
    "Forecast: Prediction Agent, Explainability Agent. Story: Visualization Agent, Highlights Agent.",
  ], { size: 16, fill: "#3D3D3D", lh: 24 });
  text(p, 596, 700, "Findings join the same stream the gateway sends to the browser.", {
    size: 16,
    fill: "#3D3D3D",
  });

  card(p, 580, 742, 534, 250);
  text(p, 596, 774, "Hidden Chromium", { size: 22, weight: 700 });
  lines(p, 596, 810, [
    "Opens the studio output.",
    "Address /studio?output.",
    "Edge is used when it is present.",
    "Auto live uses /live?output.",
  ], { size: 18, fill: "#3D3D3D", lh: 26 });
  card(p, 1134, 742, 554, 250);
  text(p, 1150, 774, "ffmpeg", { size: 22, weight: 700 });
  lines(p, 1150, 810, [
    "Encodes that picture once.",
    "Copies the same stream out.",
    "One encode. Four destinations.",
    "Sound is the guests' call.",
  ], { size: 18, fill: "#3D3D3D", lh: 26 });
  arrow(p, 1114, 860, 1130, 860);
  text(p, 596, 968, "The hidden browser has no speakers, so only the Azure voice is carried.", {
    size: 16,
    fill: "#3D3D3D",
  });

  const services = [
    [icon.registry, "Container Registry", "Image kickstream, tag set by the deploy script. The app pulls it to start."],
    [icon.files, "Azure Files", "Files share data, mounted at /data. Broadcasts, studio, uploads, keys, and reels."],
    [icon.cosmos, "Cosmos DB", "Database kickstream. Container match_log. Partition /match_id. TTL 90 days."],
    [icon.acs, "Communication Services", "Cameras and voices. The host, guests, and the program view join rooms here."],
    [icon.speech, "Speech", "Auto live's commentator. Kind SpeechServices. Default SKU S0."],
    [icon.logs, "Log Analytics", "Workspace for the Container Apps environment. Retention 30 days."],
    [icon.identity, "Managed identity", "System-assigned. Cosmos data role, and Azure AI User on Foundry when set."],
    [icon.foundry, "Microsoft Foundry", "An existing project the app signs into. Terraform does not create it."],
  ];
  services.forEach((service, index) => {
    const y = 248 + index * 113;
    const dashed = service[1] === "Microsoft Foundry";
    card(p, 1744, y, 792, 104, {
      fill: dashed ? "#FBF7FE" : "#FFFFFF",
      stroke: dashed ? "#5C2D91" : "#D0D7E2",
      dash: dashed ? "7 5" : undefined,
      sw: dashed ? 2 : 1.5,
    });
    iconImage(p, service[0], 1760, y + 16, 36);
    text(p, 1808, y + 38, service[1], { size: 20, weight: 700, fill: dashed ? "#5C2D91" : "#242424" });
    text(p, 1808, y + 70, service[2], { size: 16, fill: "#3D3D3D" });
  });

  rect(p, 24, 1168, 2512, 224, { rx: 12, fill: "#0B2540" });
  text(p, 44, 1202, "ffmpeg copies one encode to four destinations", {
    size: 22,
    weight: 700,
    fill: "#FFFFFF",
  });
  text(p, 44, 1230, "The hidden Chromium picture is encoded once. Each platform receives a copy of that stream.", {
    size: 16,
    fill: "#D6E4F0",
  });
  const destinations = [
    ["YouTube", "#C4302B"],
    ["X", "#111111"],
    ["Facebook", "#1877F2"],
    ["Twitch", "#9146FF"],
  ];
  destinations.forEach((destination, index) => {
    const x = 44 + index * 620;
    rect(p, x, 1252, 596, 112, { rx: 12, fill: "#12304D" });
    rect(p, x, 1252, 12, 112, { rx: 4, fill: destination[1] });
    text(p, x + 36, 1316, destination[0], { size: 32, weight: 700, fill: "#FFFFFF" });
  });

  footer(p, "One Container App replica. Foundry is an existing project. Terraform does not create it.");
  return p;
}

function sequence() {
  const p = [];
  chrome(p, "Sequence of a key match moment", "Top to bottom, one causal chain");

  const actors = [
    ["Match source", "events", "#8A6116", "#FFF8E6"],
    ["Ingest", "stage", "#0B3A67", "#E8F3FC"],
    ["Interpret", "analytics", "#0B3A67", "#E8F3FC"],
    ["Explain", "agents, Foundry", "#5C2D91", "#F8F2FC"],
    ["Render / overlay", "picture", "#0B3A67", "#E8F3FC"],
    ["Gateway", "personalize", "#0B3A67", "#E8F3FC"],
    ["Browser", "SSE/WebSocket", "#0E7A3D", "#E7F5EC"],
  ];
  const xs = [150, 530, 910, 1290, 1670, 2050, 2430];
  actors.forEach((actor, index) => {
    const x = xs[index];
    rect(p, x - 96, 96, 192, 78, { rx: 10, fill: actor[3], stroke: actor[2], sw: 2 });
    text(p, x, 128, actor[0], { size: 18, weight: 700, fill: actor[2], anchor: "middle" });
    text(p, x, 154, actor[1], { size: 16, fill: "#3D3D3D", anchor: "middle" });
    push(
      p,
      `<line x1="${x}" y1="174" x2="${x}" y2="1188" stroke="#8AA0B8" stroke-width="2" stroke-dasharray="5 6"/>`,
    );
  });

  const messages = [
    [0, 1, ["Match events into Ingest"], "Simulator, detector file, or live"],
    [1, 2, ["Normalized events to Interpret"], "Sequence numbers assigned here"],
    [2, 3, ["Stats to the match agents", "and Foundry narration"], "Template if no model is set"],
    [3, 4, ["Narration and findings to Render"], "Lines, overlay facts, highlights"],
    [4, 5, ["Overlay picture to the Gateway"], "Score, banners, pitch, widgets"],
    [5, 6, ["SSE and WebSocket to the browser"], "Mode, language, and favourite"],
  ];
  messages.forEach((message, index) => {
    const y = 280 + index * 150;
    const x1 = xs[message[0]];
    const x2 = xs[message[1]];
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    rect(p, x1 - 8, y - 36, 16, 88, { fill: "#0078D4" });
    if (index < messages.length - 1) rect(p, x2 - 8, y - 10, 16, 70, { fill: "#0078D4" });
    arrow(p, x1, y, x2 - 12, y);
    const labelW = 300;
    const labelH = message[2].length === 2 ? 52 : 30;
    const lx = (left + right) / 2 - labelW / 2;
    rect(p, lx, y - labelH - 10, labelW, labelH, { rx: 6, fill: "#FFFFFF", stroke: "#D0D7E2" });
    message[2].forEach((line, lineIndex) => {
      text(p, (left + right) / 2, y - labelH + 12 + lineIndex * 22, line, {
        size: 16,
        weight: 700,
        fill: "#0B3A67",
        anchor: "middle",
      });
    });
    text(p, (left + right) / 2, y + 28, message[3], {
      size: 16,
      fill: "#3D3D3D",
      anchor: "middle",
    });
    rect(p, 24, y - 16, 36, 32, { rx: 16, fill: "#0078D4" });
    text(p, 42, y + 6, String(index + 1), { size: 16, weight: 700, fill: "#FFFFFF", anchor: "middle" });
  });

  card(p, 24, 1210, 2512, 180);
  text(p, 44, 1246, "What this chain is", { size: 22, weight: 700 });
  lines(p, 44, 1282, [
    "A key moment moves from the match source to Ingest, then Interpret, then the match agents and Foundry narration (Explain),",
    "then Render and the overlay, then the Gateway, then the browser over SSE and WebSocket.",
    "Narration is written once per mode and language. With no model set, that item is a template and is marked Scripted.",
    "A late joiner is replayed the newest pitch scene and the newest player report, not every earlier pitch scene.",
  ], { size: 18, fill: "#3D3D3D", lh: 28 });

  footer(p, "One process. The browser reads the gateway. The encode is not a second match pipeline.");
  return p;
}

function flow() {
  const p = [];
  chrome(p, "Operational flow", "Stages, agents, and one encode");

  const stages = [
    ["Ingest", "Match source enters here.", "Simulator, detector file,", "StatsBomb, API-Football,", "or OpenLigaDB."],
    ["Interpret", "Analytics on the events.", "Score, pressure, tempo,", "field tilt, and expected", "goals."],
    ["Explain", "Narration is written.", "Fan and Analyst wording.", "Foundry when a model", "is set, else a template."],
    ["Render", "The picture is composed.", "Overlay graphics, banners,", "pitch, and the scene", "widgets."],
    ["Personalize / Gateway", "The browser's view.", "Mode, language, and", "favourite. SSE and", "WebSocket."],
  ];
  stages.forEach((stage, index) => {
    const x = 24 + index * 508;
    card(p, x, 100, 476, 236, { fill: index === 4 ? "#E7F5EC" : "#FFFFFF", stroke: index === 4 ? "#0E7A3D" : "#0078D4", sw: 2 });
    rect(p, x + 16, 116, 36, 36, { rx: 18, fill: "#0078D4" });
    text(p, x + 34, 140, String(index + 1), { size: 18, weight: 700, fill: "#FFFFFF", anchor: "middle" });
    text(p, x + 64, 140, stage[0], { size: 22, weight: 700 });
    lines(p, x + 20, 180, stage.slice(1), { size: 18, fill: "#3D3D3D", lh: 26 });
    if (index < stages.length - 1) arrow(p, x + 476, 210, x + 502, 210);
  });

  rect(p, 24, 356, 2512, 64, { rx: 10, fill: "#5C2D91" });
  text(p, 1272, 396, "Seven match agents publish onto this same stream", {
    size: 22,
    weight: 700,
    fill: "#FFFFFF",
    anchor: "middle",
  });

  const teams = [
    ["Match Reading", "#0B3A67", "#E8F3FC", [
      ["Event Interpreter", "Each detection becomes a structured event."],
      ["Tactical Analyst", "Once a minute: pressure, tempo, and patterns."],
      ["Player Tracking Agent", "Touches, shots, expected goals, and heat maps."],
    ]],
    ["Forecast", "#0E7A3D", "#E7F5EC", [
      ["Prediction Agent", "Win, draw, loss, and the next chance to score."],
      ["Explainability Agent", "Why this matters, in Fan and Analyst wording."],
    ]],
    ["Story", "#A74109", "#FFF1E5", [
      ["Visualization Agent", "Ball flight, players, danger, and pass lanes."],
      ["Highlights Agent", "Ranks moments and finds the hidden events."],
    ]],
  ];
  teams.forEach((team, index) => {
    const x = 24 + index * 840;
    card(p, x, 440, 816, 300, { fill: team[2], stroke: team[1], sw: 2 });
    text(p, x + 20, 476, team[0], { size: 22, weight: 700, fill: team[1] });
    const members = team[3];
    const top = 496;
    const bottom = 724;
    const gap = 12;
    const height = (bottom - top - gap * (members.length - 1)) / members.length;
    members.forEach((agent, agentIndex) => {
      const y = top + agentIndex * (height + gap);
      card(p, x + 16, y, 784, height);
      text(p, x + 32, y + 32, agent[0], { size: 20, weight: 700 });
      text(p, x + 32, y + 60, agent[1], { size: 18, fill: "#3D3D3D" });
    });
    arrow(p, x + 408, 440, x + 408, 420, "arr");
  });

  card(p, 24, 760, 2512, 628, { fill: "#0B2540", stroke: "#0B2540" });
  text(p, 48, 802, "ffmpeg copies one encode", { size: 24, weight: 700, fill: "#FFFFFF" });
  text(p, 48, 834, "Render's studio output is captured. ffmpeg does not run once per platform.", {
    size: 18,
    fill: "#D6E4F0",
  });

  card(p, 48, 864, 520, 220, { fill: "#12304D", stroke: "#2E5A82" });
  text(p, 68, 904, "Hidden Chromium", { size: 22, weight: 700, fill: "#FFFFFF" });
  lines(p, 68, 944, [
    "Opens /studio?output.",
    "1920 by 1080, no controls.",
    "Edge when it is present.",
  ], { size: 18, fill: "#D6E4F0", lh: 28 });

  arrow(p, 568, 974, 620, 974, "arrw");

  card(p, 628, 864, 520, 220, { fill: "#12304D", stroke: "#2E5A82" });
  text(p, 648, 904, "ffmpeg", { size: 22, weight: 700, fill: "#FFFFFF" });
  lines(p, 648, 944, [
    "Encodes that picture once.",
    "Copies the same bitstream.",
    "Stream keys stay in .data/.",
  ], { size: 18, fill: "#D6E4F0", lh: 28 });

  arrow(p, 1148, 974, 1200, 974, "arrw");

  const destinations = [
    ["YouTube", "Copy of the one encode"],
    ["X", "Copy of the one encode"],
    ["Facebook", "Copy of the one encode"],
    ["Twitch", "Copy of the one encode"],
  ];
  destinations.forEach((destination, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 1220 + col * 640;
    const y = 864 + row * 120;
    rect(p, x, y, 616, 104, { rx: 12, fill: "#12304D", stroke: "#2E5A82", sw: 1.5 });
    text(p, x + 24, y + 46, destination[0], { size: 28, weight: 700, fill: "#FFFFFF" });
    text(p, x + 24, y + 78, destination[1], { size: 16, fill: "#D6E4F0" });
  });

  text(p, 48, 1128, "Personalize and the gateway still feed the browser on SSE and WebSocket while the encode is copied out.", {
    size: 18,
    fill: "#FFFFFF",
  });
  text(p, 48, 1164, "Auto live captures /live?output with the same Chromium and the same ffmpeg copy.", {
    size: 18,
    fill: "#D6E4F0",
  });
  text(p, 48, 1200, "The seven agents do not each open a stream. They publish onto this same stream.", {
    size: 18,
    fill: "#D6E4F0",
  });
  text(p, 48, 1268, "Ingest, Interpret, Explain, Render, then Personalize / Gateway. That is the operational path.", {
    size: 20,
    weight: 700,
    fill: "#FFFFFF",
  });

  footer(p, "One match pipeline. One hidden browser. One ffmpeg encode copied to YouTube, X, Facebook, and Twitch.");
  return p;
}

function deployment() {
  const p = [];
  chrome(p, "Deployment versus local state", "Terraform resources beside this machine");

  rect(p, 24, 96, 1224, 56, { rx: 10, fill: "#5C5C5C" });
  text(p, 44, 132, "Local · this machine", { size: 24, weight: 700, fill: "#FFFFFF" });
  rect(p, 1268, 96, 1268, 56, { rx: 10, fill: "#0078D4" });
  text(p, 1288, 132, "Azure · deploy/terraform creates", { size: 24, weight: 700, fill: "#FFFFFF" });

  const localCards = [
    ["Process memory", "The match playing now, the studio session, and the ffmpeg encode live in the one FastAPI process."],
    [".data/", "Broadcasts, the studio document, uploads, narration cache, agent switches, stream keys, recordings, and reels."],
    ["Two processes", "Vite, React, and Fluent UI on port 5173. Python FastAPI on port 8000."],
    ["Off until you set them", "Cosmos only with an endpoint. Calls only with a connection string. Narration is a template until a model is set."],
  ];
  localCards.forEach((item, index) => {
    const y = 168 + index * 132;
    card(p, 24, y, 1224, 120);
    text(p, 44, y + 40, item[0], { size: 22, weight: 700 });
    text(p, 44, y + 76, item[1], { size: 18, fill: "#3D3D3D" });
  });

  const created = [
    [icon.rg, "Resource group", "Name rg-kickstream.", "Region centralindia."],
    [icon.logs, "Log Analytics", "Workspace for the app.", "Retention 30 days."],
    [icon.registry, "Container Registry", "Basic registry.", "Image kickstream."],
    [icon.storage, "Storage account", "Standard, LRS.", "TLS 1.2. Holds the share."],
    [icon.files, "Azure Files", "Share data.", "10 GiB, mounted at /data."],
    [icon.acs, "Communication Services", "Cameras and voices.", "Data location India."],
    [icon.speech, "Speech", "Kind SpeechServices.", "Default SKU S0."],
    [icon.cosmos, "Cosmos DB", "Database kickstream.", "Container match_log. No keys."],
    [icon.containerEnv, "Container Apps environment", "Hosts the one app.", "Mounts the Files share."],
    [icon.containerApps, "Container App", "One replica.", "2 vCPU, 4 GiB, port 8000."],
    [icon.appReg, "Entra app registration", "Kickstream studio.", "Audience AzureADMyOrg."],
    [icon.entra, "Microsoft Entra ID", "Studio sign-in.", "In front of the Container App."],
  ];
  created.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 1268 + col * 420;
    const y = 168 + row * 132;
    card(p, x, y, 404, 120);
    iconImage(p, item[0], x + 14, y + 14, 32);
    text(p, x + 54, y + 36, item[1], { size: 16, weight: 700 });
    text(p, x + 16, y + 70, item[2], { size: 16, fill: "#3D3D3D" });
    text(p, x + 16, y + 94, item[3], { size: 16, fill: "#3D3D3D" });
  });

  const rows = [
    ["State", "Local", "Azure deploy"],
    ["Match, studio, encode", "Process memory", "Process memory, one replica"],
    ["Broadcasts and keys", ".data/", "Azure Files share data at /data"],
    ["Match log", "Memory, unless Cosmos is set", "Cosmos DB kickstream / match_log"],
    ["Model", "Foundry, another endpoint, or a template", "Same. Terraform does not create Foundry"],
    ["Sign-in", "None. Keep the pipeline on your machine", "Entra app registration, AzureADMyOrg"],
    ["Calls and voice", "Only when you set the connection and key", "Communication Services and Speech"],
  ];
  rows.forEach((row, index) => {
    const y = 704 + index * 96;
    const fill = index === 0 ? "#0B3A67" : index % 2 === 0 ? "#FFFFFF" : "#E8F3FC";
    const color = index === 0 ? "#FFFFFF" : "#242424";
    rect(p, 24, y, 2512, 96, { fill });
    const weight = index === 0 ? 700 : 400;
    text(p, 44, y + 42, row[0], { size: 20, weight: 700, fill: color });
    text(p, 520, y + 42, row[1], { size: 20, weight, fill: color });
    text(p, 1480, y + 42, row[2], { size: 20, weight, fill: color });
    if (index === 4) iconImage(p, icon.foundry, 2460, y + 28, 36);
  });

  footer(p, "deploy/terraform creates the Azure column. Microsoft Foundry is an existing project the app signs into.");
  return p;
}

function agents() {
  const p = [];
  chrome(p, "Match agents and narration", "Three teams, four writers, template fallback");

  const teams = [
    ["Match Reading", "#0B3A67", "#E8F3FC", "Reads the event stream", [
      ["Event Interpreter", "Every detection", "Third, flank, phase of play, possession sequence, and danger.", "The other six agents read this event."],
      ["Tactical Analyst", "Once a minute", "Pressure, tempo, field tilt, and patterns such as a high press.", "Adds a control fact or a chaos fact when the swing says so."],
      ["Player Tracking Agent", "Every player", "Touches, passing, shots, expected goals, rating, and a heat map.", "The page and the player card can follow one player."],
    ]],
    ["Forecast", "#0E7A3D", "#E7F5EC", "Odds and the reason", [
      ["Prediction Agent", "Once a minute", "Win, draw, and loss, a goal in the next ten minutes, and a danger grid.", "Also names what the side on the ball does next."],
      ["Explainability Agent", "When it matters", "Writes why this matters, in Fan and Analyst wording. English prose.", "At most 20 explanations. A template when no model is set."],
    ]],
    ["Story", "#A74109", "#FFF1E5", "Picture and moments", [
      ["Visualization Agent", "The 3D pitch", "Ball flight, players, danger columns, pass lanes, and a camera hint.", "Only the ball and the player on it are known positions."],
      ["Highlights Agent", "Key moments", "Ranks them, and finds long moves, saves, and unsung players.", "Hidden events include a tactical foul and a ball won high."],
    ]],
  ];
  teams.forEach((team, index) => {
    const x = 24 + index * 840;
    rect(p, x, 96, 816, 520, { rx: 12, fill: team[2], stroke: team[1], sw: 2 });
    rect(p, x, 96, 816, 64, { rx: 12, fill: team[1] });
    rect(p, x, 128, 816, 32, { fill: team[1] });
    text(p, x + 20, 128, team[0], { size: 24, weight: 700, fill: "#FFFFFF" });
    text(p, x + 20, 152, team[3], { size: 16, fill: "#F4F7FB" });
    const members = team[4];
    const top = 176;
    const bottom = 600;
    const gap = 12;
    const height = (bottom - top - gap * (members.length - 1)) / members.length;
    members.forEach((agent, agentIndex) => {
      const y = top + agentIndex * (height + gap);
      card(p, x + 16, y, 784, height);
      text(p, x + 32, y + 36, agent[0], { size: 22, weight: 700 });
      text(p, x + 752, y + 36, agent[1], { size: 16, weight: 650, fill: team[1], anchor: "end" });
      text(p, x + 32, y + 72, agent[2], { size: 18, fill: "#3D3D3D" });
      text(p, x + 32, y + 102, agent[3], { size: 18, fill: "#3D3D3D" });
      if (height > 160) {
        text(p, x + 32, y + height - 28, "Publishes onto the match stream", {
          size: 16,
          weight: 650,
          fill: team[1],
        });
      }
    });
  });

  rect(p, 24, 632, 2512, 300, { rx: 12, fill: "#F8F2FC", stroke: "#5C2D91", sw: 2 });
  text(p, 44, 668, "Four narration writers", { size: 24, weight: 700, fill: "#5C2D91" });
  text(p, 44, 698, "Microsoft Agent Framework. One shared Foundry client. Each item is written once per mode and language.", {
    size: 18,
    fill: "#3D3D3D",
  });
  const writers = [
    ["Commentator", "Key moment", "Fan wording, beside the analyst writer."],
    ["Tactical Analyst", "Key moment", "Analyst wording. Not the match agent."],
    ["Recap Writer", "Half and full time", "The break and the final recap."],
    ["Localizer", "Spanish and Hindi", "Translates each item. Cost stays flat."],
  ];
  writers.forEach((writer, index) => {
    const x = 44 + index * 620;
    card(p, x, 720, 596, 184);
    text(p, x + 20, 760, writer[0], { size: 22, weight: 700, fill: "#5C2D91" });
    text(p, x + 20, 792, writer[1], { size: 16, weight: 650, fill: "#0B3A67" });
    text(p, x + 20, 832, writer[2], { size: 18, fill: "#3D3D3D" });
  });

  card(p, 24, 952, 1232, 436, { fill: "#FFF8E6", stroke: "#8A6116", sw: 2 });
  text(p, 48, 996, "No model is set", { size: 26, weight: 700, fill: "#8A6116" });
  lines(p, 48, 1044, [
    "Template fallback.",
    "The line is marked Scripted.",
    "Foundry project endpoint is empty,",
    "and KICKSTREAM_LLM_* is empty.",
    "The seven agents still compute.",
    "Only the wording waits.",
    "Custom instructions wait too.",
    "Switched-off agents stay off.",
  ], { size: 22, fill: "#242424", lh: 36 });

  card(p, 1280, 952, 1256, 436, { fill: "#E8F3FC", stroke: "#0078D4", sw: 2 });
  iconImage(p, icon.foundry, 1304, 976, 40);
  text(p, 1356, 1004, "A model is set", { size: 26, weight: 700, fill: "#0B3A67" });
  lines(p, 1304, 1060, [
    "Microsoft Agent Framework writes.",
    "A Foundry project is preferred when",
    "both it and KICKSTREAM_LLM_* are set.",
    "The app signs in with Entra ID.",
    "Slow, limited, or unusable output",
    "falls back to the template.",
    "A replay is cached, so it is free.",
    "Explainability stops at 20 lines.",
  ], { size: 22, fill: "#242424", lh: 36 });

  footer(p, "Explainability Agent is the only match agent that writes prose: English, at most 20 explanations a match.");
  return p;
}

const diagrams = [
  ["architecture.html", "Kickstream technical architecture", architecture()],
  ["sequence.html", "Kickstream sequence of a key match moment", sequence()],
  ["flow.html", "Kickstream operational flow", flow()],
  ["deployment.html", "Kickstream deployment versus local state", deployment()],
  ["agents.html", "Kickstream match agents and narration", agents()],
];

const required = {
  "architecture.html": [
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
    icon.containerApps,
    icon.registry,
    icon.files,
    icon.cosmos,
    icon.acs,
    icon.speech,
    icon.logs,
    icon.entra,
    icon.foundry,
  ],
  "sequence.html": [
    "Match source",
    "Match events into Ingest",
    "Normalized events to Interpret",
    "Stats to the match agents",
    "and Foundry narration",
    "Narration and findings to Render",
    "Overlay picture to the Gateway",
    "SSE and WebSocket to the browser",
    "Render / overlay",
    "SSE/WebSocket",
  ],
  "flow.html": [
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
    "copies one encode",
  ],
  "deployment.html": [
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
    icon.rg,
    icon.logs,
    icon.registry,
    icon.storage,
    icon.files,
    icon.acs,
    icon.speech,
    icon.cosmos,
    icon.containerEnv,
    icon.containerApps,
    icon.appReg,
    icon.entra,
    icon.foundry,
  ],
  "agents.html": [
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
    "Microsoft Agent Framework",
    icon.foundry,
  ],
};

const banned = ["Event Hubs", "Web PubSub", "Media Services", "Service Bus", "Key Vault", "Front Door", "Azure Functions"];

for (const [name, title, body] of diagrams) {
  const html = wrap(title, body);
  for (const phrase of required[name]) {
    if (!html.includes(phrase)) throw new Error(`${name} missing ${phrase}`);
  }
  for (const phrase of banned) {
    if (html.includes(phrase)) throw new Error(`${name} mentions ${phrase}`);
  }
  const texts = [...html.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
  if (name === "architecture.html" || name === "flow.html") {
    if (!texts.includes("X")) throw new Error(`${name} missing destination X`);
    for (const destination of ["YouTube", "Facebook", "Twitch"]) {
      if (!texts.includes(destination)) throw new Error(`${name} missing ${destination}`);
    }
  }
  writeFileSync(join(dir, name), html);
  console.log(`${name} ${html.length} chars`);
}

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

const tone = {
  blue: ["#E8F3FC", "#0078D4", "#0B3A67"],
  purple: ["#F4EEF9", "#5C2D91", "#5C2D91"],
  green: ["#E5F6EC", "#0E7A3D", "#0E7A3D"],
  amber: ["#FFF4E5", "#8A6116", "#8A6116"],
  navy: ["#12324F", "#7FB4DE", "#E8F4FF"],
  ink: ["#FFFFFF", "#C5D0DC", "#0B2545"],
};

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
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
  const filter = options.shadow ? ` filter="url(#soft)"` : "";
  push(
    parts,
    `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash}${filter}/>`,
  );
}

function text(parts, x, y, value, options = {}) {
  const size = options.size ?? 16;
  const weight = options.weight ?? 400;
  const fill = options.fill ?? "#142033";
  const anchor = options.anchor ?? "start";
  const spacing = options.spacing ? ` letter-spacing="${options.spacing}"` : "";
  push(
    parts,
    `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"${spacing}>${esc(value)}</text>`,
  );
}

function lines(parts, x, y, rows, options = {}) {
  const lh = options.lh ?? Math.round((options.size ?? 16) * 1.4);
  rows.forEach((row, index) => text(parts, x, y + index * lh, row, options));
}

function iconImage(parts, href, x, y, size = 32) {
  push(parts, `<image href="${href}" x="${n(x)}" y="${n(y)}" width="${size}" height="${size}"></image>`);
}

function marker(id, fill) {
  return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${fill}"/></marker>`;
}

function elbow(parts, points, options = {}) {
  const pts = points.map((pt) => [pt[0], pt[1]]);
  if (pts.length >= 2) {
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const trim = options.trim ?? 8;
    pts[pts.length - 1] = [b[0] - (dx / len) * trim, b[1] - (dy / len) * trim];
  }
  const d = pts.map((pt, index) => `${index === 0 ? "M" : "L"}${n(pt[0])} ${n(pt[1])}`).join(" ");
  const color = options.color ?? "#0078D4";
  const width = options.width ?? 2.25;
  const markerId = options.marker ?? "arr";
  const dash = options.dash ? ` stroke-dasharray="${options.dash}"` : "";
  push(
    parts,
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${dash} marker-end="url(#${markerId})"/>`,
  );
}

function proto(parts, x, y, label, name = "blue") {
  const [fill, stroke, color] = tone[name];
  const w = Math.max(56, Math.round(label.length * 7.2 + 20));
  rect(parts, x, y, w, 24, { rx: 12, fill, stroke, sw: 1.25 });
  text(parts, x + w / 2, y + 16, label, { size: 13, weight: 700, fill: color, anchor: "middle" });
  return w;
}

function protoMid(parts, cx, cy, label, name = "blue") {
  const w = Math.max(56, Math.round(label.length * 7.2 + 20));
  proto(parts, cx - w / 2, cy - 12, label, name);
}

function chrome(parts, index, title, claim) {
  rect(parts, 0, 0, W, H, { fill: "#F3F6FA" });
  rect(parts, 0, 0, W, 96, { fill: "#0B2545" });
  rect(parts, 0, 96, W, 4, { fill: "#0078D4" });
  rect(parts, 28, 26, 16, 16, { rx: 3, fill: "#0078D4" });
  rect(parts, 28, 46, 16, 6, { rx: 2, fill: "#50E6FF" });
  text(parts, 56, 40, "KICKSTREAM", { size: 14, weight: 700, fill: "#9EC9EF", spacing: "1.6" });
  text(parts, 56, 66, "Football live broadcast", { size: 16, fill: "#D5E6F5" });
  text(parts, 300, 40, index, { size: 14, weight: 700, fill: "#7FB4DE", spacing: "1.4" });
  text(parts, W - 32, 42, title, { size: 30, weight: 700, fill: "#FFFFFF", anchor: "end" });
  text(parts, W - 32, 72, claim, { size: 16, fill: "#C5D8EA", anchor: "end" });
}

function footer(parts, left) {
  rect(parts, 0, 1404, W, 36, { fill: "#0B2545" });
  text(parts, 28, 1427, left, { size: 14, fill: "#D5E6F5" });
  text(parts, W - 28, 1427, "Submission diagram  ·  the system this repository ships", {
    size: 14,
    fill: "#9EC9EF",
    anchor: "end",
  });
}

function legend(parts, y, items) {
  text(parts, 32, y + 16, "PROTOCOLS", { size: 12, weight: 700, fill: "#5C6B7A", spacing: "1.5" });
  let x = 148;
  for (const item of items) {
    x += proto(parts, x, y, item, "ink") + 8;
  }
}

function kicker(parts, x, y, label, color = "#0078D4") {
  rect(parts, x, y - 12, 6, 18, { rx: 3, fill: color });
  text(parts, x + 14, y + 2, label, { size: 13, weight: 700, fill: color, spacing: "1.2" });
}

function card(parts, x, y, w, h, options = {}) {
  rect(parts, x, y, w, h, {
    rx: options.rx ?? 12,
    fill: options.fill ?? "#FFFFFF",
    stroke: options.stroke ?? "#D5DEE8",
    sw: options.sw ?? 1.25,
    dash: options.dash,
    shadow: options.shadow ?? false,
  });
}

function wrap(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  html, body { margin: 0; padding: 0; background: #F3F6FA; width: ${W}px; height: ${H}px; overflow: hidden; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="soft" x="-12%" y="-12%" width="124%" height="136%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.6" flood-color="#0B2545" flood-opacity="0.14"/>
    </filter>
    ${marker("arr", "#0078D4")}
    ${marker("arrw", "#FFFFFF")}
    ${marker("arrg", "#0E7A3D")}
    ${marker("arrp", "#5C2D91")}
    ${marker("arra", "#8A6116")}
    ${marker("arrn", "#0B2545")}
  </defs>
  ${body.join("\n  ")}
</svg>
</body>
</html>
`;
}

function architecture() {
  const p = [];
  chrome(p, "01  /  05", "Technical architecture", "One process owns the match, the studio, and the encode.");
  legend(p, 114, ["HTTPS", "SSE", "WebSocket", "OIDC", "DevTools", "MPEG-TS", "FLV", "RTMP", "RTMPS", "SMB"]);

  kicker(p, 32, 164, "1    MATCH SOURCES", "#8A6116");
  const sources = [
    ["Simulator", "In-process", "Synthetic match. Ninety minutes in about three minutes."],
    ["Detector file", "JSON Lines", "File of events. Set KICKSTREAM_DETECTOR_FILE."],
    ["StatsBomb", "HTTPS", "Past-match replay. Non-commercial, with attribution."],
    ["API-Football", "HTTPS", "Live fixtures. Optional key. Off on a deploy."],
    ["OpenLigaDB", "HTTPS", "Live scores for listed leagues. Off on Azure."],
  ];
  sources.forEach((source, index) => {
    const x = 32 + index * 500;
    card(p, x, 180, 484, 92, { shadow: true });
    rect(p, x, 180, 6, 92, { fill: "#8A6116" });
    text(p, x + 22, 210, source[0], { size: 18, weight: 700 });
    proto(p, x + 250, 194, source[1], index < 2 ? "amber" : "blue");
    text(p, x + 22, 244, source[2], { size: 15, fill: "#3B4A5A" });
  });
  elbow(p, [[1272, 272], [1272, 328], [1108, 328], [1108, 368]], { color: "#8A6116", marker: "arra" });
  protoMid(p, 1190, 328, "into Ingest", "amber");

  card(p, 28, 348, 500, 736, { fill: "#F7FBFE", stroke: "#C5D7EA", sw: 1.5 });
  kicker(p, 48, 376, "2    EXPERIENCE", "#0078D4");

  card(p, 48, 400, 460, 250, { shadow: true });
  text(p, 68, 432, "Vite, React, and Fluent UI", { size: 20, weight: 700 });
  lines(p, 68, 462, ["apps/web · Fluent UI v9", "Local HTTP · 127.0.0.1:5173", "Azure serves the built app on HTTPS", "Python FastAPI on port 8000"], {
    size: 15,
    fill: "#3B4A5A",
    lh: 24,
  });
  ["Home", "Studio", "Match", "Live", "Dashboard", "Guest"].forEach((label, index) => {
    const x = 68 + (index % 3) * 142;
    const y = 568 + Math.floor(index / 3) * 34;
    rect(p, x, y, 132, 26, { rx: 13, fill: "#E8F3FC" });
    text(p, x + 66, y + 18, label, { size: 13, weight: 700, fill: "#0B3A67", anchor: "middle" });
  });

  card(p, 48, 666, 460, 150, { shadow: true });
  iconImage(p, icon.entra, 68, 684, 36);
  text(p, 116, 708, "Microsoft Entra ID", { size: 20, weight: 700 });
  proto(p, 340, 690, "OIDC", "blue");
  lines(p, 68, 748, ["Studio sign-in. Audience AzureADMyOrg.", "Redirect /.auth/login/aad/callback.", "Guests, /live, and /match can stay open."], {
    size: 15,
    fill: "#3B4A5A",
    lh: 22,
  });

  card(p, 48, 832, 460, 228, { fill: "#F3FBF6", stroke: "#0E7A3D", sw: 1.5, shadow: true });
  text(p, 68, 864, "Browser", { size: 20, weight: 700, fill: "#0E7A3D" });
  proto(p, 168, 846, "SSE", "green");
  proto(p, 230, 846, "WebSocket", "green");
  lines(p, 68, 902, [
    "Gateway fans the match out.",
    "Personalize: mode, language, favourite.",
    "Late join: newest pitch scene and",
    "newest player report only.",
    "Sockets only from the reached host.",
  ], { size: 15, fill: "#3B4A5A", lh: 24 });

  card(p, 544, 348, 1128, 736, { fill: "#F4F9FD", stroke: "#0078D4", sw: 2 });
  iconImage(p, icon.containerEnv, 564, 364, 32);
  text(p, 606, 386, "Azure Container Apps environment", { size: 16, weight: 700, fill: "#0B3A67" });
  text(p, 980, 386, "Logs to Log Analytics", { size: 14, fill: "#3B4A5A" });

  card(p, 564, 408, 1088, 656, { fill: "#FFFFFF", stroke: "#0078D4", sw: 1.75, shadow: true });
  iconImage(p, icon.containerApps, 584, 424, 36);
  text(p, 630, 448, "Azure Container Apps · one replica", { size: 22, weight: 700 });
  text(p, 584, 480, "Python 3.13 · FastAPI · port 8000 · 2 vCPU · 4 GiB · min and max replicas 1", {
    size: 15,
    fill: "#3B4A5A",
  });

  const stages = [
    ["1", "Ingest", "Events land here"],
    ["2", "Interpret", "Stats and pressure"],
    ["3", "Explain", "Fan and Analyst"],
    ["4", "Render", "Overlay scenes"],
    ["5", "Gateway", "SSE · WebSocket"],
  ];
  stages.forEach((stage, index) => {
    const x = 584 + index * 210;
    const first = index === 0;
    const nose = 16;
    const y = 504;
    const h = 96;
    const w = 200;
    const points = first
      ? `${x},${y} ${x + w - nose},${y} ${x + w},${y + h / 2} ${x + w - nose},${y + h} ${x},${y + h}`
      : `${x},${y} ${x + w - nose},${y} ${x + w},${y + h / 2} ${x + w - nose},${y + h} ${x},${y + h} ${x + nose},${y + h / 2}`;
    push(p, `<polygon points="${points}" fill="${index === 4 ? "#E5F6EC" : "#F4F8FC"}" stroke="#0078D4" stroke-width="1.75" stroke-linejoin="round"/>`);
    text(p, x + (first ? 16 : 28), y + 36, stage[0], { size: 13, weight: 700, fill: "#0078D4" });
    text(p, x + (first ? 36 : 48), y + 36, stage[1], { size: 18, weight: 700 });
    text(p, x + (first ? 16 : 28), y + 64, stage[2], { size: 13, fill: "#3B4A5A" });
    text(p, x + (first ? 16 : 28), y + 84, index === 4 ? "to the browser" : "in-process", {
      size: 13,
      weight: 700,
      fill: "#0B3A67",
    });
  });

  card(p, 584, 620, 1048, 128, { fill: "#F8F4FC", stroke: "#5C2D91" });
  text(p, 604, 650, "Seven match agents publish onto this stream", { size: 18, weight: 700, fill: "#5C2D91" });
  text(p, 604, 678, "Match Reading · Event Interpreter, Tactical Analyst, Player Tracking Agent", {
    size: 15,
    fill: "#3B4A5A",
  });
  text(p, 604, 704, "Forecast · Prediction Agent, Explainability Agent", { size: 15, fill: "#3B4A5A" });
  text(p, 604, 728, "Story · Visualization Agent, Highlights Agent · same stream the gateway sends", {
    size: 15,
    fill: "#3B4A5A",
  });

  card(p, 584, 768, 300, 270, { shadow: true });
  text(p, 604, 800, "Hidden Chromium", { size: 18, weight: 700 });
  proto(p, 760, 782, "HTTP", "blue");
  lines(p, 604, 844, ["GET /studio?output", "1920 × 1080", "Edge when present", "Auto live: /live?output"], {
    size: 15,
    fill: "#3B4A5A",
    lh: 26,
  });
  text(p, 604, 970, "DevTools WebSocket out", { size: 14, weight: 700, fill: "#0B3A67" });
  text(p, 604, 994, "No speakers. Azure voice only.", { size: 13, fill: "#5C6B7A" });

  elbow(p, [[884, 902], [960, 902]], { marker: "arr" });

  card(p, 960, 768, 300, 270, { shadow: true });
  text(p, 980, 800, "Capture", { size: 18, weight: 700 });
  proto(p, 1088, 782, "WebSocket", "navy");
  lines(p, 980, 844, ["Chrome DevTools Protocol", "Page.navigate, then record", "Picture plus guest audio"], {
    size: 15,
    fill: "#3B4A5A",
    lh: 26,
  });
  text(p, 980, 970, "MPEG-TS pipe out", { size: 14, weight: 700, fill: "#0B3A67" });

  elbow(p, [[1260, 902], [1336, 902]], { marker: "arr" });

  card(p, 1336, 768, 276, 270, { shadow: true });
  text(p, 1356, 800, "ffmpeg", { size: 18, weight: 700 });
  proto(p, 1460, 782, "FLV", "green");
  lines(p, 1356, 844, ["Encode the picture once", "-c copy", "One bitstream"], {
    size: 15,
    fill: "#3B4A5A",
    lh: 26,
  });
  text(p, 1356, 970, "RTMP and RTMPS out", { size: 14, weight: 700, fill: "#0E7A3D" });

  card(p, 1688, 348, 844, 736, { fill: "#FFFFFF", stroke: "#D5DEE8" });
  kicker(p, 1708, 376, "4    PLATFORM CALLS", "#0F6C6C");
  const services = [
    [icon.registry, "Container Registry", "OCI pull", "Image kickstream. The replica starts from it.", false],
    [icon.files, "Azure Files", "SMB", "Files share data, mounted at /data.", false],
    [icon.cosmos, "Cosmos DB", "HTTPS", "Database kickstream. Container match_log. /match_id.", false],
    [icon.acs, "Communication Services", "HTTPS", "Rooms API and a VoIP token. Browser uses ACS Calling.", false],
    [icon.speech, "Speech", "HTTPS", "SSML in. MP3 commentator audio out.", false],
    [icon.logs, "Log Analytics", "Diagnostics", "Environment workspace. Retention 30 days.", false],
    [icon.identity, "Managed identity", "Entra token", "System-assigned. Cosmos role. Azure AI User.", false],
    [icon.foundry, "Microsoft Foundry", "HTTPS", "An existing project the app signs into. Terraform does not create it.", true],
  ];
  services.forEach((service, index) => {
    const y = 400 + index * 82;
    card(p, 1708, y, 804, 74, {
      fill: service[4] ? "#FBF8FE" : "#FFFFFF",
      stroke: service[4] ? "#5C2D91" : "#E1E7EF",
      dash: service[4] ? "7 5" : undefined,
      sw: service[4] ? 1.75 : 1.15,
    });
    iconImage(p, service[0], 1722, y + 18, 36);
    text(p, 1770, y + 32, service[1], { size: 16, weight: 700, fill: service[4] ? "#5C2D91" : "#142033" });
    proto(p, 2100, y + 14, service[2], service[4] ? "purple" : "blue");
    text(p, 1770, y + 56, service[3], { size: 14, fill: "#3B4A5A" });
  });
  elbow(p, [[1672, 720], [1688, 720]], { color: "#0F6C6C", marker: "arr" });

  rect(p, 28, 1100, 2504, 288, { rx: 14, fill: "#0B2545" });
  text(p, 52, 1136, "5", { size: 14, weight: 700, fill: "#7FB4DE" });
  text(p, 80, 1136, "ffmpeg copies one encode to four destinations", { size: 22, weight: 700, fill: "#FFFFFF" });
  text(p, 52, 1164, "Hidden Chromium is encoded once. -c copy -f flv. Each platform gets that same bitstream.", {
    size: 15,
    fill: "#C5D8EA",
  });
  const destinations = [
    ["YouTube", "RTMP", "rtmp://a.rtmp.youtube.com/live2", "#C4302B"],
    ["X", "RTMP", "The account's own RTMP address", "#111111"],
    ["Facebook", "RTMPS", "rtmps://  port 443", "#1877F2"],
    ["Twitch", "RTMP", "rtmp://live.twitch.tv/app", "#9146FF"],
  ];
  destinations.forEach((destination, index) => {
    const x = 52 + index * 616;
    rect(p, x, 1190, 596, 170, { rx: 12, fill: "#12324F" });
    rect(p, x, 1190, 8, 170, { fill: destination[3] });
    text(p, x + 32, 1248, destination[0], { size: 32, weight: 700, fill: "#FFFFFF" });
    proto(p, x + 32, 1268, destination[1], "navy");
    text(p, x + 32, 1328, destination[2], { size: 16, fill: "#D5E6F5" });
  });

  footer(p, "One Container App replica. Foundry is an existing project. Terraform does not create it.");
  return p;
}

function sequence() {
  const p = [];
  chrome(p, "02  /  05", "Sequence of a key match moment", "Six messages. Top to bottom. Protocols on the arrows.");
  legend(p, 114, ["JSON Lines", "HTTPS", "In-process", "Foundry HTTPS", "SSE", "WebSocket"]);

  const actors = [
    ["Match source", "events", "#8A6116", "#FFF8EC"],
    ["Ingest", "normalize", "#0B3A67", "#E8F3FC"],
    ["Interpret", "analytics", "#0B3A67", "#E8F3FC"],
    ["Explain", "agents, Foundry", "#5C2D91", "#F8F2FC"],
    ["Render / overlay", "compose", "#0B3A67", "#E8F3FC"],
    ["Gateway", "personalize", "#0B3A67", "#E8F3FC"],
    ["Browser", "SSE/WebSocket", "#0E7A3D", "#E7F6EC"],
  ];
  const xs = [168, 536, 904, 1272, 1640, 2008, 2376];
  actors.forEach((actor, index) => {
    const x = xs[index];
    rect(p, x - 104, 160, 208, 72, { rx: 10, fill: actor[3], stroke: actor[2], sw: 2 });
    text(p, x, 190, actor[0], { size: 16, weight: 700, fill: actor[2], anchor: "middle" });
    text(p, x, 214, actor[1], { size: 13, fill: "#3B4A5A", anchor: "middle" });
    push(p, `<line x1="${x}" y1="232" x2="${x}" y2="1128" stroke="#B7C5D4" stroke-width="2" stroke-dasharray="4 7"/>`);
  });

  const messages = [
    [0, 1, ["Match events into Ingest"], "JSON Lines or HTTPS", "Simulator, detector file, or a live feed"],
    [1, 2, ["Normalized events to Interpret"], "In-process", "Sequence numbers are assigned here"],
    [2, 3, ["Stats to the match agents", "and Foundry narration"], "Foundry HTTPS", "Template if no model is set"],
    [3, 4, ["Narration and findings to Render"], "In-process", "Lines, overlay facts, highlights"],
    [4, 5, ["Overlay picture to the Gateway"], "In-process", "Score, banners, pitch, widgets"],
    [5, 6, ["SSE and WebSocket to the browser"], "SSE + WebSocket", "Mode, language, and favourite"],
  ];
  messages.forEach((message, index) => {
    const y = 300 + index * 132;
    const x1 = xs[message[0]];
    const x2 = xs[message[1]];
    const mid = (x1 + x2) / 2;
    rect(p, x1 - 7, y - 28, 14, 78, { rx: 3, fill: "#0078D4" });
    rect(p, x2 - 7, y - 8, 14, 56, { rx: 3, fill: "#7FB4DE" });
    elbow(p, [[x1 + 10, y], [x2 - 14, y]]);
    const labelH = message[2].length === 2 ? 46 : 26;
    rect(p, mid - 168, y - labelH - 16, 336, labelH, { rx: 6, fill: "#FFFFFF", stroke: "#D5DEE8" });
    message[2].forEach((line, lineIndex) => {
      text(p, mid, y - labelH + 4 + lineIndex * 20, line, {
        size: 15,
        weight: 700,
        fill: "#0B2545",
        anchor: "middle",
      });
    });
    protoMid(p, mid, y + 28, message[3], index === 2 ? "purple" : index === 5 ? "green" : "blue");
    text(p, mid, y + 56, message[4], { size: 13, fill: "#4A5A6A", anchor: "middle" });
    rect(p, 28, y - 14, 32, 28, { rx: 14, fill: "#0B2545" });
    text(p, 44, y + 5, String(index + 1), { size: 14, weight: 700, fill: "#FFFFFF", anchor: "middle" });
  });

  card(p, 28, 1152, 2504, 236);
  text(p, 52, 1190, "Causal chain", { size: 20, weight: 700 });
  lines(p, 52, 1224, [
    "A key moment moves from the match source to Ingest, then Interpret, then the match agents and Foundry narration (Explain),",
    "then Render and the overlay, then the Gateway, then the browser over SSE and WebSocket.",
    "Narration is written once per mode and language. With no model set, the item is a template and is marked Scripted.",
    "A late joiner receives the newest pitch scene and the newest player report, not the earlier pitch scenes.",
  ], { size: 16, fill: "#3B4A5A", lh: 30 });

  footer(p, "One process. The browser reads the gateway. The encode is a separate path off Render, not a second match.");
  return p;
}

function flow() {
  const p = [];
  chrome(p, "03  /  05", "Operational flow", "Ingest to the gateway, then one encode copied four ways.");
  legend(p, 114, ["Events", "Stats", "Narration", "Picture", "SSE", "WebSocket", "DevTools", "MPEG-TS", "RTMP", "RTMPS"]);

  const stages = [
    ["Ingest", "Match source enters.", "Simulator, file, or HTTPS.", "events"],
    ["Interpret", "Analytics on events.", "Score, pressure, tempo.", "stats"],
    ["Explain", "Narration is written.", "Foundry, or a template.", "words"],
    ["Render", "The picture is composed.", "Overlay, pitch, widgets.", "picture"],
    ["Personalize / Gateway", "The browser view.", "Mode, language, favourite.", "SSE"],
  ];
  stages.forEach((stage, index) => {
    const x = 32 + index * 508;
    const y = 168;
    const nose = 18;
    const w = 488;
    const h = 168;
    const points =
      index === 0
        ? `${x},${y} ${x + w - nose},${y} ${x + w},${y + h / 2} ${x + w - nose},${y + h} ${x},${y + h}`
        : `${x},${y} ${x + w - nose},${y} ${x + w},${y + h / 2} ${x + w - nose},${y + h} ${x},${y + h} ${x + nose},${y + h / 2}`;
    push(
      p,
      `<polygon points="${points}" fill="${index === 4 ? "#E5F6EC" : "#FFFFFF"}" stroke="${index === 4 ? "#0E7A3D" : "#0078D4"}" stroke-width="2" stroke-linejoin="round"/>`,
    );
    const tx = x + (index === 0 ? 24 : 36);
    text(p, tx, y + 48, String(index + 1), { size: 14, weight: 700, fill: "#0078D4" });
    text(p, tx + 28, y + 48, stage[0], { size: 22, weight: 700 });
    text(p, tx, y + 82, stage[1], { size: 16, fill: "#3B4A5A" });
    text(p, tx, y + 108, stage[2], { size: 16, fill: "#3B4A5A" });
    text(p, tx, y + 142, stage[3], { size: 14, weight: 700, fill: "#0B3A67" });
  });

  stages.forEach((_, index) => {
    if (index === 4) return;
    const x = 32 + index * 508 + 244;
    elbow(p, [[x, 336], [x, 372]], { color: "#5C2D91", marker: "arrp" });
  });

  rect(p, 32, 372, 2496, 52, { rx: 10, fill: "#5C2D91" });
  text(p, 1280, 404, "Seven match agents publish onto this same stream", {
    size: 22,
    weight: 700,
    fill: "#FFFFFF",
    anchor: "middle",
  });

  const teams = [
    ["Match Reading", "#0B3A67", "#E8F3FC", [
      ["Event Interpreter", "Each detection becomes a structured event."],
      ["Tactical Analyst", "Once a minute: pressure, tempo, and patterns."],
      ["Player Tracking Agent", "Touches, shots, expected goals, heat maps."],
    ]],
    ["Forecast", "#0E7A3D", "#E7F6EC", [
      ["Prediction Agent", "Win, draw, loss, and the next chance to score."],
      ["Explainability Agent", "Why it matters. English. At most 20."],
    ]],
    ["Story", "#A74109", "#FFF4EC", [
      ["Visualization Agent", "Ball, the player on it, danger, pass lanes."],
      ["Highlights Agent", "Ranks moments. Finds the hidden events."],
    ]],
  ];
  teams.forEach((team, index) => {
    const x = 32 + index * 840;
    card(p, x, 448, 816, 300, { fill: team[2], stroke: team[1], sw: 1.75 });
    text(p, x + 20, 480, team[0], { size: 20, weight: 700, fill: team[1] });
    proto(p, x + 620, 460, "publishes up", "purple");
    const members = team[3];
    members.forEach((agent, agentIndex) => {
      const y = 500 + agentIndex * (members.length === 3 ? 76 : 110);
      const h = members.length === 3 ? 68 : 100;
      card(p, x + 16, y, 784, h);
      text(p, x + 32, y + 28, agent[0], { size: 18, weight: 700 });
      text(p, x + 32, y + (h > 80 ? 58 : 52), agent[1], { size: 15, fill: "#3B4A5A" });
    });
  });

  rect(p, 32, 768, 2496, 620, { rx: 14, fill: "#0B2545" });
  text(p, 56, 808, "Going live", { size: 14, weight: 700, fill: "#7FB4DE", spacing: "1.4" });
  text(p, 180, 808, "ffmpeg copies one encode", { size: 24, weight: 700, fill: "#FFFFFF" });
  text(p, 56, 840, "The studio output is captured once. ffmpeg does not encode once per platform.", {
    size: 16,
    fill: "#C5D8EA",
  });

  const live = [
    ["Hidden Chromium", "HTTP", ["GET /studio?output", "1920 × 1080", "Edge when present", "Auto live /live?output"]],
    ["DevTools session", "WebSocket", ["Chrome DevTools Protocol", "Navigate, then record", "Picture and guest call", "No browser speakers"]],
    ["ffmpeg", "MPEG-TS", ["Pipe in, one picture", "-c copy -f flv", "One bitstream out", "Keys stay in .data/"]],
  ];
  live.forEach((node, index) => {
    const x = 56 + index * 430;
    rect(p, x, 868, 390, 220, { rx: 12, fill: "#12324F" });
    text(p, x + 20, 904, node[0], { size: 20, weight: 700, fill: "#FFFFFF" });
    proto(p, x + 20, 920, node[1], "navy");
    lines(p, x + 20, 972, node[2], { size: 15, fill: "#D5E6F5", lh: 24 });
    if (index < live.length - 1) elbow(p, [[x + 390, 978], [x + 430, 978]], { color: "#FFFFFF", marker: "arrw" });
  });

  const destinations = [
    ["YouTube", "RTMP", "#C4302B"],
    ["X", "RTMP", "#F2F2F2"],
    ["Facebook", "RTMPS", "#1877F2"],
    ["Twitch", "RTMP", "#9146FF"],
  ];
  destinations.forEach((destination, index) => {
    const x = 1360 + (index % 2) * 560;
    const y = 868 + Math.floor(index / 2) * 150;
    rect(p, x, y, 536, 136, { rx: 12, fill: "#12324F" });
    rect(p, x, y, 8, 136, { fill: destination[2] });
    text(p, x + 28, y + 58, destination[0], { size: 28, weight: 700, fill: "#FFFFFF" });
    text(p, x + 28, y + 96, "Copy of the one encode", { size: 16, fill: "#C5D8EA" });
    proto(p, x + 360, y + 40, destination[1], "navy");
  });
  elbow(p, [[1346, 978], [1360, 978]], { color: "#FFFFFF", marker: "arrw" });

  text(p, 56, 1188, "Ingest, Interpret, Explain, Render, then Personalize / Gateway.", {
    size: 18,
    weight: 700,
    fill: "#FFFFFF",
  });
  text(p, 56, 1222, "The gateway keeps the browser on SSE and WebSocket while the copy goes out. Agents publish onto this same stream.", {
    size: 16,
    fill: "#D5E6F5",
  });
  text(p, 56, 1256, "Sound on the encode is the guests' call. The hidden browser has no speakers, so only the Azure voice is carried.", {
    size: 16,
    fill: "#D5E6F5",
  });
  rect(p, 56, 1296, 2448, 44, { rx: 8, fill: "#12324F" });
  text(p, 76, 1324, "HTTP page    →    DevTools WebSocket    →    MPEG-TS pipe    →    FLV copy    →    RTMP / RTMPS", {
    size: 16,
    weight: 700,
    fill: "#FFFFFF",
  });

  footer(p, "One match pipeline. One hidden browser. One ffmpeg encode copied to YouTube, X, Facebook, and Twitch.");
  return p;
}

function deployment() {
  const p = [];
  chrome(p, "04  /  05", "Deployment versus local state", "What deploy/terraform creates, and what stays on the machine.");
  legend(p, 114, ["HTTP", "HTTPS", "SMB", "OIDC", "OCI pull", "SSML"]);

  card(p, 28, 160, 760, 960, { fill: "#F7F8FA", stroke: "#C5CED6", sw: 1.75 });
  rect(p, 28, 160, 760, 52, { rx: 12, fill: "#3E4C59" });
  rect(p, 28, 190, 760, 22, { fill: "#3E4C59" });
  text(p, 48, 194, "Local · this machine", { size: 22, weight: 700, fill: "#FFFFFF" });

  const localNodes = [
    [220, "Browser", "The person running the studio"],
    [360, "Vite, React, Fluent UI", "HTTP · 127.0.0.1:5173"],
    [500, "FastAPI", "HTTP · port 8000 · the one process"],
  ];
  localNodes.forEach((node, index) => {
    card(p, 188, node[0], 440, 88, { shadow: true });
    text(p, 208, node[0] + 36, node[1], { size: 20, weight: 700 });
    text(p, 208, node[0] + 64, node[2], { size: 15, fill: "#3B4A5A" });
    if (index < localNodes.length - 1) {
      elbow(p, [[408, node[0] + 88], [408, localNodes[index + 1][0]]], { marker: "arrn", color: "#3E4C59" });
    }
  });
  protoMid(p, 408, 334, "HTTP", "ink");
  protoMid(p, 408, 474, "HTTP /api", "ink");

  card(p, 56, 680, 320, 180, { shadow: true });
  text(p, 76, 716, "Process memory", { size: 18, weight: 700 });
  lines(p, 76, 748, ["Match playback", "Studio session", "The encode", "Match log, until Cosmos"], {
    size: 15,
    fill: "#3B4A5A",
    lh: 24,
  });
  card(p, 400, 680, 340, 180, { shadow: true });
  text(p, 420, 716, ".data/", { size: 18, weight: 700 });
  lines(p, 420, 748, ["Broadcasts and studio", "Uploads, keys, reels", "Narration cache", "Agent switches"], {
    size: 15,
    fill: "#3B4A5A",
    lh: 24,
  });
  elbow(p, [[408, 588], [408, 640], [216, 640], [216, 680]], { color: "#3E4C59", marker: "arrn" });
  elbow(p, [[408, 640], [570, 640], [570, 680]], { color: "#3E4C59", marker: "arrn" });
  text(p, 56, 900, "Cosmos, calls, and a model stay off until you set them.", { size: 15, fill: "#3B4A5A" });
  text(p, 56, 932, "Narration is a template until a model is set.", { size: 15, fill: "#3B4A5A" });
  text(p, 56, 980, "Two processes on the machine. One of them owns the match.", {
    size: 15,
    weight: 700,
    fill: "#142033",
  });
  text(p, 56, 1048, "Nothing here is created by Terraform.", { size: 15, fill: "#5C6B7A" });

  card(p, 808, 160, 1724, 960, { fill: "#F5FAFF", stroke: "#0078D4", sw: 2 });
  iconImage(p, icon.rg, 828, 176, 32);
  text(p, 870, 198, "Resource group", { size: 22, weight: 700, fill: "#0B3A67" });
  text(p, 1100, 198, "deploy/terraform creates this boundary. Default region centralindia.", {
    size: 15,
    fill: "#3B4A5A",
  });

  const top = [
    [icon.logs, "Log Analytics", "Diagnostics", "30-day workspace"],
    [icon.registry, "Container Registry", "OCI pull", "Basic. Image kickstream."],
    [icon.storage, "Storage account", "Standard LRS", "TLS 1.2. Holds the share."],
    [icon.files, "Azure Files", "SMB", "Share data. Mounted at /data."],
  ];
  top.forEach((item, index) => {
    const x = 836 + index * 416;
    card(p, x, 248, 400, 108, { shadow: true });
    iconImage(p, item[0], x + 14, ySafe(262), 32);
    text(p, x + 54, 274, item[1], { size: 16, weight: 700 });
    proto(p, x + 54, 286, item[2], "blue");
    text(p, x + 16, 334, item[3], { size: 14, fill: "#3B4A5A" });
    elbow(p, [[x + 200, 356], [x + 200, 400]], { marker: "arr" });
  });

  card(p, 836, 400, 1664, 200, { fill: "#E8F3FC", stroke: "#0078D4", sw: 1.75 });
  iconImage(p, icon.containerEnv, 856, 418, 32);
  text(p, 898, 440, "Container Apps environment", { size: 16, weight: 700, fill: "#0B3A67" });
  card(p, 856, 468, 1624, 112, { fill: "#FFFFFF", stroke: "#0078D4", sw: 1.75, shadow: true });
  iconImage(p, icon.containerApps, 876, 492, 40);
  text(p, 930, 518, "Container App", { size: 22, weight: 700 });
  text(p, 1140, 518, "One replica", { size: 18, weight: 700, fill: "#0078D4" });
  text(p, 930, 550, "HTTPS ingress · FastAPI port 8000 · 2 vCPU · 4 GiB · min and max replicas 1", {
    size: 15,
    fill: "#3B4A5A",
  });
  proto(p, 1680, 500, "HTTPS", "blue");

  const bottom = [
    [icon.speech, "Speech", "HTTPS", "SSML in. MP3 out. SKU S0."],
    [icon.cosmos, "Cosmos DB", "HTTPS", "kickstream / match_log. Key /match_id."],
    [icon.acs, "Communication Services", "HTTPS", "Rooms and a VoIP token per seat."],
    [icon.appReg, "Entra app registration", "OIDC", "AzureADMyOrg. User.Read only."],
    [icon.entra, "Microsoft Entra ID", "OIDC", "Studio sign-in, in front of the app."],
  ];
  bottom.forEach((item, index) => {
    const x = 836 + index * 332;
    elbow(p, [[x + 150, 600], [x + 150, 648]], { marker: "arr" });
    card(p, x, 648, 320, 120, { shadow: true });
    iconImage(p, item[0], x + 12, 662, 32);
    text(p, x + 50, 684, item[1], { size: 14, weight: 700 });
    proto(p, x + 12, 704, item[2], "blue");
    text(p, x + 12, 748, item[3], { size: 13, fill: "#3B4A5A" });
  });

  card(p, 836, 792, 1664, 100, { fill: "#FBF8FE", stroke: "#5C2D91", dash: "7 5", sw: 1.75 });
  iconImage(p, icon.foundry, 856, 822, 36);
  text(p, 906, 846, "Microsoft Foundry", { size: 18, weight: 700, fill: "#5C2D91" });
  text(p, 1140, 846, "Terraform does not create Foundry", { size: 16, weight: 700, fill: "#5C2D91" });
  text(p, 906, 872, "An existing project the app signs into over HTTPS, with an Entra token, when you set its resource id.", {
    size: 14,
    fill: "#3B4A5A",
  });

  text(p, 836, 928, "Identity on the replica is system-assigned. It receives the Cosmos data role, and Azure AI User only if Foundry is set.", {
    size: 14,
    fill: "#3B4A5A",
  });
  text(p, 836, 964, "The Files mount is the share named data. Broadcasts, the studio, uploads, keys, and reels live there instead of .data/.", {
    size: 14,
    fill: "#3B4A5A",
  });
  text(p, 836, 1000, "Public ingress is HTTPS. WebSockets are accepted only from the host the app was reached at.", {
    size: 14,
    fill: "#3B4A5A",
  });
  text(p, 836, 1068, "Same process as local: match, studio, and encode. The platform restarts it if /api/health stops.", {
    size: 15,
    weight: 700,
    fill: "#0B3A67",
  });

  const rows = [
    ["State", "This machine", "Azure"],
    ["Match, studio, encode", "Process memory", "Process memory, one replica"],
    ["Broadcasts and keys", ".data/", "Azure Files, share data, at /data"],
    ["Match log", "Memory, unless Cosmos is set", "Cosmos DB kickstream / match_log"],
    ["Sign-in", "None, while it stays on your machine", "Entra app registration"],
  ];
  rows.forEach((row, index) => {
    const y = 1140 + index * 48;
    const head = index === 0;
    rect(p, 28, y, 2504, 48, { fill: head ? "#0B2545" : index % 2 ? "#FFFFFF" : "#E8F3FC" });
    const color = head ? "#FFFFFF" : "#142033";
    text(p, 48, y + 30, row[0], { size: 16, weight: 700, fill: color });
    text(p, 520, y + 30, row[1], { size: 16, weight: head ? 700 : 400, fill: color });
    text(p, 1400, y + 30, row[2], { size: 16, weight: head ? 700 : 400, fill: color });
  });

  footer(p, "deploy/terraform creates the Azure boundary. Microsoft Foundry stays an existing project.");
  return p;
}

function ySafe(value) {
  return value;
}

function agents() {
  const p = [];
  chrome(p, "05  /  05", "Match agents and narration", "Three teams publish. Four writers speak. A template if no model is set.");
  legend(p, 114, ["In-process", "Foundry HTTPS", "OIDC", "Template"]);

  const teams = [
    ["Match Reading", "#0B3A67", "#E8F3FC", "Reads the event", [
      ["Event Interpreter", "Every detection", "Third, flank, phase, danger. The other six agents read this event."],
      ["Tactical Analyst", "Once a minute", "Pressure, tempo, patterns. A control fact or a chaos fact when the swing says so."],
      ["Player Tracking Agent", "Every player", "Touches, shots, expected goals, heat map. The page can follow one player."],
    ]],
    ["Forecast", "#0E7A3D", "#E7F6EC", "Odds and the reason", [
      ["Prediction Agent", "Once a minute", "Win, draw, loss, the next chance, and what the side on the ball does next."],
      ["Explainability Agent", "When it matters", "English prose, Fan and Analyst. At most 20. A template when no model is set."],
    ]],
    ["Story", "#A74109", "#FFF4EC", "Picture and moments", [
      ["Visualization Agent", "The 3D pitch", "Ball flight and the player on it. Only those positions are known."],
      ["Highlights Agent", "Key moments", "Ranks them. Hidden events include a tactical foul and a ball won high."],
    ]],
  ];
  teams.forEach((team, index) => {
    const x = 28 + index * 844;
    rect(p, x, 160, 820, 520, { rx: 14, fill: team[2], stroke: team[1], sw: 2 });
    rect(p, x, 160, 820, 64, { rx: 14, fill: team[1] });
    rect(p, x, 196, 820, 28, { fill: team[1] });
    text(p, x + 20, 198, team[0], { size: 24, weight: 700, fill: "#FFFFFF" });
    text(p, x + 560, 198, team[3], { size: 14, fill: "#F4F7FB", anchor: "end" });
    const members = team[4];
    const gap = 12;
    const top = 240;
    const height = members.length === 3 ? (680 - 20 - top - gap * (members.length - 1)) / 3 : 132;
    members.forEach((agent, agentIndex) => {
      const y = top + agentIndex * (height + gap);
      card(p, x + 16, y, 788, height, { shadow: true });
      text(p, x + 32, y + 30, agent[0], { size: 20, weight: 700 });
      text(p, x + 772, y + 30, agent[1], { size: 14, weight: 700, fill: team[1], anchor: "end" });
      text(p, x + 32, y + 60, agent[2], { size: 15, fill: "#3B4A5A" });
      text(p, x + 32, y + height - 22, "Publishes onto the match stream", { size: 13, weight: 700, fill: team[1] });
    });
    if (members.length === 2) {
      const note = index === 1
        ? "Explainability is the only match agent that writes prose."
        : "Known positions are the ball and the player on it.";
      text(p, x + 32, 648, note, { size: 15, weight: 700, fill: team[1] });
    }
    elbow(p, [[x + 410, 680], [x + 410, 712]], { color: team[1], marker: index === 1 ? "arrg" : "arr" });
  });

  rect(p, 28, 712, 2504, 44, { rx: 8, fill: "#5C2D91" });
  text(p, 1280, 740, "One in-process stream  ·  findings join the gateway  ·  not a separate bus", {
    size: 16,
    weight: 700,
    fill: "#FFFFFF",
    anchor: "middle",
  });

  card(p, 28, 776, 2504, 250, { fill: "#FBF8FE", stroke: "#5C2D91", sw: 1.75 });
  text(p, 48, 812, "Four narration writers", { size: 22, weight: 700, fill: "#5C2D91" });
  text(p, 360, 812, "Microsoft Agent Framework. One shared client. Each item once per mode and language.", {
    size: 15,
    fill: "#3B4A5A",
  });
  const writers = [
    ["Commentator", "Key moment", "Fan wording, concurrent with the analyst writer."],
    ["Tactical Analyst", "Key moment", "Narration writer. Not the match agent."],
    ["Recap Writer", "Half and full time", "The break, and the final recap."],
    ["Localizer", "Spanish and Hindi", "Translates the item. The cost stays flat."],
  ];
  writers.forEach((writer, index) => {
    const x = 48 + index * 616;
    card(p, x, 836, 596, 164, { shadow: true });
    text(p, x + 20, 888, writer[0], { size: 20, weight: 700, fill: "#5C2D91" });
    proto(p, x + 330, 868, writer[1], "purple");
    text(p, x + 20, 960, writer[2], { size: 15, fill: "#3B4A5A" });
    if (index < 3) elbow(p, [[x + 596, 918], [x + 616, 918]], { color: "#5C2D91", marker: "arrp" });
  });

  elbow(p, [[640, 1026], [640, 1064]], { color: "#8A6116", marker: "arra" });
  elbow(p, [[1920, 1026], [1920, 1064]], { color: "#0078D4", marker: "arr" });

  card(p, 28, 1064, 1220, 320, { fill: "#FFF8EC", stroke: "#8A6116", sw: 2 });
  text(p, 52, 1108, "No model is set", { size: 26, weight: 700, fill: "#8A6116" });
  proto(p, 320, 1088, "in-process", "amber");
  lines(p, 52, 1152, [
    "Template fallback.",
    "The line is marked Scripted.",
    "Foundry endpoint empty, and KICKSTREAM_LLM_* empty.",
    "The seven agents still compute. Only the wording waits.",
    "Custom instructions wait too. Switched-off agents stay off.",
  ], { size: 18, fill: "#142033", lh: 32 });

  card(p, 1280, 1064, 1252, 320, { fill: "#F4F9FD", stroke: "#0078D4", sw: 2 });
  iconImage(p, icon.foundry, 1304, 1088, 40);
  text(p, 1356, 1116, "A model is set", { size: 26, weight: 700, fill: "#0B3A67" });
  proto(p, 1600, 1096, "HTTPS", "blue");
  lines(p, 1304, 1168, [
    "Microsoft Agent Framework writes.",
    "Foundry wins when both it and KICKSTREAM_LLM_* are set.",
    "The app signs in with Entra ID. Role: Azure AI User.",
    "A failed call falls back to the template.",
    "A replay is cached. Explainability stops at 20 lines.",
  ], { size: 18, fill: "#142033", lh: 32 });

  footer(p, "Explainability Agent is the only match agent that writes prose: English, at most 20 a match.");
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
const sequenceOrder = [
  "Match events into Ingest",
  "Normalized events to Interpret",
  "Stats to the match agents and Foundry narration",
  "Narration and findings to Render",
  "Overlay picture to the Gateway",
  "SSE and WebSocket to the browser",
];

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
  if (name === "sequence.html") {
    const joined = texts.join(" ");
    let at = -1;
    for (const phrase of sequenceOrder) {
      const found = joined.indexOf(phrase, at + 1);
      if (found <= at) throw new Error(`${name} order broken at ${phrase}`);
      at = found;
    }
  }
  writeFileSync(join(dir, name), html);
  console.log(`${name} ${html.length} chars`);
}

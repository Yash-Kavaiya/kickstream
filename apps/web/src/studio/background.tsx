import { Button, Field, makeStyles, Slider, Text, tokens } from "@fluentui/react-components";
import { DismissRegular } from "@fluentui/react-icons";
import { type ChangeEvent, useEffect, useState } from "react";
import type { Scene, SceneElement } from "../contracts";
import { imageUrl } from "./api";
import { CANVAS } from "./geometry";

/** League plates are original broadcast looks. They are not a club's or a league's crest. */
export const THEMES = [
  { id: "night", label: "Night", swatch: "linear-gradient(180deg, #1C3A58 0%, #0B1220 46%, #0C5A38 100%)" },
  { id: "premier", label: "Claret night", swatch: "linear-gradient(135deg, #8E1E40 0%, #163A5C 58%, #1E8F4A 100%)" },
  { id: "sun", label: "Sun gold", swatch: "linear-gradient(145deg, #E8A317, #C45A0A 55%, #1F7A32)" },
  { id: "bundesliga", label: "Red and black", swatch: "linear-gradient(115deg, #E10600 0 46%, #111111 46% 100%)" },
  { id: "serie", label: "Blue night", swatch: "linear-gradient(160deg, #1D4ED8, #0A2A6B 60%, #C5A46E)" },
  { id: "navy", label: "Navy gold", swatch: "linear-gradient(150deg, #163E72, #0A2244 50%, #D4AF37)" },
  { id: "european", label: "European night", swatch: "linear-gradient(180deg, #7C4DFF, #3B1D86 55%, #C9A227)" },
  { id: "super-league", label: "Super League", swatch: "linear-gradient(110deg, #00A7D6 0%, #123044 48%, #D0126B 100%)" },
  { id: "matchday", label: "Matchday pitch", swatch: "repeating-linear-gradient(90deg, #128A42 0 10px, #2BB86A 10px 20px)" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

interface Look {
  base: string;
  stand: string;
  pitch: string;
  rail: string;
  glow: string;
  line: string;
  wingL: string;
  wingR: string;
}

const LOOK: Record<ThemeId, Look> = {
  night: {
    base: "radial-gradient(ellipse at 50% 0%, #2A4A6E 0%, #122033 34%, #0B1220 72%, #070B12 100%)",
    stand: "linear-gradient(180deg, #1A3048, #0C1826)",
    pitch: "linear-gradient(180deg, #127A48, #0A4A2E 70%, #063222)",
    rail: "linear-gradient(90deg, transparent, rgba(186,220,255,0.95), transparent)",
    glow: "rgba(170, 214, 255, 0.72)",
    line: "rgba(255,255,255,0.9)",
    wingL: "linear-gradient(90deg, rgba(8,16,28,0.92), transparent)",
    wingR: "linear-gradient(270deg, rgba(8,16,28,0.92), transparent)",
  },
  premier: {
    base: "linear-gradient(115deg, #6E1630 0%, #8E1E40 30%, #163A5C 68%, #0C1E33 100%)",
    stand: "linear-gradient(180deg, #4A1024, #1A2740)",
    pitch: "linear-gradient(180deg, #24A056, #0E5C32)",
    rail: "linear-gradient(90deg, #6CABDD, #FFFFFF, #6CABDD)",
    glow: "rgba(140, 196, 240, 0.8)",
    line: "rgba(255,255,255,0.92)",
    wingL: "linear-gradient(90deg, rgba(110,22,48,0.96), transparent)",
    wingR: "linear-gradient(270deg, rgba(12,40,72,0.92), transparent)",
  },
  sun: {
    base: "linear-gradient(125deg, #4A1A08 0%, #C45A0A 28%, #E8A317 50%, #6E1C14 100%)",
    stand: "linear-gradient(180deg, #5C2410, #3A1408)",
    pitch: "linear-gradient(180deg, #4CAF3A, #1F7A32)",
    rail: "linear-gradient(90deg, #FDE68A, #FFFFFF, #FDBA74)",
    glow: "rgba(255, 228, 150, 0.85)",
    line: "rgba(255,255,255,0.94)",
    wingL: "linear-gradient(90deg, rgba(120,48,8,0.72), transparent)",
    wingR: "linear-gradient(270deg, rgba(90,16,16,0.72), transparent)",
  },
  bundesliga: {
    base: "linear-gradient(118deg, #E10600 0%, #E10600 38%, #141414 38.4%, #111111 100%)",
    stand: "linear-gradient(180deg, #2A0A0A, #141414)",
    pitch: "linear-gradient(180deg, #1C9A48, #0E5C30)",
    rail: "linear-gradient(90deg, #E10600, #FFFFFF, #E10600)",
    glow: "rgba(255, 90, 70, 0.62)",
    line: "rgba(255,255,255,0.92)",
    wingL: "linear-gradient(90deg, rgba(225,6,0,0.9), transparent)",
    wingR: "linear-gradient(270deg, rgba(0,0,0,0.88), transparent)",
  },
  serie: {
    base: "linear-gradient(160deg, #1D4ED8 0%, #0A2A6B 42%, #102040 78%, #2A2210 100%)",
    stand: "linear-gradient(180deg, #123E8A, #0A245C)",
    pitch: "linear-gradient(180deg, #14945A, #0C5C38)",
    rail: "linear-gradient(90deg, #1D4ED8, #E8C878, #1D4ED8)",
    glow: "rgba(232, 200, 120, 0.7)",
    line: "rgba(232, 200, 120, 0.95)",
    wingL: "linear-gradient(90deg, rgba(10,36,92,0.92), transparent)",
    wingR: "linear-gradient(270deg, rgba(42,34,16,0.8), transparent)",
  },
  navy: {
    base: "linear-gradient(150deg, #0A2244 0%, #1B4E86 38%, #0C2344 68%, #3A3010 100%)",
    stand: "linear-gradient(180deg, #12325C, #0A1C36)",
    pitch: "linear-gradient(180deg, #178A4C, #0B5230)",
    rail: "linear-gradient(90deg, #D4AF37, #FFF6D2, #D4AF37)",
    glow: "rgba(255, 214, 90, 0.75)",
    line: "rgba(255, 220, 120, 0.95)",
    wingL: "linear-gradient(90deg, rgba(8,24,48,0.92), transparent)",
    wingR: "linear-gradient(270deg, rgba(58,48,16,0.85), transparent)",
  },
  european: {
    base: "radial-gradient(ellipse at 50% 0%, #7C4DFF 0%, #3B1D86 42%, #16082E 100%)",
    stand: "linear-gradient(180deg, #3A1878, #1A0C40)",
    pitch: "linear-gradient(180deg, #1A9A52, #0C5A34)",
    rail: "linear-gradient(90deg, #C9A227, #F8E7A2, #C9A227)",
    glow: "rgba(196, 160, 255, 0.75)",
    line: "rgba(248, 231, 162, 0.95)",
    wingL: "linear-gradient(90deg, rgba(40,16,80,0.9), transparent)",
    wingR: "linear-gradient(270deg, rgba(40,16,80,0.9), transparent)",
  },
  "super-league": {
    base: "linear-gradient(105deg, #032033 0%, #00A7D6 32%, #123044 50%, #D0126B 76%, #3A0A22 100%)",
    stand: "linear-gradient(90deg, #033048, #5A1038)",
    pitch: "linear-gradient(180deg, #22B864, #0C6B3C)",
    rail: "linear-gradient(90deg, #00E5FF, #FFFFFF, #FF2D87)",
    glow: "rgba(0, 229, 255, 0.8)",
    line: "rgba(255,255,255,0.95)",
    wingL: "linear-gradient(90deg, rgba(0,200,255,0.62), transparent)",
    wingR: "linear-gradient(270deg, rgba(255,45,135,0.68), transparent)",
  },
  matchday: {
    base: "linear-gradient(180deg, #10281C 0%, #0E6B3A 20%, #1FA85A 58%, #0C4E2C 100%)",
    stand: "linear-gradient(180deg, #0A1A12, #145032)",
    pitch: "linear-gradient(180deg, #34C46E, #14944A 55%, #0B5A30)",
    rail: "linear-gradient(90deg, #FFFFFF, #D1FAE5, #FFFFFF)",
    glow: "rgba(255,255,255,0.7)",
    line: "rgba(255,255,255,0.96)",
    wingL: "linear-gradient(90deg, rgba(6,24,14,0.78), transparent)",
    wingR: "linear-gradient(270deg, rgba(6,24,14,0.78), transparent)",
  },
};

const KNOWN = new Set<string>(THEMES.map((theme) => theme.id));

export function themeId(value: unknown): ThemeId {
  return typeof value === "string" && KNOWN.has(value) ? value as ThemeId : "night";
}

/** The full-canvas plate. A normal picture is not one: it stays a widget you can move. */
export function isBackground(element: SceneElement): boolean {
  return element.type === "image" && element.props.role === "background";
}

function plateId(): string {
  return Math.random().toString(16).slice(2, 10);
}

/** Puts `patch` on the scene's plate, creating a full-canvas one when the scene has none. */
export function upsertBackground(elements: SceneElement[], patch: Record<string, unknown>): SceneElement[] {
  const current = elements.find(isBackground);
  if (!current) {
    const added: SceneElement = {
      id: plateId(), type: "image", x: 0, y: 0, width: CANVAS.width, height: CANVAS.height, layer: 0, visible: true,
      props: { role: "background", theme: "night", opacity: 1, fit: "cover", image_id: null, ...patch },
    };
    return [...elements, added];
  }
  return elements.map((element) => (element.id === current.id
    ? {
      ...element, x: 0, y: 0, width: CANVAS.width, height: CANVAS.height, visible: true,
      props: { ...element.props, role: "background", ...patch },
    }
    : element));
}

export function clearBackground(elements: SceneElement[]): SceneElement[] {
  return elements.filter((element) => !isBackground(element));
}

const LIGHTS = [0, 1, 2, 3, 4, 5, 6, 7];

function Stand({ look }: { look: Look }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "22%", background: look.stand }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 0.8px, transparent 1.3px)",
        backgroundSize: "18px 12px", opacity: 0.4,
      }} />
      <div style={{ position: "absolute", left: "7%", right: "7%", top: "30%", display: "flex", justifyContent: "space-between" }}>
        {LIGHTS.map((light) => (
          <span key={light} style={{
            width: 22, height: 22, borderRadius: "50%",
            background: `radial-gradient(circle, #FFFFFF 0%, ${look.glow} 46%, transparent 72%)`,
            boxShadow: `0 0 28px ${look.glow}`,
          }} />
        ))}
      </div>
    </div>
  );
}

function PitchCarpet({ look, tall }: { look: Look; tall: boolean }) {
  const mask = tall
    ? "linear-gradient(180deg, transparent 0%, #000 14%, #000 100%)"
    : "linear-gradient(180deg, transparent 0%, #000 30%, #000 100%)";
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0, height: tall ? "78%" : "46%",
      background: look.pitch, maskImage: mask, WebkitMaskImage: mask,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0 78px, rgba(0,0,0,0.14) 78px 156px)",
      }} />
      <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax meet" aria-hidden
        style={{ position: "absolute", left: "7%", right: "7%", top: "8%", width: "86%", height: "84%" }}>
        <g fill="none" stroke={look.line} strokeWidth="5">
          <rect x="24" y="24" width="1152" height="652" />
          <line x1="600" y1="24" x2="600" y2="676" />
          <circle cx="600" cy="350" r="96" />
          <rect x="24" y="176" width="156" height="348" />
          <rect x="24" y="258" width="64" height="184" />
          <rect x="1020" y="176" width="156" height="348" />
          <rect x="1112" y="258" width="64" height="184" />
          <path d="M180 230 A110 110 0 0 1 180 470" />
          <path d="M1020 230 A110 110 0 0 0 1020 470" />
          <path d="M24 56 A32 32 0 0 1 56 24" />
          <path d="M1144 24 A32 32 0 0 1 1176 56" />
          <path d="M24 644 A32 32 0 0 0 56 676" />
          <path d="M1144 676 A32 32 0 0 0 1176 644" />
        </g>
        <circle cx="600" cy="350" r="6" fill={look.line} />
        <circle cx="176" cy="350" r="5" fill={look.line} />
        <circle cx="1024" cy="350" r="5" fill={look.line} />
      </svg>
    </div>
  );
}

/** The scene's plate, behind every widget. Opacity fades the plate, never the widgets on it. */
export function SceneBackground({ props, dim = false }: { props: Record<string, unknown>; dim?: boolean }) {
  const theme = themeId(props.theme);
  const look = LOOK[theme];
  const opacity = typeof props.opacity === "number" ? Math.min(1, Math.max(0, props.opacity)) : 1;
  const imageId = typeof props.image_id === "string" && props.image_id ? props.image_id : null;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [imageId]);
  const showImage = imageId !== null && !broken;
  return (
    <div data-testid="scene-background" data-theme={theme} aria-hidden
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: dim ? 0.35 : 1 }}>
      <div style={{ position: "absolute", inset: 0, opacity: showImage ? 1 : opacity }}>
        <div style={{ position: "absolute", inset: 0, background: look.base }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 12%, ${look.glow}, transparent 56%)`, opacity: 0.8 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "15%", background: look.wingL }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "15%", background: look.wingR }} />
        <Stand look={look} />
        <div style={{
          position: "absolute", top: 0, left: "14%", width: "18%", height: "76%",
          background: `linear-gradient(180deg, ${look.glow}, transparent 82%)`,
          transform: "skewX(-16deg)", opacity: 0.34, filter: "blur(8px)",
        }} />
        <div style={{
          position: "absolute", top: 0, right: "16%", width: "16%", height: "68%",
          background: `linear-gradient(180deg, ${look.glow}, transparent 82%)`,
          transform: "skewX(14deg)", opacity: 0.28, filter: "blur(8px)",
        }} />
        <PitchCarpet look={look} tall={theme === "matchday"} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 22, background: look.rail }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 22, background: look.rail }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 46%, transparent 52%, rgba(0,0,0,0.38) 100%)" }} />
      </div>
      {showImage && (
        <img src={imageUrl(imageId)} alt="" onError={() => setBroken(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: props.fit === "contain" ? "contain" : "cover", opacity }} />
      )}
    </div>
  );
}

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: tokens.spacingHorizontalXS },
  swatch: {
    display: "flex", flexDirection: "column", alignItems: "stretch", gap: "4px", minWidth: 0, padding: "4px", cursor: "pointer",
    borderRadius: tokens.borderRadiusMedium, border: `2px solid transparent`, backgroundColor: "transparent", color: tokens.colorNeutralForeground1,
    fontFamily: "inherit", fontSize: tokens.fontSizeBase100, textAlign: "center",
    ":focus-visible": { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  chosen: { border: `2px solid ${tokens.colorBrandStroke1}` },
  chip: { height: "36px", borderRadius: tokens.borderRadiusMedium, boxShadow: tokens.shadow4 },
  label: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});

interface BackgroundPanelProps {
  scene: Scene;
  onChange(elements: SceneElement[]): void;
  onUpload(file: File): Promise<string | null>;
}

/** League plates, an uploaded picture and how strongly the plate shows. Widgets stay on top of it. */
export function BackgroundPanel({ scene, onChange, onUpload }: BackgroundPanelProps) {
  const styles = useStyles();
  const plate = scene.elements.find(isBackground);
  const theme = themeId(plate?.props.theme);
  const saved = typeof plate?.props.opacity === "number" ? plate.props.opacity : 1;
  const [opacity, setOpacity] = useState(saved);
  useEffect(() => setOpacity(saved), [saved]);

  const commitOpacity = () => {
    const next = Math.round(opacity * 100) / 100;
    if (plate && next === saved) return;
    onChange(upsertBackground(scene.elements, { opacity: next, theme }));
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const imageId = await onUpload(file);
    if (imageId) onChange(upsertBackground(scene.elements, { image_id: imageId, fit: "cover", theme }));
  };

  return (
    <div className={styles.panel}>
      <Text weight="semibold">Scene background</Text>
      <Text size={200}>League plates, or your own picture. The opacity is the plate, so the widgets stay readable.</Text>
      <div className={styles.grid} role="group" aria-label="Background themes">
        {THEMES.map((item) => (
          <button key={item.id} type="button"
            className={`${styles.swatch} ${(plate ? item.id === theme : item.id === "night") ? styles.chosen : ""}`}
            aria-pressed={plate ? item.id === theme : item.id === "night"} aria-label={item.label}
            onClick={() => onChange(upsertBackground(scene.elements, { theme: item.id }))}>
            <span className={styles.chip} style={{ background: item.swatch }} />
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
      <Field label="Background opacity" hint={`${Math.round(opacity * 100)}%`}>
        <Slider min={0} max={1} step={0.05} value={opacity} onChange={(_, data) => setOpacity(data.value)}
          input={{ "aria-valuetext": `${Math.round(opacity * 100)}%`, onPointerUp: commitOpacity, onKeyUp: commitOpacity, onBlur: commitOpacity }} />
      </Field>
      <Field label="Background image" hint="PNG, JPEG or WebP, up to 2 MB. It sits on the plate at the opacity above.">
        <input aria-label="Background image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event)} />
      </Field>
      <Button appearance="secondary" icon={<DismissRegular />} disabled={!plate} onClick={() => onChange(clearBackground(scene.elements))}>
        Clear background
      </Button>
    </div>
  );
}

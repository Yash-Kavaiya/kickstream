import { Button, Field, Input, makeStyles, Select, Slider, Switch, Text, Textarea, tokens } from "@fluentui/react-components";
import { DeleteRegular } from "@fluentui/react-icons";
import { type ChangeEvent, type KeyboardEvent, useEffect, useState } from "react";
import { ZOOM_RANGE } from "../../agents/Pitch3D";
import type { MatchStatus, Scene, SceneElement } from "../../contracts";
import { isBackground } from "../background";
import { CANVAS, clampRect, type Rect, rectOf } from "../geometry";
import { heldView } from "../widgets";

const NAME_MAX = 60;

const useStyles = makeStyles({
  panel: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

function TextField({ label, value, onCommit }: { label: string; value: string; onCommit(value: string): void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field label={label}>
      <Textarea value={draft} maxLength={200} onChange={(_, data) => setDraft(data.value)} onBlur={() => draft !== value && onCommit(draft)} />
    </Field>
  );
}

/** A slider that saves once it is let go of, not at every step on the way. */
function ViewSlider({ label, value, min, max, step, format, onCommit }: {
  label: string; value: number; min: number; max: number; step: number; format(value: number): string; onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => draft !== value && onCommit(draft);
  return (
    <Field label={label} hint={format(draft)}>
      <Slider min={min} max={max} step={step} value={draft} onChange={(_, data) => setDraft(data.value)}
        input={{ "aria-valuetext": format(draft), onPointerUp: commit, onKeyUp: commit, onBlur: commit }} />
    </Field>
  );
}

/** A number saved when the field is left or Enter is pressed, not at every keystroke. */
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit(value: number): void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Math.round(Number(draft));
    if (Number.isFinite(next) && next !== value) onCommit(next);
    else setDraft(String(value));
  };
  return (
    <Field label={label}>
      <Input type="number" value={draft} style={{ minWidth: 0 }} input={{ style: { minWidth: 0 } }} onChange={(_, data) => setDraft(data.value)} onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} />
    </Field>
  );
}

const SIZES = [
  { key: "small", label: "Small", share: 0.2 },
  { key: "medium", label: "Medium", share: 0.33 },
  { key: "large", label: "Large", share: 0.5 },
  { key: "full", label: "Full screen", share: 1 },
];
const PLACES = ["top-left", "top", "top-right", "left", "centre", "right", "bottom-left", "bottom", "bottom-right"] as const;
const PLACE_LABEL: Record<(typeof PLACES)[number], string> = {
  "top-left": "Top left", top: "Top", "top-right": "Top right", left: "Left", centre: "Centre", right: "Right",
  "bottom-left": "Bottom left", bottom: "Bottom", "bottom-right": "Bottom right",
};
const MARGIN = 40;

/** A preset size, `share` of the canvas width, keeping the element's shape; a circle stays square. Full screen fills the canvas. */
export function sizedRect(rect: Rect, share: number, square: boolean): Rect {
  if (share >= 1) return square ? clampRect({ x: (CANVAS.width - CANVAS.height) / 2, y: 0, width: CANVAS.height, height: CANVAS.height }) : { x: 0, y: 0, ...CANVAS };
  const width = Math.round((square ? CANVAS.height : CANVAS.width) * share / 20) * 20;
  const height = square ? width : Math.round(width * (rect.height / rect.width) / 20) * 20;
  const centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return clampRect({ x: Math.round(centre.x - width / 2), y: Math.round(centre.y - height / 2), width, height });
}

/** The element moved to a corner, an edge's middle or the centre of the canvas, a margin in from the edges. */
export function placedRect(rect: Rect, place: (typeof PLACES)[number]): Rect {
  const column = place.endsWith("left") || place === "left" ? 0 : place.endsWith("right") || place === "right" ? 2 : 1;
  const row = place.startsWith("top") ? 0 : place.startsWith("bottom") ? 2 : 1;
  const xs = [MARGIN, (CANVAS.width - rect.width) / 2, CANVAS.width - MARGIN - rect.width];
  const ys = [MARGIN, (CANVAS.height - rect.height) / 2, CANVAS.height - MARGIN - rect.height];
  return clampRect({ ...rect, x: Math.round(xs[column]), y: Math.round(ys[row]) });
}

/** Where the element is and how big: preset sizes and places, or exact pixels on the 1920 x 1080 canvas. */
function Placement({ element, onPlace }: { element: SceneElement; onPlace(rect: Rect): void }) {
  const rect = rectOf(element);
  const square = element.type === "cameras" && element.props.shape === "circle";
  const set = (key: keyof Rect) => (value: number) => onPlace(clampRect({ ...rect, [key]: value }));
  return (
    <>
      <Text weight="semibold">Size and place</Text>
      <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS }} role="group" aria-label="Size">
        {SIZES.map((size) => (
          <Button key={size.key} size="small" onClick={() => onPlace(sizedRect(rect, size.share, square))}>{size.label}</Button>
        ))}
      </div>
      <Field label="Move to">
        <Select value="" onChange={(_, data) => data.value && onPlace(placedRect(rect, data.value as (typeof PLACES)[number]))}>
          <option value="">Choose a place…</option>
          {PLACES.map((place) => (
            <option key={place} value={place}>{PLACE_LABEL[place]}</option>
          ))}
        </Select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: tokens.spacingHorizontalS }}>
        <NumberField label="X" value={rect.x} onCommit={set("x")} />
        <NumberField label="Y" value={rect.y} onCommit={set("y")} />
        <NumberField label="Width" value={rect.width} onCommit={(value) => onPlace(clampRect({ ...rect, width: value, height: square ? value : rect.height }))} />
        <NumberField label="Height" value={rect.height} onCommit={(value) => onPlace(clampRect({ ...rect, height: value, width: square ? value : rect.width }))} />
      </div>
    </>
  );
}

function SceneName({ scene, onRename }: { scene: Scene; onRename(sceneId: string, name: string): void }) {
  const [draft, setDraft] = useState(scene.name);
  useEffect(() => setDraft(scene.name), [scene.name]);
  const commit = () => {
    const name = draft.trim();
    if (name !== "" && name !== scene.name) onRename(scene.id, name);
    else setDraft(scene.name);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };
  return (
    <Field label="Scene name">
      <Input value={draft} maxLength={NAME_MAX} onChange={(_, data) => setDraft(data.value)} onBlur={commit} onKeyDown={onKeyDown} />
    </Field>
  );
}

interface InspectorProps {
  scene: Scene;
  selectedId: string | null;
  onChange(elements: SceneElement[]): void;
  onUpload(file: File): Promise<string | null>;
  /** The team sheets, for choosing the player a player card follows. */
  status?: MatchStatus | null;
  /** When given, the scene's name can be changed while no element is selected. */
  onRename?(sceneId: string, name: string): void;
}

/** The selected element's settings, or the scene's when nothing is selected. */
export function Inspector({ scene, selectedId, onChange, onUpload, status = null, onRename }: InspectorProps) {
  const styles = useStyles();
  const selected = scene.elements.find((element) => element.id === selectedId);

  const patch = (id: string, changes: Partial<SceneElement>) =>
    onChange(scene.elements.map((element) => (element.id === id ? { ...element, ...changes } : element)));
  const setProp = (element: SceneElement, key: string, value: unknown) => patch(element.id, { props: { ...element.props, [key]: value } });
  const players = status ? [...status.home.players, ...status.away.players] : [];
  const upload = async (element: SceneElement, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageId = await onUpload(file);
    if (imageId) setProp(element, "image_id", imageId);
  };

  if (!selected) {
    if (!onRename) return null;
    return (
      <div className={styles.panel}>
        <SceneName key={scene.id} scene={scene} onRename={onRename} />
        <Text size={200}>Select an element to change it.</Text>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {selected.type === "text" && (
        <>
          <TextField label="Text" value={String(selected.props.text ?? "")} onCommit={(value) => setProp(selected, "text", value)} />
          <Field label="Size">
            <Input type="number" min={12} max={200} value={String(selected.props.size ?? 48)} onChange={(_, data) => Number(data.value) >= 12 && setProp(selected, "size", Number(data.value))} />
          </Field>
          <Field label="Alignment">
            <Select value={String(selected.props.align ?? "center")} onChange={(_, data) => setProp(selected, "align", data.value)}>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </Select>
          </Field>
        </>
      )}
      {selected.type === "narration" && (
        <Field label="Lines">
          <Select value={String(selected.props.lines ?? 3)} onChange={(_, data) => setProp(selected, "lines", Number(data.value))}>
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </Select>
        </Field>
      )}
      {selected.type === "pitch" && (
        <Switch label="Pressure map" checked={selected.props.pressure !== false} onChange={(_, data) => setProp(selected, "pressure", data.checked)} />
      )}
      {selected.type === "chart" && (
        <Field label="Compare">
          <Select value={String(selected.props.metric ?? "overview")} onChange={(_, data) => setProp(selected, "metric", data.value)}>
            <option value="overview">Possession, shots and expected goals</option>
            <option value="possession">Possession</option>
            <option value="shots">Shots</option>
            <option value="xg">Expected goals</option>
            <option value="tactics">Tactics: pressure, tempo and field tilt</option>
          </Select>
        </Field>
      )}
      {selected.type === "graph" && (
        <Field label="Over time">
          <Select value={String(selected.props.metric ?? "momentum")} onChange={(_, data) => setProp(selected, "metric", data.value)}>
            <option value="momentum">Momentum</option>
            <option value="xg">Expected goals</option>
            <option value="win_probability">Win probability</option>
          </Select>
        </Field>
      )}
      {selected.type === "prediction" && (
        <Field label="Forecast">
          <Select value={String(selected.props.view ?? "outcome")} onChange={(_, data) => setProp(selected, "view", data.value)}>
            <option value="outcome">Who wins</option>
            <option value="next_goal">Who scores in the next ten minutes</option>
            <option value="next_action">What the side on the ball does next</option>
          </Select>
        </Field>
      )}
      {selected.type === "pitch3d" && (
        <>
          <Field label="Camera">
            <Select value={String(selected.props.camera ?? "auto")} onChange={(_, data) => setProp(selected, "camera", data.value)}>
              <option value="auto">Follow the play</option>
              <option value="broadcast">Broadcast view</option>
              <option value="tactical">Tactical view</option>
              <option value="attack_home">Behind the home attack</option>
              <option value="attack_away">Behind the away attack</option>
            </Select>
          </Field>
          <ViewSlider label="Zoom" value={Math.round(heldView(selected.props).zoom * 100)} min={ZOOM_RANGE[0] * 100} max={ZOOM_RANGE[1] * 100} step={5}
            format={(value) => `${value}%`} onCommit={(value) => setProp(selected, "zoom", value / 100)} />
          <ViewSlider label="Rotate" value={Math.round(heldView(selected.props).turn)} min={-75} max={75} step={1}
            format={(value) => `${value}°`} onCommit={(value) => setProp(selected, "turn", value)} />
          <ViewSlider label="Tilt" value={Math.round(heldView(selected.props).tilt)} min={-50} max={50} step={1}
            format={(value) => `${value}°`} onCommit={(value) => setProp(selected, "tilt", value)} />
          <Switch label="Follow the ball" checked={selected.props.follow_ball === true} onChange={(_, data) => setProp(selected, "follow_ball", data.checked)} />
        </>
      )}
      {selected.type === "player" && (
        <Field label="Player" hint={players.length === 0 ? "Start a match to choose a player." : undefined}>
          <Select value={typeof selected.props.player_id === "string" ? selected.props.player_id : ""} onChange={(_, data) => setProp(selected, "player_id", data.value || null)}>
            <option value="">Best rated so far</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>{player.number}. {player.name}</option>
            ))}
          </Select>
        </Field>
      )}
      {selected.type === "comments" && (
        <>
          <Field label="Comments shown">
            <Select value={String(selected.props.lines ?? 4)} onChange={(_, data) => setProp(selected, "lines", Number(data.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </Select>
          </Field>
          <Switch label="Only comments I have liked" checked={selected.props.liked_only === true} onChange={(_, data) => setProp(selected, "liked_only", data.checked)} />
        </>
      )}
      {selected.type === "superchat" && (
        <Field label="Superchats shown">
          <Select value={String(selected.props.lines ?? 3)} onChange={(_, data) => setProp(selected, "lines", Number(data.value))}>
            {[1, 2, 3, 4, 5, 6].map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </Select>
        </Field>
      )}
      {selected.type === "cameras" && (
        <>
          <Field label="Who">
            <Select value={selected.props.source === "me" ? "me" : selected.props.source === "guest" ? `guest-${typeof selected.props.slot === "number" ? selected.props.slot : 1}` : "all"}
              onChange={(_, data) => {
                const [source, slot] = data.value.split("-");
                const { source: _source, slot: _slot, ...rest } = selected.props;
                patch(selected.id, { props: source === "all" ? rest : source === "me" ? { ...rest, source } : { ...rest, source, slot: Number(slot) } });
              }}>
              <option value="all">Everyone on stage</option>
              <option value="me">Me (this computer)</option>
              {[1, 2, 3, 4].map((slot) => (
                <option key={slot} value={`guest-${slot}`}>Guest {slot}</option>
              ))}
            </Select>
          </Field>
          <Field label="Show" hint={selected.props.view === "audio" ? "The level moves for this computer's microphone on the program." : undefined}>
            <Select value={selected.props.view === "audio" ? "audio" : "video"} onChange={(_, data) => setProp(selected, "view", data.value)}>
              <option value="video">Camera</option>
              <option value="audio">Microphone</option>
            </Select>
          </Field>
          <Field label="Shape" hint="Circles: one round camera for each person, side by side">
            <Select value={selected.props.shape === "circle" || selected.props.shape === "frame" ? String(selected.props.shape) : "box"}
              onChange={(_, data) => {
                const props = { ...selected.props, shape: data.value };
                // A circle is drawn as large as fits, so one person's circle is made square to fill its element.
                const single = selected.props.source === "me" || selected.props.source === "guest";
                const side = Math.min(selected.width, selected.height);
                patch(selected.id, data.value === "circle" && single ? { props, width: side, height: side } : { props });
              }}>
              <option value="box">Rounded box</option>
              <option value="frame">Frame</option>
              <option value="circle">Circle</option>
            </Select>
          </Field>
          <Switch label="Name tags" checked={selected.props.names !== false} onChange={(_, data) => setProp(selected, "names", data.checked)} />
        </>
      )}
      {selected.type === "image" && !isBackground(selected) && (
        <>
          <Field label="Image file" hint="PNG, JPEG or WebP, up to 2 MB">
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(selected, event)} />
          </Field>
          <Field label="Fit">
            <Select value={String(selected.props.fit ?? "contain")} onChange={(_, data) => setProp(selected, "fit", data.value)}>
              <option value="contain">Show all of it</option>
              <option value="cover">Fill the box</option>
            </Select>
          </Field>
        </>
      )}
      {isBackground(selected) ? (
        <Text size={200}>Themes, the picture and opacity are under Scene background.</Text>
      ) : (
        <Placement element={selected} onPlace={(rect) => patch(selected.id, rect)} />
      )}
      <Button appearance="secondary" icon={<DeleteRegular />}
        onClick={() => onChange(scene.elements.filter((element) => element.id !== selected.id))}>
        Delete this element
      </Button>
    </div>
  );
}

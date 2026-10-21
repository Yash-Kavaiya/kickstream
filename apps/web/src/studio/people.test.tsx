import { createEvent, fireEvent, screen } from "@testing-library/react";
import { THIS_COMPUTER } from "../calls/thisComputer";
import { EMPTY } from "../stream/store";
import { element, scene, studio } from "../test/fixtures";
import { renderUi } from "../test/render";
import { DRAG_TYPE, droppedElement, elementLabel, libraryItem } from "./edit/ElementLibrary";
import { placedRect, sizedRect } from "./edit/Inspector";
import { type CameraTile, camerasFor, ElementView, type ProgramData } from "./elements";
import { SceneCanvas } from "./SceneCanvas";

const me: CameraTile = { id: THIS_COMPUTER, name: "Yash", acsId: null, present: true };
const ana: CameraTile = { id: "g1", name: "Ana Ruiz", acsId: "acs-1", present: true };
const ben: CameraTile = { id: "g2", name: "Ben Okafor", acsId: "acs-2", present: false };
const stage = [me, ana, ben];
const data = (over: Partial<ProgramData> = {}): ProgramData => ({ match: EMPTY, studio: studio(), now: 1000, language: "en", cameras: stage, ...over });

test("a cameras element follows everyone, this computer, or the guest in one place on stage", () => {
  expect(camerasFor(stage, {}).map((tile) => tile.id)).toEqual([THIS_COMPUTER, "g1", "g2"]);
  expect(camerasFor(stage, { source: "me" })).toEqual([me]);
  expect(camerasFor(stage, { source: "guest", slot: 2 })).toEqual([ben]);
  expect(camerasFor(stage, { source: "guest", slot: 3 })).toEqual([]);
});

test("the editor names each camera and microphone by whose it is", () => {
  expect(elementLabel(element({ type: "cameras", props: {} }))).toBe("Everyone's cameras");
  expect(elementLabel(element({ type: "cameras", props: { source: "me" } }))).toBe("My camera");
  expect(elementLabel(element({ type: "cameras", props: { source: "guest", slot: 2, view: "audio" } }))).toBe("Guest 2 microphone");
  expect(elementLabel(element({ type: "scorecard", props: {} }))).toBe("Score card");
});

test("one guest's camera is drawn in a frame", () => {
  renderUi(<ElementView element={element({ type: "cameras", props: { source: "guest", slot: 1, shape: "frame" } })} data={data()} />);
  const tiles = screen.getAllByTestId("camera-tile");
  expect(tiles.map((tile) => tile.dataset.person)).toEqual(["g1"]);
  expect(tiles[0].dataset.shape).toBe("frame");
});

test("a microphone element shows the name and a level, still where the sound cannot be measured", () => {
  renderUi(<ElementView element={element({ type: "cameras", props: { source: "guest", slot: 2, view: "audio" } })} data={data()} />);
  expect(screen.getByTestId("mic-tile").dataset.person).toBe("g2");
  expect(screen.getByText("Ben Okafor · away")).toBeTruthy();
  expect(screen.getByTestId("mic-level").dataset.level).toBe("");
  expect(screen.queryByTestId("camera-tile")).toBeNull();
});

test("each guest tile added follows the next guest on stage", () => {
  const first = libraryItem("guest-camera", [])!;
  expect(first.props).toMatchObject({ source: "guest", slot: 1 });
  const placed = droppedElement(first, [], { x: 960, y: 540 });
  expect(libraryItem("guest-camera", [placed])!.props).toMatchObject({ slot: 2 });
  expect(libraryItem("guest-mic", [placed])!.props).toMatchObject({ slot: 1, view: "audio" });
  expect(libraryItem("nothing", [])).toBeNull();
});

test("a dropped tile is centred where it was let go, inside the canvas", () => {
  const item = libraryItem("my-camera", [])!;
  expect(droppedElement(item, [], { x: 960, y: 540 })).toMatchObject({ x: 760, y: 340, width: 420, height: 420, visible: true });
  expect(droppedElement(item, [], { x: 1900, y: 1070 })).toMatchObject({ x: 1500, y: 660 });
});

test("dropping a library tile on the editor canvas reports it in canvas pixels", () => {
  const onDropItem = vi.fn();
  renderUi(<SceneCanvas scene={scene({ elements: [] })} data={data()} scale={0.5} editable onDropItem={onDropItem} />);
  const canvas = screen.getByTestId("scene-canvas");
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 960, height: 540, right: 970, bottom: 560, x: 10, y: 20, toJSON: () => ({}) });
  const transfer = { types: [DRAG_TYPE], getData: () => "my-mic", dropEffect: "none" };
  // jsdom's drag events carry neither a pointer position nor drag data, so both are set on the event.
  const drop = createEvent.drop(canvas);
  Object.defineProperties(drop, { dataTransfer: { value: transfer }, clientX: { value: 110 }, clientY: { value: 120 } });
  fireEvent(canvas, drop);
  expect(onDropItem).toHaveBeenCalledWith("my-mic", { x: 200, y: 200 });
});

test("size presets keep the shape and a circle square; places sit a margin in from the edges", () => {
  expect(sizedRect({ x: 600, y: 300, width: 640, height: 360 }, 0.5, false)).toEqual({ x: 440, y: 210, width: 960, height: 540 });
  expect(sizedRect({ x: 0, y: 0, width: 420, height: 420 }, 0.33, true)).toMatchObject({ width: 360, height: 360 });
  expect(sizedRect({ x: 0, y: 0, width: 420, height: 420 }, 1, false)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  expect(placedRect({ x: 0, y: 0, width: 400, height: 400 }, "bottom-right")).toEqual({ x: 1480, y: 640, width: 400, height: 400 });
  expect(placedRect({ x: 0, y: 0, width: 400, height: 400 }, "centre")).toEqual({ x: 760, y: 340, width: 400, height: 400 });
});

test("in the editor a camera following no one yet shows a stand-in in its shape", () => {
  renderUi(<ElementView element={element({ type: "cameras", props: { source: "guest", slot: 3, shape: "circle" } })} data={data({ preview: true })} />);
  const tile = screen.getByTestId("camera-tile");
  expect(tile.dataset.shape).toBe("circle");
  expect(screen.getByText("Guest 3")).toBeTruthy();
});

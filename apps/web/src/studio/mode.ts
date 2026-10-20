import type { Scene, Studio } from "../contracts";
import type { Mode } from "../i18n";

export function onAirScene(studio: Studio): Scene {
  return studio.scenes.find((scene) => scene.id === studio.active_scene_id) ?? studio.scenes[0];
}

/** The one commentary the program carries. Scenes do not choose their own. */
export function programMode(studio: Studio): Mode {
  return studio.settings.mode;
}

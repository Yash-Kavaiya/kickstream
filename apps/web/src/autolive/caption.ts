import type { AutoLive } from "../contracts";

/** In silence, a commentary line stays on screen this long. */
const CAPTION_S = 30;

/** The line under the picture: what is being spoken, or in silence the latest commentary for the screen on air. */
export function captionOf(doc: AutoLive | null, now: number, spoken: string | null, silent: boolean): string | null {
  if (spoken) return spoken;
  const commentary = doc?.commentary;
  if (!silent || !commentary || commentary.scene_id !== doc.scene_id || now - commentary.at > CAPTION_S) return null;
  return commentary.text;
}

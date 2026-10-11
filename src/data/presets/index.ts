import type { Story } from "@/lib/schemas";
import p0 from "./preset-kim-gimhae-kim.json";
import p1 from "./preset-lim-teochew.json";
import p2 from "./preset-murphy-leinster-wexford.json";

/** Built-in featured sagas (JSON in this folder, images in /public/presets). Regenerate with scripts/make-preset.mjs. */
export const PRESETS: Story[] = [p0, p1, p2] as Story[];

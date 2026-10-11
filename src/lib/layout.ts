import type { SheetFormat } from "./schemas";
import type { ImageSize } from "./openai";

/** Comic pages are drawn big so the lettering stays crisp when the reader zooms in. */
export const SHEET_SIZE: Record<SheetFormat, ImageSize> = {
  portrait: "1536x2304",
  landscape: "2304x1536",
};

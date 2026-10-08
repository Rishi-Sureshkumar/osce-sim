/** Every dialog in the app (see Overlay.tsx). e2e/dialogs.spec.ts needs an opener for each id. */
export const DIALOG_IDS = [
  "examine-menu",
  "maneuver-menu",
  "tool-chooser",
  "perform",
  "describe",
  "leave-confirm",
  "actions-menu",
  "tools-menu",
  "bed-hud",
  "practice-help",
  "finish",
  "command-palette",
] as const;
export type DialogId = (typeof DIALOG_IDS)[number];

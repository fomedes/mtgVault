/**
 * Background manifest (D14, Phase 8). The picker, the `BackgroundLayer`, and
 * the `PATCH /api/me/preferences` validation all read from this single list,
 * so adding a new background — including a real image wallpaper later — is one
 * entry here and nothing else.
 *
 * Built-in presets are pure CSS gradients (no image files, no third-party IP).
 * To add an image wallpaper, drop a WebP into `public/backgrounds/` and add an
 * entry with `kind: "image"` and `file: "/backgrounds/<name>.webp"` (recommended
 * ~2560×1440, < 400 KB; the layer dims/blurs it so it stays subtle).
 */
export interface BackgroundPreset {
  id: string;
  label: string;
  kind: "none" | "gradient" | "image";
  /** CSS `background` shorthand — used when kind === "gradient". */
  css?: string;
  /** Public path under /public — used when kind === "image". */
  file?: string;
  /** Optional attribution for image wallpapers. */
  credit?: string;
}

export const BACKGROUNDS: BackgroundPreset[] = [
  { id: "none", label: "None", kind: "none" },
  {
    id: "arcane",
    label: "Arcane",
    kind: "gradient",
    css: "radial-gradient(125% 90% at 50% -10%, oklch(0.5 0.16 290 / 0.55), transparent 60%), linear-gradient(180deg, oklch(0.32 0.1 285 / 0.5), transparent 75%)",
  },
  {
    id: "plains",
    label: "Plains",
    kind: "gradient",
    css: "radial-gradient(120% 90% at 50% -10%, oklch(0.85 0.1 90 / 0.5), transparent 60%), linear-gradient(180deg, oklch(0.7 0.08 80 / 0.35), transparent 75%)",
  },
  {
    id: "island",
    label: "Island",
    kind: "gradient",
    css: "radial-gradient(120% 90% at 50% -10%, oklch(0.55 0.14 245 / 0.55), transparent 60%), linear-gradient(180deg, oklch(0.34 0.09 250 / 0.45), transparent 75%)",
  },
  {
    id: "swamp",
    label: "Swamp",
    kind: "gradient",
    css: "radial-gradient(120% 90% at 50% -10%, oklch(0.4 0.08 320 / 0.55), transparent 60%), linear-gradient(180deg, oklch(0.26 0.05 320 / 0.5), transparent 75%)",
  },
  {
    id: "mountain",
    label: "Mountain",
    kind: "gradient",
    css: "radial-gradient(120% 90% at 50% -10%, oklch(0.55 0.18 35 / 0.5), transparent 60%), linear-gradient(180deg, oklch(0.34 0.11 30 / 0.45), transparent 75%)",
  },
  {
    id: "forest",
    label: "Forest",
    kind: "gradient",
    css: "radial-gradient(120% 90% at 50% -10%, oklch(0.5 0.13 150 / 0.5), transparent 60%), linear-gradient(180deg, oklch(0.32 0.08 155 / 0.45), transparent 75%)",
  },
  {
    id: "guildpact",
    label: "Guildpact",
    kind: "gradient",
    css: "linear-gradient(135deg, oklch(0.5 0.16 25 / 0.4), oklch(0.5 0.16 250 / 0.4) 50%, oklch(0.5 0.16 150 / 0.4)), radial-gradient(100% 80% at 50% 0%, oklch(0.6 0.12 300 / 0.35), transparent 65%)",
  },
  {
    id: "jace",
    label: "Jace",
    kind: "image",
    file: "/backgrounds/jace.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "karn",
    label: "Karn",
    kind: "image",
    file: "/backgrounds/karn.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "mana-base",
    label: "Mana Base",
    kind: "image",
    file: "/backgrounds/mana_base.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "nicol-bolas",
    label: "Nicol Bolas",
    kind: "image",
    file: "/backgrounds/nicole_bolas.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "serra-benevolent",
    label: "Serra Benevolent",
    kind: "image",
    file: "/backgrounds/serra_benevolent.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "gideon",
    label: "Gideon",
    kind: "image",
    file: "/backgrounds/gideon.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "hydra",
    label: "Hydra",
    kind: "image",
    file: "/backgrounds/hydra.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "liliana",
    label: "Liliana",
    kind: "image",
    file: "/backgrounds/liliana.webp",
    credit: "Wizards of the Coast",
  },
  {
    id: "serra-angel",
    label: "Serra Angel",
    kind: "image",
    file: "/backgrounds/serra_angel.webp",
    credit: "Wizards of the Coast",
  },
];

export const DEFAULT_BACKGROUND_ID = "none";

export const BACKGROUND_IDS: string[] = BACKGROUNDS.map((b) => b.id);

const BY_ID = new Map(BACKGROUNDS.map((b) => [b.id, b]));

export function isBackgroundId(id: string): boolean {
  return BY_ID.has(id);
}

export function getBackground(id?: string | null): BackgroundPreset {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_BACKGROUND_ID)!;
}

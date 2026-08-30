/**
 * Color tokens from docs/visual-design.md.
 *
 * The light values are the documented starting palette. They are NOT yet proof
 * of contrast compliance -- docs/visual-design.md requires every text/background
 * pairing to be verified with automated and manual checks before release.
 */

export type ColorTokens = {
  /** Main screen background. */
  canvas: string;
  /** Cards and sheets. */
  surface: string;
  /** Primary text. */
  ink: string;
  /** Secondary text. */
  mutedInk: string;
  /** Dividers and borders. */
  line: string;
  /** Primary actions. */
  accent: string;
  /** Selected states. */
  accentSoft: string;
  /** Confirmed/saved states. */
  positive: string;
  /** Focus indication. */
  focus: string;
};

export const lightColors: ColorTokens = {
  canvas: '#F7F3EA',
  surface: '#FFFDF8',
  ink: '#25241F',
  mutedInk: '#69665D',
  line: '#D8D1C3',
  accent: '#C75D3A',
  accentSoft: '#F2D8C9',
  positive: '#39745B',
  focus: '#1D64A8',
};

/**
 * Provisional dark theme. docs/visual-design.md requires a true dark theme
 * before release if the app follows the system appearance setting; these values
 * are a starting point and still need contrast verification.
 */
export const darkColors: ColorTokens = {
  canvas: '#16150F',
  surface: '#211F18',
  ink: '#F2EDE1',
  mutedInk: '#A8A395',
  line: '#3A362B',
  accent: '#E5825E',
  accentSoft: '#4A2C1D',
  positive: '#6FAE8F',
  focus: '#6FA8DC',
};

/**
 * Curated accent palette for per-pet accents. docs/visual-design.md requires
 * that accent is never the only indication of the active pet.
 */
export const petAccentPalette = [
  '#C75D3A',
  '#39745B',
  '#1D64A8',
  '#7A4B8F',
  '#A8632B',
  '#3F6E75',
] as const;

export type PetAccent = (typeof petAccentPalette)[number];

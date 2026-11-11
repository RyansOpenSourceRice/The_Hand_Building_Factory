export interface PaletteColor {
  name: string;
  hex: string;
}

export const FILAMENT_COLORS: readonly PaletteColor[] = [
  {name: 'Sage', hex: '#8a9a7b'},
  {name: 'Terracotta', hex: '#a85d4e'},
  {name: 'Slate', hex: '#6e7680'},
  {name: 'Bone', hex: '#e8e2d4'},
  {name: 'Navy', hex: '#3e5a78'},
  {name: 'Mustard', hex: '#c9a227'},
  {name: 'Burnt Orange', hex: '#c46a32'},
  {name: 'Petrol Teal', hex: '#3f7e7a'},
];

export type ThemeSlot = 'primary' | 'secondary' | 'tertiary';

const first = FILAMENT_COLORS[0];
export const FALLBACK_HEX: string = first?.hex ?? '#6e7680';

export const DEFAULT_THEME: Readonly<Record<ThemeSlot, number>> = {
  primary: 3,
  secondary: 2,
  tertiary: 0,
};

export function isValidColorIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) &&
      value >= 0 && value < FILAMENT_COLORS.length;
}

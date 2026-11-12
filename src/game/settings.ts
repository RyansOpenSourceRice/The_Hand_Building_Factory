import {DEFAULT_THEME, isValidColorIndex, type ThemeSlot} from './palette';

export type TurnMode = 'snap' | 'smooth';
export type SnapAngle = 30 | 45 | 90;

export type GameSettings = {
  turnMode: TurnMode;
  snapAngle: SnapAngle;
  themePrimary: number;
  themeSecondary: number;
  themeTertiary: number;
  muted: boolean;
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'hands-on-settings';
const DEFAULT_SETTINGS: GameSettings = {
  turnMode: 'snap',
  snapAngle: 45,
  themePrimary: DEFAULT_THEME.primary,
  themeSecondary: DEFAULT_THEME.secondary,
  themeTertiary: DEFAULT_THEME.tertiary,
  muted: false,
};
const ANGLE_CYCLE: readonly SnapAngle[] = [30, 45, 90];

const THEME_KEYS: Readonly<Record<ThemeSlot, keyof GameSettings>> = {
  primary: 'themePrimary',
  secondary: 'themeSecondary',
  tertiary: 'themeTertiary',
};

const MEMORY_STORAGE: StorageLike = {
  getItem: () => null,
  setItem: () => undefined,
};

function readStorage(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    return;
  }
}

function parseStored(raw: string | null): GameSettings {
  if (!raw) {
    return {...DEFAULT_SETTINGS};
  }
  try {
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const turnMode: TurnMode = parsed.turnMode === 'smooth' ? 'smooth' : 'snap';
    const snapAngle: SnapAngle =
        ANGLE_CYCLE.includes(parsed.snapAngle as SnapAngle) ?
        (parsed.snapAngle as SnapAngle) :
        DEFAULT_SETTINGS.snapAngle;
    const themePrimary = isValidColorIndex(parsed.themePrimary) ?
        parsed.themePrimary :
        DEFAULT_SETTINGS.themePrimary;
    const themeSecondary = isValidColorIndex(parsed.themeSecondary) ?
        parsed.themeSecondary :
        DEFAULT_SETTINGS.themeSecondary;
    const themeTertiary = isValidColorIndex(parsed.themeTertiary) ?
        parsed.themeTertiary :
        DEFAULT_SETTINGS.themeTertiary;
    const muted = typeof parsed.muted === 'boolean' ?
        parsed.muted :
        DEFAULT_SETTINGS.muted;
    return {
      turnMode,
      snapAngle,
      themePrimary,
      themeSecondary,
      themeTertiary,
      muted,
    };
  } catch {
    return {...DEFAULT_SETTINGS};
  }
}

export class SettingsStore {
  private data: GameSettings;
  private readonly storage: StorageLike;
  private readonly listeners: Array<(settings: GameSettings) => void> = [];

  constructor(storage?: StorageLike) {
    this.storage = storage ??
        (globalThis.localStorage as StorageLike | undefined) ??
        MEMORY_STORAGE;
    this.data = parseStored(readStorage(this.storage, STORAGE_KEY));
  }

  get(): GameSettings {
    return {...this.data};
  }

  cycleTurnMode(): void {
    this.apply({
      turnMode: this.data.turnMode === 'snap' ? 'smooth' : 'snap',
    });
  }

  cycleSnapAngle(): void {
    const index = ANGLE_CYCLE.indexOf(this.data.snapAngle);
    this.apply({snapAngle: ANGLE_CYCLE[(index + 1) % ANGLE_CYCLE.length]});
  }

  setTheme(slot: ThemeSlot, colorIndex: number): void {
    if (!isValidColorIndex(colorIndex)) {
      return;
    }
    this.apply({[THEME_KEYS[slot]]: colorIndex} as Partial<GameSettings>);
  }

  toggleMuted(): void {
    this.apply({muted: !this.data.muted});
  }

  onChange(listener: (settings: GameSettings) => void): void {
    this.listeners.push(listener);
  }

  private apply(patch: Partial<GameSettings>): void {
    this.data = {...this.data, ...patch};
    writeStorage(this.storage, STORAGE_KEY, JSON.stringify(this.data));
    for (const listener of this.listeners) {
      listener(this.get());
    }
  }
}

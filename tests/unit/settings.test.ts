import {describe, expect, it, vi} from 'vitest';
import {SettingsStore, type StorageLike} from '../../src/game/settings';
import {DEFAULT_THEME} from '../../src/game/palette';

const DEFAULTS = {
  turnMode: 'snap' as const,
  snapAngle: 45 as const,
  themePrimary: DEFAULT_THEME.primary,
  themeSecondary: DEFAULT_THEME.secondary,
  themeTertiary: DEFAULT_THEME.tertiary,
  muted: false,
};

class FakeStorage implements StorageLike {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('storage unavailable');
  }

  setItem(): void {
    throw new Error('storage unavailable');
  }
}

describe('SettingsStore', () => {
  it('falls back to defaults with no stored data', () => {
    const store = new SettingsStore(new FakeStorage());
    expect(store.get()).toEqual(DEFAULTS);
  });

  it('falls back to defaults on invalid JSON', () => {
    const storage = new FakeStorage();
    storage.setItem('hands-on-settings', '{not json');
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(DEFAULTS);
  });

  it('falls back to defaults on unknown values', () => {
    const storage = new FakeStorage();
    storage.setItem(
        'hands-on-settings',
        '{"turnMode":"spin","snapAngle":77,"themePrimary":99}',
    );
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual(DEFAULTS);
  });

  it('falls back to theme defaults on out-of-range theme colors', () => {
    const storage = new FakeStorage();
    storage.setItem(
        'hands-on-settings',
        '{"turnMode":"snap","snapAngle":45,' +
        '"themePrimary":-1,"themeSecondary":8,"themeTertiary":1.5}',
    );
    const store = new SettingsStore(storage);
    const current = store.get();
    expect(current.themePrimary).toBe(DEFAULT_THEME.primary);
    expect(current.themeSecondary).toBe(DEFAULT_THEME.secondary);
    expect(current.themeTertiary).toBe(DEFAULT_THEME.tertiary);
  });

  it('restores stored settings', () => {
    const storage = new FakeStorage();
    storage.setItem(
        'hands-on-settings',
        '{"turnMode":"smooth","snapAngle":90,"themePrimary":4}',
    );
    const store = new SettingsStore(storage);
    const current = store.get();
    expect(current.turnMode).toBe('smooth');
    expect(current.snapAngle).toBe(90);
    expect(current.themePrimary).toBe(4);
  });

  it('persists changes for the next session', () => {
    const storage = new FakeStorage();
    const store = new SettingsStore(storage);
    store.cycleSnapAngle();
    const reloaded = new SettingsStore(storage);
    expect(reloaded.get()).toEqual({...DEFAULTS, snapAngle: 90});
  });

  it('survives unavailable storage', () => {
    const store = new SettingsStore(new ThrowingStorage());
    expect(store.get()).toEqual(DEFAULTS);
    store.cycleTurnMode();
    expect(store.get()).toEqual({...DEFAULTS, turnMode: 'smooth'});
  });

  it('cycles turn mode between snap and smooth', () => {
    const store = new SettingsStore(new FakeStorage());
    store.cycleTurnMode();
    expect(store.get().turnMode).toBe('smooth');
    store.cycleTurnMode();
    expect(store.get().turnMode).toBe('snap');
  });

  it('cycles snap angle through 30, 45, 90', () => {
    const store = new SettingsStore(new FakeStorage());
    store.cycleSnapAngle();
    expect(store.get().snapAngle).toBe(90);
    store.cycleSnapAngle();
    expect(store.get().snapAngle).toBe(30);
    store.cycleSnapAngle();
    expect(store.get().snapAngle).toBe(45);
  });

  it('notifies listeners on change', () => {
    const store = new SettingsStore(new FakeStorage());
    const listener = vi.fn();
    store.onChange(listener);
    store.cycleTurnMode();
    expect(listener).toHaveBeenCalledWith({...DEFAULTS, turnMode: 'smooth'});
  });

  it('sets theme colors and persists them', () => {
    const storage = new FakeStorage();
    const store = new SettingsStore(storage);
    const listener = vi.fn();
    store.onChange(listener);
    store.setTheme('primary', 4);
    expect(store.get().themePrimary).toBe(4);
    expect(listener).toHaveBeenCalledTimes(1);
    const reloaded = new SettingsStore(storage);
    expect(reloaded.get().themePrimary).toBe(4);
  });

  it('ignores invalid theme color indexes', () => {
    const store = new SettingsStore(new FakeStorage());
    store.setTheme('tertiary', 8);
    store.setTheme('tertiary', -1);
    store.setTheme('tertiary', 2.5);
    expect(store.get().themeTertiary).toBe(DEFAULT_THEME.tertiary);
  });

  it('hands out copies so callers cannot mutate state', () => {
    const store = new SettingsStore(new FakeStorage());
    store.get().snapAngle = 30;
    expect(store.get().snapAngle).toBe(45);
  });

  it('starts with sound unmuted', () => {
    const store = new SettingsStore(new FakeStorage());
    expect(store.get().muted).toBe(false);
  });

  it('toggles muted and notifies listeners', () => {
    const store = new SettingsStore(new FakeStorage());
    const listener = vi.fn();
    store.onChange(listener);
    store.toggleMuted();
    expect(store.get().muted).toBe(true);
    expect(listener).toHaveBeenCalledWith({...DEFAULTS, muted: true});
    store.toggleMuted();
    expect(store.get().muted).toBe(false);
  });

  it('restores muted state for the next session', () => {
    const storage = new FakeStorage();
    const store = new SettingsStore(storage);
    store.toggleMuted();
    const reloaded = new SettingsStore(storage);
    expect(reloaded.get().muted).toBe(true);
  });

  it('falls back to unmuted when stored muted is not a boolean', () => {
    const storage = new FakeStorage();
    storage.setItem(
        'hands-on-settings',
        '{"turnMode":"snap","snapAngle":45,"muted":"loud"}',
    );
    const store = new SettingsStore(storage);
    expect(store.get().muted).toBe(false);
  });
});

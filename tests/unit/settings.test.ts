import {describe, expect, it, vi} from 'vitest';
import {SettingsStore, type StorageLike} from '../../src/game/settings';

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
    expect(store.get()).toEqual({turnMode: 'snap', snapAngle: 45});
  });

  it('falls back to defaults on invalid JSON', () => {
    const storage = new FakeStorage();
    storage.setItem('hands-on-settings', '{not json');
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual({turnMode: 'snap', snapAngle: 45});
  });

  it('falls back to defaults on unknown values', () => {
    const storage = new FakeStorage();
    storage.setItem(
        'hands-on-settings',
        '{"turnMode":"spin","snapAngle":77}',
    );
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual({turnMode: 'snap', snapAngle: 45});
  });

  it('restores stored settings', () => {
    const storage = new FakeStorage();
    storage.setItem(
        'hands-on-settings',
        '{"turnMode":"smooth","snapAngle":90}',
    );
    const store = new SettingsStore(storage);
    expect(store.get()).toEqual({turnMode: 'smooth', snapAngle: 90});
  });

  it('persists changes for the next session', () => {
    const storage = new FakeStorage();
    const store = new SettingsStore(storage);
    store.cycleSnapAngle();
    const reloaded = new SettingsStore(storage);
    expect(reloaded.get()).toEqual({turnMode: 'snap', snapAngle: 90});
  });

  it('survives unavailable storage', () => {
    const store = new SettingsStore(new ThrowingStorage());
    expect(store.get()).toEqual({turnMode: 'snap', snapAngle: 45});
    store.cycleTurnMode();
    expect(store.get()).toEqual({turnMode: 'smooth', snapAngle: 45});
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
    expect(listener).toHaveBeenCalledWith({
      turnMode: 'smooth',
      snapAngle: 45,
    });
  });

  it('hands out copies so callers cannot mutate state', () => {
    const store = new SettingsStore(new FakeStorage());
    store.get().snapAngle = 30;
    expect(store.get().snapAngle).toBe(45);
  });
});

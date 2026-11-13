import {describe, expect, it} from 'vitest';
import {
  HAND_ROOT,
  MODEL_SCALE,
  PART_DEFS,
  TOTAL_PARTS,
  TOTAL_SCREWS,
} from '../../src/game/handParts';

type Bounds = {min: [number, number, number]; max: [number, number, number]};

const localBounds: Record<string, Bounds> = {
  'palm.stl': {
    min: [-0.129706, -0.424907, -0.002329],
    max: [0.138731, -0.134103, 0.094830],
  },
  'finger.stl': {
    min: [0.069780, -0.179463, -0.036403],
    max: [0.128810, 0.180507, 0.032000],
  },
  'thumb-base.stl': {
    min: [0.025910, -0.401686, -0.025973],
    max: [0.232493, -0.248791, 0.075727],
  },
  'thumb-segments.stl': {
    min: [0.124593, -0.249345, -0.002235],
    max: [0.193944, -0.014057, 0.062850],
  },
  'upper-cover.stl': {
    min: [-0.136580, -0.424766, -0.092883],
    max: [0.137172, -0.110417, 0.057786],
  },
};

function worldBounds(id: string): Bounds {
  const def = PART_DEFS.find((entry) => entry.id === id);
  if (!def) {
    throw new Error(`missing part ${id}`);
  }
  if (!def.file) {
    const z = def.local.z;
    return {
      min: [def.local.x - 0.03, def.local.y - 0.055, z - 0.02],
      max: [def.local.x + 0.03, def.local.y + 0.055, z + 0.02],
    };
  }
  const base = localBounds[def.file];
  if (!base) {
    throw new Error(`missing bounds for ${def.file}`);
  }
  return {
    min: [
      base.min[0] + def.local.x,
      base.min[1] + def.local.y,
      base.min[2] + def.local.z,
    ],
    max: [
      base.max[0] + def.local.x,
      base.max[1] + def.local.y,
      base.max[2] + def.local.z,
    ],
  };
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
      a.min[1] <= b.max[1] && a.max[1] >= b.min[1] &&
      a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

describe('formal hand assembly model', () => {
  it('uses one shared 3x frame and places every original part', () => {
    expect(TOTAL_PARTS).toBe(21);
    expect(TOTAL_SCREWS).toBe(21);
    expect(MODEL_SCALE).toBeCloseTo(0.00313, 5);
    expect(HAND_ROOT.y).toBeCloseTo(1.4949, 4);
    for (const def of PART_DEFS) {
      expect(def.local.x).toBeGreaterThanOrEqual(-0.2);
      expect(def.local.x).toBeLessThanOrEqual(0.2);
      expect(def.screwOffsets).toHaveLength(def.screwCount);
      expect(def.screwNormals).toHaveLength(def.screwCount);
    }
  });

  it('puts the palm on the pedestal and the fingertips above it', () => {
    const palm = worldBounds('palm');
    const index = worldBounds('finger-index');
    expect(palm.min[1] + HAND_ROOT.y).toBeCloseTo(1.07, 2);
    expect(palm.max[1] + HAND_ROOT.y).toBeCloseTo(1.361, 2);
    expect(index.max[1] + HAND_ROOT.y).toBeCloseTo(1.675, 2);
    expect(index.min[1] + HAND_ROOT.y).toBeLessThan(
        palm.max[1] + HAND_ROOT.y + 0.03);
  });

  it('orders the four fingers across the palm', () => {
    const centers = ['finger-index', 'finger-middle', 'finger-ring',
      'finger-little'].map((id) => {
      const bounds = worldBounds(id);
      return (bounds.min[0] + bounds.max[0]) / 2;
    });
    for (let i = 1; i < centers.length; i++) {
      expect(centers[i]).toBeLessThan(centers[i - 1] ?? 0);
    }
    expect(centers[0]! - centers[3]!).toBeGreaterThan(0.16);
    expect(centers[0]! - centers[3]!).toBeLessThan(0.2);
  });

  it('keeps the thumb chain and cover attached to their hosts', () => {
    const palm = worldBounds('palm');
    const thumbBase = worldBounds('thumb-base');
    const thumbSegments = worldBounds('thumb-segments');
    const cover = worldBounds('upper-cover');
    expect(overlaps(palm, thumbBase)).toBe(true);
    expect(overlaps(thumbBase, thumbSegments)).toBe(true);
    expect(overlaps(palm, cover)).toBe(true);
  });

  it('keeps the hand inside the reach envelope with no scattered parts', () => {
    for (const def of PART_DEFS) {
      const bounds = worldBounds(def.id);
      const y0 = bounds.min[1] + HAND_ROOT.y;
      const y1 = bounds.max[1] + HAND_ROOT.y;
      expect(y0, def.id).toBeGreaterThan(0.95);
      expect(y1, def.id).toBeLessThan(1.8);
      expect(Math.abs(bounds.min[2])).toBeLessThan(0.16);
      expect(Math.abs(bounds.max[2])).toBeLessThan(0.16);
    }
  });

  it('keeps every screw inside its own mesh bounds', () => {
    for (const def of PART_DEFS) {
      const base = def.file ? localBounds[def.file] : null;
      if (!base) {
        continue;
      }
      def.screwOffsets.forEach((offset, index) => {
        expect(offset.x, `${def.id}-${index} x`).toBeGreaterThanOrEqual(
            base.min[0] - 0.001);
        expect(offset.x, `${def.id}-${index} x`).toBeLessThanOrEqual(
            base.max[0] + 0.001);
        expect(offset.y, `${def.id}-${index} y`).toBeGreaterThanOrEqual(
            base.min[1] - 0.001);
        expect(offset.y, `${def.id}-${index} y`).toBeLessThanOrEqual(
            base.max[1] + 0.001);
        expect(offset.z, `${def.id}-${index} z`).toBeGreaterThanOrEqual(
            base.min[2] - 0.001);
        expect(offset.z, `${def.id}-${index} z`).toBeLessThanOrEqual(
            base.max[2] + 0.001);
      });
    }
  });

  it('puts each finger screw on that finger, not a neighbour', () => {
    const fingers = PART_DEFS.filter((def) => def.id.startsWith('finger-'));
    for (const def of fingers) {
      const offset = def.screwOffsets[0];
      expect(offset).toBeDefined();
      const screwX = def.local.x + (offset?.x ?? 0);
      const distances = fingers.map((other) => {
        const bounds = worldBounds(other.id);
        const center = (bounds.min[0] + bounds.max[0]) / 2;
        return {id: other.id, distance: Math.abs(screwX - center)};
      });
      distances.sort((a, b) => a.distance - b.distance);
      expect(distances[0]?.id, def.id).toBe(def.id);
    }
  });

  it('seats the thumb hinge boss and pins in their mating parts', () => {
    const palm = worldBounds('palm');
    const thumbBase = worldBounds('thumb-base');
    const thumbSegments = worldBounds('thumb-segments');
    const boss = PART_DEFS.find((def) => def.id === 'thumb-hinge-boss');
    const pinBase = PART_DEFS.find((def) => def.id === 'thumb-pin-base');
    const pinTip = PART_DEFS.find((def) => def.id === 'thumb-pin-tip');
    expect(boss).toBeDefined();
    expect(pinBase).toBeDefined();
    expect(pinTip).toBeDefined();
    const inside = (point: Bounds, x: number, y: number, z: number) =>
      x >= point.min[0] && x <= point.max[0] &&
      y >= point.min[1] && y <= point.max[1] &&
      z >= point.min[2] && z <= point.max[2];
    const bossLocal = boss?.local ?? {x: 0, y: 0, z: 0};
    const basePin = pinBase?.local ?? {x: 0, y: 0, z: 0};
    const tipPin = pinTip?.local ?? {x: 0, y: 0, z: 0};
    expect(inside(palm, bossLocal.x, bossLocal.y, bossLocal.z)).toBe(true);
    expect(inside(thumbBase, basePin.x, basePin.y, basePin.z)).toBe(true);
    expect(inside(
        thumbSegments, tipPin.x, tipPin.y, tipPin.z)).toBe(true);
    expect(overlaps(palm, worldBounds('thumb-hinge-boss'))).toBe(true);
  });
});

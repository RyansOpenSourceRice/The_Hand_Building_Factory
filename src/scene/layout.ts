import {WALK_HALF} from '../input/locomotion';

export const BARRIER_HALF = WALK_HALF;
export const BARRIER_CLEARANCE = 0.8;
export const BARRIER_SEGMENT = 1.25;
export const CRATE_HALF = 0.4;

export const WAREHOUSE_CRATE_SPOTS: readonly [number, number, number][] = [
  [-7.6, 0.4, -6.4],
  [-8.5, 0.4, -6.9],
  [-7.7, 1.2, -6.2],
  [7.6, 0.4, -6.6],
  [8.5, 0.4, -6.1],
  [7.9, 1.2, -6.4],
  [7.6, 0.4, 6.0],
  [-7.6, 0.4, 6.4],
];

export const RACK_CENTERS: readonly [number, number][] = [
  [-13, -13], [-13, -17], [-13, -22],
  [13, -13], [13, -17], [13, -22],
];
export const RACK_LOCAL_HALF = {x: 0.55, z: 1.45};

export const FORKLIFT_MOVING = {
  x: 10.2,
  zStart: -10.4,
  zEnd: -18,
} as const;
export const FORKLIFT_PARKED = {x: -10.2, z: -18.5} as const;
export const FORKLIFT_HALF = {x: 0.62, z: 1.75};

export const ROBOT_BASES: readonly [number, number][] = [
  [-6, -26.5], [0, -26.5], [6, -26.5], [9, -21], [-9, -21],
];
export const ROBOT_HALF = 0.5;

export type Footprint = {x: number; z: number; hx: number; hz: number};

export function overlaps2d(a: Footprint, b: Footprint): boolean {
  return Math.abs(a.x - b.x) <= a.hx + b.hx &&
      Math.abs(a.z - b.z) <= a.hz + b.hz;
}

export function forkliftSweep(): Footprint[] {
  const lane = FORKLIFT_MOVING;
  const zMin = Math.min(lane.zStart, lane.zEnd);
  const zMax = Math.max(lane.zStart, lane.zEnd);
  const sweep: Footprint[] = [];
  for (let z = zMin; z <= zMax + 1e-6; z += 0.25) {
    sweep.push({x: lane.x, z, hx: FORKLIFT_HALF.x, hz: FORKLIFT_HALF.z});
  }
  sweep.push({
    x: FORKLIFT_PARKED.x,
    z: FORKLIFT_PARKED.z,
    hx: FORKLIFT_HALF.x,
    hz: FORKLIFT_HALF.z,
  });
  return sweep;
}

export function forkliftClearanceIssues(): string[] {
  const racks = RACK_CENTERS.map(([x, z]) => ({
    x,
    z,
    hx: RACK_LOCAL_HALF.x,
    hz: RACK_LOCAL_HALF.z,
  }));
  const robots = ROBOT_BASES.map(([x, z]) => ({
    x,
    z,
    hx: ROBOT_HALF,
    hz: ROBOT_HALF,
  }));
  const issues: string[] = [];
  forkliftSweep().forEach((footprint, index) => {
    for (const rack of racks) {
      if (overlaps2d(footprint, rack)) {
        issues.push(`forklift ${index} hits rack ${rack.x},${rack.z}`);
      }
    }
    for (const robot of robots) {
      if (overlaps2d(footprint, robot)) {
        issues.push(`forklift ${index} hits robot ${robot.x},${robot.z}`);
      }
    }
  });
  return issues;
}

export function crateClearanceIssues(): string[] {
  const limit = BARRIER_HALF + BARRIER_CLEARANCE;
  return WAREHOUSE_CRATE_SPOTS.filter(([x, , z]) =>
    Math.abs(x) - CRATE_HALF < limit &&
    Math.abs(z) - CRATE_HALF < limit,
  ).map(([x, y, z]) => `crate ${x},${y},${z} inside clearance`);
}

import {describe, expect, it} from 'vitest';
import {
  BARRIER_CLEARANCE,
  BARRIER_HALF,
  CRATE_HALF,
  FORKLIFT_PARKED,
  FORKLIFT_MOVING,
  FORKLIFT_PARKED_YAW,
  HALL_INNER,
  crateClearanceIssues,
  forkliftClearanceIssues,
  forkliftFootprint,
  forkliftWallIssues,
} from '../../src/scene/layout';

describe('warehouse layout clearance', () => {
  it('keeps every crate out of the barrier and player clearance', () => {
    expect(crateClearanceIssues()).toEqual([]);
    for (const issue of crateClearanceIssues()) {
      expect(issue).toBe('');
    }
  });

  it('keeps the forklift sweep clear of racks and robot arms', () => {
    expect(forkliftClearanceIssues()).toEqual([]);
  });

  it('keeps every forklift pose inside the hall walls', () => {
    expect(forkliftWallIssues()).toEqual([]);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const half = forkliftFootprint(0, 0, yaw);
      expect(half.hx).toBeGreaterThan(0);
      expect(half.hz).toBeGreaterThan(0);
    }
    const parked = forkliftFootprint(
        FORKLIFT_PARKED.x, FORKLIFT_PARKED.z, FORKLIFT_PARKED_YAW);
    expect(parked.x - parked.hx).toBeGreaterThan(-HALL_INNER.halfWidth);
    expect(parked.x + parked.hx).toBeLessThan(HALL_INNER.halfWidth);
  });

  it('uses a forward-and-reverse lane without flipping', () => {
    expect(FORKLIFT_MOVING.zStart).toBeGreaterThan(FORKLIFT_MOVING.zEnd);
    expect(FORKLIFT_PARKED.x).toBeLessThan(0);
    expect(BARRIER_CLEARANCE).toBeGreaterThan(CRATE_HALF);
    expect(BARRIER_HALF).toBeGreaterThan(0);
  });
});

import {describe, expect, it} from 'vitest';
import {
  BARRIER_CLEARANCE,
  BARRIER_HALF,
  CRATE_HALF,
  FORKLIFT_PARKED,
  FORKLIFT_MOVING,
  crateClearanceIssues,
  forkliftClearanceIssues,
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

  it('uses a forward-and-reverse lane without flipping', () => {
    expect(FORKLIFT_MOVING.zStart).toBeGreaterThan(FORKLIFT_MOVING.zEnd);
    expect(FORKLIFT_PARKED.x).toBeLessThan(0);
    expect(BARRIER_CLEARANCE).toBeGreaterThan(CRATE_HALF);
    expect(BARRIER_HALF).toBeGreaterThan(0);
  });
});

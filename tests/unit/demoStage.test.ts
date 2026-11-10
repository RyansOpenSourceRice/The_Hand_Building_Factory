import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {DemoStage} from '../../src/game/demoStage';

describe('DemoStage undo and redo', () => {
  let engine: NullEngine;
  let scene: Scene;
  let stage: DemoStage;
  let statuses: string[];

  const placePart = () => {
    stage.startGrab('xr');
    stage.moveGrabbed(stage.ghost.position);
    stage.endGrab('xr');
  };

  const dropPartAt = (pos: Vector3) => {
    stage.startGrab('xr');
    stage.moveGrabbed(pos);
    stage.endGrab('xr');
  };

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    scene.activeCamera = new FreeCamera('cam', Vector3.Zero(), scene);
    stage = new DemoStage(scene, {pedestalTop: 1});
    statuses = [];
    stage.onStatus = (text) => statuses.push(text);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('snaps, then undo unplaces and redo re-places', () => {
    placePart();
    expect(stage.snap.isComplete).toBe(true);
    expect(stage.ghost.isEnabled()).toBe(false);

    stage.undo();
    expect(stage.snap.isComplete).toBe(false);
    expect(stage.ghost.isEnabled()).toBe(true);
    expect(statuses.at(-1)).toBe('Undo.');

    stage.redo();
    expect(stage.snap.isComplete).toBe(true);
    expect(stage.ghost.isEnabled()).toBe(false);
    expect(statuses.at(-1)).toBe('Redo.');
  });

  it('reports nothing to undo on a fresh stage', () => {
    stage.undo();
    expect(statuses.at(-1)).toBe('Nothing to undo.');
    expect(stage.snap.isComplete).toBe(false);
  });

  it('reports nothing to redo without a prior undo', () => {
    stage.redo();
    expect(statuses.at(-1)).toBe('Nothing to redo.');
  });

  it('commits a drop so undo restores the unplaced state', () => {
    const away = new Vector3(2, 2, 2);
    dropPartAt(away);
    expect(stage.snap.isComplete).toBe(false);
    expect(stage.part.position.x).toBeCloseTo(2, 2);

    stage.undo();
    expect(stage.snap.isComplete).toBe(false);
    expect(statuses.at(-1)).toBe('Undo.');
  });

  it('resets an unplaced part and lets undo restore the drop', () => {
    const away = new Vector3(2, 2, 2);
    dropPartAt(away);
    expect(stage.part.position.x).toBeCloseTo(2, 2);

    stage.reset();
    expect(statuses.at(-1)).toContain('Part returned');
    stage.undo();
    expect(statuses.at(-1)).toBe('Undo.');
    expect(stage.snap.isComplete).toBe(false);
  });

  it('blocks undo while the part is carried', () => {
    stage.startGrab('xr');
    stage.undo();
    expect(statuses.at(-1)).toBe('Finish carrying the part first.');
    expect(stage.snap.isComplete).toBe(false);
  });

  it('clears the redo stack on a new action', () => {
    placePart();
    stage.undo();
    dropPartAt(new Vector3(2, 2, 2));
    stage.redo();
    expect(statuses.at(-1)).toBe('Nothing to redo.');
    expect(stage.snap.isComplete).toBe(false);
  });
});

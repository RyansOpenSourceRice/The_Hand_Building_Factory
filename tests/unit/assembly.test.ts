import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AssemblyStage} from '../../src/game/assembly';
import {
  PRINTER_BED_TOP,
  PRINTER_HOME,
  type PartDef,
} from '../../src/game/handParts';

const boxProvider = (def: PartDef, scene: Scene): Mesh =>
  MeshBuilder.CreateBox(`part:${def.id}`, {size: 0.1}, scene);

describe('AssemblyStage', () => {
  let engine: NullEngine;
  let scene: Scene;
  let stage: AssemblyStage;
  let statuses: string[];

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    scene.activeCamera = new FreeCamera('cam', Vector3.Zero(), scene);
    stage = new AssemblyStage(scene, boxProvider);
    statuses = [];
    stage.onStatus = (text) => statuses.push(text);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  const grabTo = (pos: Vector3) => {
    stage.startGrab('xr');
    stage.moveGrabbed(pos);
    stage.endGrab('xr');
  };

  const driveAll = (target: AssemblyStage = stage) => {
    for (let guard = 0; guard < 20; guard++) {
      const site = target.screwSites()[0];
      if (!site) {
        return;
      }
      target.driveTick(2, site, true, 'xr');
    }
  };

  it('starts on the palm as the only grab candidate', () => {
    expect(stage.currentIndex).toBe(0);
    const palm = stage.currentPart;
    expect(stage.isGrabCandidate(palm)).toBe(true);
    const next = scene.getMeshByName('part:servo-base') as Mesh;
    expect(stage.isGrabCandidate(next)).toBe(false);
  });

  it('holds the queue while screws are pending', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    expect(stage.currentIndex).toBe(0);
    expect(stage.screwSites()).toHaveLength(4);
    expect(statuses.at(-1)).toContain('mounted');
  });

  it('advances the queue after driving all screws', () => {
    const palm = stage.currentPart;
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    expect(stage.currentIndex).toBe(1);
    const servo = stage.currentPart;
    expect(stage.isGrabCandidate(servo)).toBe(true);
    expect(stage.isGrabCandidate(palm)).toBe(false);
    expect(statuses.join(' ')).toContain('Next part');
  });

  it('does not advance on a missed drop', () => {
    grabTo(new Vector3(2, 2, 2));
    expect(stage.currentIndex).toBe(0);
    expect(stage.currentPart.position.x).toBeCloseTo(2, 2);
  });

  it('resets the current part home', () => {
    const palm = stage.currentPart;
    const home = palm.position.clone();
    grabTo(new Vector3(2, 2, 2));
    stage.reset();
    expect(statuses.at(-1)).toContain('returned');
    expect(stage.currentIndex).toBe(0);
    expect(palm.isEnabled()).toBe(true);
    expect(home.x).toBeCloseTo(PRINTER_HOME.x, 2);
  });

  it('undo reverts a snap within the current part', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    expect(stage.currentIndex).toBe(1);
    stage.undo();
    expect(stage.currentIndex).toBe(0);
    const palm = stage.currentPart;
    expect(palm.isEnabled()).toBe(true);
    expect(statuses.at(-1)).toBe('Undo.');
  });

  it('blocks undo while carrying', () => {
    stage.startGrab('xr');
    stage.undo();
    expect(statuses.at(-1)).toBe('Finish carrying the part first.');
  });

  it('reports nothing to undo on a fresh stage', () => {
    stage.undo();
    expect(statuses.at(-1)).toBe('Nothing to undo.');
    stage.redo();
    expect(statuses.at(-1)).toBe('Nothing to redo.');
  });

  it('reports part info with id and position', () => {
    const infos: string[] = [];
    stage.onPartInfo = (info) => infos.push(info);
    grabTo(new Vector3(1, 1, 1));
    expect(infos.at(-1)).toMatch(/^palm:1\.00,1\.00,1\.00$/);
  });

  it('reports progress on completion of each part', () => {
    const progress: Array<[number, number]> = [];
    stage.onProgress = (done, total) => progress.push([done, total]);
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    expect(progress.at(-1)).toEqual([1, 13]);
  });

  it('undo reverts a driven screw', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    const sites = stage.screwSites();
    stage.driveTick(2, sites[0] ?? null, true, 'xr');
    stage.driveTick(2, stage.screwSites()[0] ?? null, true, 'xr');
    expect(stage.screwSites()).toHaveLength(2);
    stage.undo();
    expect(stage.screwSites()).toHaveLength(3);
    expect(statuses.at(-1)).toBe('Undo.');
  });

  it('does not drive screws while a part is carried', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    stage.startGrab('xr');
    expect(stage.screwSites()).toHaveLength(0);
    stage.driveTick(2, new Vector3(0, 1.2, 0.1), true, 'xr');
    stage.moveGrabbed(ghost.position);
    expect(stage.screwSites()).toHaveLength(0);
    stage.endGrab('xr');
    expect(stage.screwSites()).toHaveLength(4);
  });

  it('spawns parts resting on their source machine', () => {
    const quiet = new AssemblyStage(scene, boxProvider, true);
    const palm = quiet.currentPart;
    expect(palm.position.x).toBeCloseTo(PRINTER_HOME.x, 2);
    expect(palm.position.y).toBeCloseTo(PRINTER_BED_TOP + 0.055, 2);
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    quiet.startGrab('xr');
    quiet.moveGrabbed(ghost.position);
    quiet.endGrab('xr');
    driveAll(quiet);
    const servo = quiet.currentPart;
    expect(servo.position.x).toBeCloseTo(0.62, 2);
    expect(servo.position.y).toBeCloseTo(1.185, 2);
  });

  it('holds the spawn offset until the scene renders', () => {
    const y = stage.currentPart.position.y;
    expect(y).toBeCloseTo(PRINTER_BED_TOP + 0.095, 2);
  });
});

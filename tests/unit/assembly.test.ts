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
    const next = stage.currentPart;
    expect(stage.isGrabCandidate(next)).toBe(true);
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
    expect(progress.at(-1)).toEqual([1, 25]);
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
    const palmGhost = scene.getMeshByName('ghost:palm') as Mesh;
    quiet.startGrab('xr');
    quiet.moveGrabbed(palmGhost.position);
    quiet.endGrab('xr');
    driveAll(quiet);
    expect(quiet.currentIndex).toBe(1);
    const wristGhost = scene.getMeshByName('ghost:wrist-plate') as Mesh;
    quiet.startGrab('xr');
    quiet.moveGrabbed(wristGhost.position);
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

  it('reports zero undo and redo depth on a fresh stage', () => {
    expect(stage.undoDepth()).toBe(0);
    expect(stage.redoDepth()).toBe(0);
  });

  it('grows undo depth as screws are driven', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    expect(stage.undoDepth()).toBeGreaterThanOrEqual(4);
    expect(stage.redoDepth()).toBe(0);
  });

  it('undoMany ignores broken counts', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    const depth = stage.undoDepth();
    stage.undoMany(Number.NaN);
    stage.undoMany(-5);
    stage.undoMany(0);
    expect(stage.undoDepth()).toBe(depth);
  });

  it('undoMany applies floored counts', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    const depth = stage.undoDepth();
    stage.undoMany(2.7);
    expect(stage.undoDepth()).toBe(depth - 2);
    expect(stage.screwSites()).toHaveLength(2);
    expect(statuses.at(-1)).toBe('Undone 2 steps.');
  });

  it('undoMany with a huge count undoes everything available', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    const depth = stage.undoDepth();
    stage.undoMany(9999);
    expect(stage.undoDepth()).toBe(0);
    expect(stage.currentPart.isEnabled()).toBe(true);
    expect(statuses.at(-1)).toBe(`Undone ${depth} steps.`);
  });

  it('redoMany with a huge count redoes everything available', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    stage.undoMany(9999);
    const depth = stage.redoDepth();
    stage.redoMany(9999);
    expect(stage.redoDepth()).toBe(0);
    expect(stage.undoDepth()).toBe(depth);
    expect(stage.screwSites()).toHaveLength(0);
    expect(statuses.at(-1)).toBe(`Redone ${depth} steps.`);
  });

  it('redoMany ignores broken counts', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    stage.undoMany(2);
    const depth = stage.redoDepth();
    stage.redoMany(Number.NaN);
    stage.redoMany(-1.5);
    expect(stage.redoDepth()).toBe(depth);
  });

  it('blocks undoMany while carrying', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    const depth = stage.undoDepth();
    stage.startGrab('xr');
    stage.undoMany(5);
    expect(stage.undoDepth()).toBe(depth);
    expect(statuses.at(-1)).toBe('Finish carrying the part first.');
  });

  it('restart returns every part home and rewinds progress', () => {
    const progress: Array<[number, number]> = [];
    stage.onProgress = (done, total) => progress.push([done, total]);
    const palm = stage.currentPart;
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(ghost.position);
    driveAll();
    expect(stage.currentIndex).toBe(1);
    const wrist = scene.getMeshByName('part:wrist-plate') as Mesh;
    expect(wrist.isEnabled()).toBe(true);
    stage.restart();
    expect(progress.at(-1)).toEqual([0, 25]);
    expect(stage.currentIndex).toBe(0);
    expect(stage.currentPart).toBe(palm);
    expect(palm.position.x).toBeCloseTo(PRINTER_HOME.x, 2);
    expect(palm.isEnabled()).toBe(true);
    expect(wrist.isEnabled()).toBe(false);
    expect(stage.isGrabCandidate(palm)).toBe(true);
    expect(statuses.at(-1)).toContain('Starting over');
  });

  it('restart clears undo and redo history', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    grabTo(new Vector3(2, 2, 2));
    grabTo(ghost.position);
    driveAll();
    expect(stage.undoDepth()).toBeGreaterThan(0);
    stage.restart();
    expect(stage.undoDepth()).toBe(0);
    expect(stage.redoDepth()).toBe(0);
    stage.undoMany(9999);
    expect(stage.currentPart.position.x).toBeCloseTo(PRINTER_HOME.x, 2);
  });

  it('blocks restart while carrying', () => {
    const palm = stage.currentPart;
    stage.startGrab('xr');
    stage.moveGrabbed(new Vector3(2, 2, 2));
    stage.restart();
    expect(statuses.at(-1)).toBe('Finish carrying the part first.');
    expect(stage.currentIndex).toBe(0);
    expect(palm.position.x).toBeCloseTo(2, 2);
    stage.endGrab('xr', false);
    expect(stage.currentPart).toBe(palm);
  });

  it('endGrab without allowSnap never mounts', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    stage.startGrab('xr');
    stage.moveGrabbed(ghost.position);
    stage.endGrab('xr', false);
    expect(stage.currentIndex).toBe(0);
    expect(stage.screwSites()).toHaveLength(0);
    expect(statuses.join(' ')).not.toContain('mounted');
  });
});

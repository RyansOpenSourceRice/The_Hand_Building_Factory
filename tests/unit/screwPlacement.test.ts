import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AssemblyStage} from '../../src/game/assembly';
import type {PartDef} from '../../src/game/handParts';

const OFFSET = new Vector3(0.2, 0.1, -0.3);
const MARGIN = 0.02;

const offsetProvider = (def: PartDef, scene: Scene): Mesh => {
  const mesh = MeshBuilder.CreateBox(`part:${def.id}`, {size: 0.4}, scene);
  mesh.position.copyFrom(OFFSET);
  mesh.bakeCurrentTransformIntoVertices();
  mesh.refreshBoundingInfo();
  return mesh;
};

describe('screw placement', () => {
  let engine: NullEngine;
  let scene: Scene;
  let stage: AssemblyStage;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    scene.activeCamera = new FreeCamera('cam', Vector3.Zero(), scene);
    stage = new AssemblyStage(scene, offsetProvider);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('keeps every screw inside an off-center mesh', () => {
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    stage.startGrab('xr');
    stage.moveGrabbed(ghost.position);
    stage.endGrab('xr');

    const palm = stage.currentPart;
    const bounds = palm.getBoundingInfo().boundingBox;
    for (let index = 0; index < 4; index++) {
      const screw = scene.getMeshByName(`screw:palm-${index}`) as Mesh;
      expect(screw).toBeDefined();
      expect(screw.position.x).toBeGreaterThanOrEqual(
          bounds.minimum.x - MARGIN);
      expect(screw.position.x).toBeLessThanOrEqual(bounds.maximum.x + MARGIN);
      expect(screw.position.y).toBeGreaterThanOrEqual(
          bounds.minimum.y - MARGIN);
      expect(screw.position.y).toBeLessThanOrEqual(bounds.maximum.y + MARGIN);
      expect(screw.position.z).toBeGreaterThanOrEqual(
          bounds.minimum.z - MARGIN);
      expect(screw.position.z).toBeLessThanOrEqual(bounds.maximum.z + MARGIN);
    }
  });
});

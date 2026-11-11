import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {AssemblyStage} from '../../src/game/assembly';
import {type PartDef} from '../../src/game/handParts';

const boxProvider = (def: PartDef, scene: Scene): Mesh =>
  MeshBuilder.CreateBox(`part:${def.id}`, {size: 0.1}, scene);

describe('part tweens', () => {
  let engine: NullEngine;
  let scene: Scene;
  let stage: AssemblyStage;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    scene.useConstantAnimationDeltaTime = true;
    scene.activeCamera = new FreeCamera('cam', Vector3.Zero(), scene);
    stage = new AssemblyStage(scene, boxProvider);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  const settle = async (): Promise<void> => {
    for (let i = 0; i < 20; i++) {
      scene.render();
      if (scene.animatables.length === 0) {
        return;
      }
    }
    expect(scene.animatables.length).toBe(0);
  };

  it('reset tweens a carried part back home', async () => {
    const palm = stage.currentPart;
    const home = palm.position.clone();
    stage.startGrab('xr');
    stage.moveGrabbed(new Vector3(2, 2, 2));
    stage.endGrab('xr');
    stage.reset();
    expect(scene.animatables.length).toBeGreaterThan(0);
    await settle();
    expect(palm.position.x).toBeCloseTo(home.x, 1);
    expect(palm.position.y).toBeCloseTo(home.y, 1);
    expect(palm.position.z).toBeCloseTo(home.z, 1);
  });

  it('snap tweens the carried part into the socket', async () => {
    const palm = stage.currentPart;
    const ghost = scene.getMeshByName('ghost:palm') as Mesh;
    stage.startGrab('xr');
    stage.moveGrabbed(ghost.position.clone());
    stage.endGrab('xr');
    await settle();
    expect(palm.position.x).toBeCloseTo(ghost.position.x, 1);
    expect(palm.position.y).toBeCloseTo(ghost.position.y, 1);
    expect(palm.position.z).toBeCloseTo(ghost.position.z, 1);
  });
});

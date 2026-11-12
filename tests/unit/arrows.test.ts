import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {Constants} from '@babylonjs/core/Engines/constants';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {Scene} from '@babylonjs/core/scene';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {ArrowGuides} from '../../src/game/arrows';

describe('ArrowGuides', () => {
  let engine: NullEngine;
  let scene: Scene;
  let arrows: ArrowGuides;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    arrows = new ArrowGuides(scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('draws arrows over geometry with a fixed size', () => {
    const material = scene.getMaterialByName('guideArrowMat');
    expect(material).toBeInstanceOf(StandardMaterial);
    if (!(material instanceof StandardMaterial)) {
      throw new Error('arrow material missing');
    }
    expect(material.depthFunction).toBe(Constants.ALWAYS);
    expect(material.disableDepthWrite).toBe(true);
    const arrow = scene.getMeshByName('guideSourceArrow') as Mesh;
    expect(arrow.renderingGroupId).toBe(1);
    expect(arrow.scaling.x).toBe(1);
    expect(arrow.scaling.y).toBe(1);
    expect(arrow.scaling.z).toBe(1);
  });

  it('shows source and destination guides together', () => {
    arrows.setPartTargets(
        new Vector3(0, 1, 0), new Vector3(0, 1, 1));
    expect(arrows.count()).toBe(2);
    arrows.clearParts();
    expect(arrows.count()).toBe(0);
  });

  it('adds one guide per remaining screw', () => {
    arrows.setScrewTargets(
        [new Vector3(0, 1, 0), new Vector3(0.1, 1, 0)],
        [new Vector3(0, 1, 0), new Vector3(0, 1, 0)],
    );
    expect(arrows.count()).toBe(2);
    arrows.clearScrews();
    expect(arrows.count()).toBe(0);
  });
});

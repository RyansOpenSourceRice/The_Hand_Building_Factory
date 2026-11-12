import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Scene} from '@babylonjs/core/scene';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {PART_DEFS} from '../../src/game/handParts';
import {
  applyTheme,
  createPartProvider,
  createThemeMaterials,
  type ThemeMaterials,
} from '../../src/scene/partMeshes';

describe('part theme colors', () => {
  let engine: NullEngine;
  let scene: Scene;
  let theme: ThemeMaterials;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    theme = createThemeMaterials(scene, {
      turnMode: 'snap',
      snapAngle: 45,
      themePrimary: 3,
      themeSecondary: 2,
      themeTertiary: 0,
      muted: false,
    });
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  it('prints STL parts with the shared body material', () => {
    const prototype = MeshBuilder.CreateBox('proto:palm.stl', {size: 0.1},
        scene);
    prototype.material = theme.body;
    const palm = PART_DEFS.find((def) => def.id === 'palm');
    if (!palm) {
      throw new Error('palm definition missing');
    }
    const provider = createPartProvider(
        new Map([['palm.stl', prototype]]), theme);
    const mesh = provider(palm, scene);
    expect(mesh.material).toBe(theme.body);
  });

  it('recolors mounted parts when the palette changes', () => {
    const body = theme.body as StandardMaterial;
    expect(body.diffuseColor.toHexString().toLowerCase()).toBe('#e8e2d4');
    applyTheme(theme, {
      turnMode: 'snap',
      snapAngle: 45,
      themePrimary: 5,
      themeSecondary: 4,
      themeTertiary: 7,
      muted: false,
    });
    expect(body.diffuseColor.toHexString().toLowerCase()).toBe('#c9a227');
    expect(body.emissiveColor.r).toBeGreaterThan(0);
  });
});

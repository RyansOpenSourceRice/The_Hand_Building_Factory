import {Color3} from '@babylonjs/core/Maths/math.color';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import type {Scene} from '@babylonjs/core/scene';
import {applyTile} from './textures';

export function brushedMetalMaterial(
    scene: Scene,
    name = 'brushedMetalMat',
): StandardMaterial {
  const cached = scene.getMaterialByName(name);
  if (cached instanceof StandardMaterial) {
    return cached;
  }
  const mat = new StandardMaterial(name, scene);
  applyTile(mat, scene, 'bareSteel', {
    uScale: 2,
    vScale: 2,
    offsetSeed: name,
  });
  mat.diffuseColor = new Color3(0.95, 0.96, 0.98);
  mat.specularColor = new Color3(0.72, 0.74, 0.78);
  mat.specularPower = 96;
  mat.emissiveColor = new Color3(0.12, 0.13, 0.15);
  return mat;
}

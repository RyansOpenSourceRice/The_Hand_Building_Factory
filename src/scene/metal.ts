import {Color3} from '@babylonjs/core/Maths/math.color';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {Constants} from '@babylonjs/core/Engines/constants';
import type {Scene} from '@babylonjs/core/scene';

export function brushedMetalMaterial(
    scene: Scene,
    name = 'brushedMetalMat',
): StandardMaterial {
  const cached = scene.getMaterialByName(name);
  if (cached instanceof StandardMaterial) {
    return cached;
  }
  const mat = new StandardMaterial(name, scene);
  const grain = new Texture('textures/brushed-steel.png', scene);
  grain.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
  grain.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
  grain.uScale = 2;
  grain.vScale = 1;
  mat.diffuseTexture = grain;
  mat.diffuseColor = new Color3(0.95, 0.96, 0.98);
  mat.specularColor = new Color3(0.72, 0.74, 0.78);
  mat.specularPower = 96;
  mat.emissiveColor = new Color3(0.12, 0.13, 0.15);
  return mat;
}

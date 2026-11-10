import {Color3} from '@babylonjs/core/Maths/math.color';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {
  DynamicTexture,
} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {Scene} from '@babylonjs/core/scene';

const HEAD_DIAMETER = 0.013;
const HEAD_HEIGHT = 0.0045;
const SHAFT_DIAMETER = 0.008;
const SHAFT_HEIGHT = 0.015;

function threadTexture(scene: Scene): DynamicTexture | null {
  const cached = scene.getTextureByName('screwThreadTex');
  if (cached instanceof DynamicTexture) {
    return cached;
  }
  try {
    const sizePx = 32;
    const tex = new DynamicTexture('screwThreadTex', sizePx, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#8d93a1';
    ctx.fillRect(0, 0, sizePx, sizePx);
    ctx.strokeStyle = '#5b616e';
    ctx.lineWidth = 3;
    for (let i = -sizePx; i < sizePx * 2; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + sizePx, sizePx);
      ctx.stroke();
    }
    tex.update();
    tex.wrapU = 1;
    tex.wrapV = 1;
    tex.uScale = 2;
    tex.vScale = 1;
    return tex;
  } catch {
    return null;
  }
}

export function createScrew(id: string, scene: Scene): Mesh {
  const headMat = new StandardMaterial(`screwHeadMat:${id}`, scene);
  headMat.diffuseColor = new Color3(0.78, 0.8, 0.85);
  headMat.specularColor = new Color3(0.35, 0.35, 0.38);
  const shaftMat = new StandardMaterial(`screwShaftMat:${id}`, scene);
  shaftMat.diffuseTexture = threadTexture(scene);
  shaftMat.specularColor = new Color3(0.3, 0.3, 0.33);

  const root = new Mesh(`screw:${id}`, scene);
  const head = MeshBuilder.CreateCylinder(
      `screw:${id}-head`,
      {diameter: HEAD_DIAMETER, height: HEAD_HEIGHT},
      scene,
  );
  head.parent = root;
  head.position.y = SHAFT_HEIGHT / 2 + HEAD_HEIGHT / 2;
  head.material = headMat;
  const shaft = MeshBuilder.CreateCylinder(
      `screw:${id}-shaft`,
      {diameter: SHAFT_DIAMETER, height: SHAFT_HEIGHT},
      scene,
  );
  shaft.parent = root;
  shaft.material = shaftMat;
  root.setEnabled(false);
  return root;
}

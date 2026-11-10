import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Constants} from '@babylonjs/core/Engines/constants';
import {Scene} from '@babylonjs/core/scene';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {SpotLight} from '@babylonjs/core/Lights/spotLight';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {
  DynamicTexture,
} from '@babylonjs/core/Materials/Textures/dynamicTexture';

export interface Environment {
  engine: Engine;
  scene: Scene;
  ground: Mesh;
  pedestalTop: number;
}

function checkerTexture(scene: Scene): DynamicTexture {
  const sizePx = 256;
  const cells = 4;
  const tex = new DynamicTexture('floorTex', sizePx, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const cell = sizePx / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#1b2136' : '#141a2c';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  tex.update();
  tex.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
  tex.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
  tex.uScale = 14;
  tex.vScale = 14;
  return tex;
}

export function createEnvironment(canvas: HTMLCanvasElement): Environment {
  const engine = new Engine(canvas, true, {stencil: false});
  const scene = new Scene(engine);
  const voidColor = new Color4(0.04, 0.05, 0.1, 1);
  scene.clearColor = voidColor;
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.04, 0.05, 0.1);
  scene.fogDensity = 0.045;

  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.55;
  ambient.groundColor = new Color3(0.1, 0.12, 0.18);

  const spot = new SpotLight(
      'stageSpot',
      new Vector3(0, 4.2, 1.2),
      new Vector3(0, -1, -0.25),
      Math.PI / 3.2,
      4,
      scene,
  );
  spot.intensity = 1.4;
  spot.diffuse = new Color3(1.0, 0.96, 0.9);

  const ground =
      MeshBuilder.CreateGround('ground', {width: 24, height: 24}, scene);
  const groundMat = new StandardMaterial('groundMat', scene);
  groundMat.diffuseTexture = checkerTexture(scene);
  groundMat.specularColor = new Color3(0.02, 0.02, 0.03);
  ground.material = groundMat;

  const column = MeshBuilder.CreateBox(
      'pedestalColumn', {width: 0.9, depth: 0.9, height: 1.0}, scene);
  column.position.y = 0.5;
  const slab = MeshBuilder.CreateBox(
      'pedestalSlab', {width: 1.15, depth: 1.15, height: 0.07}, scene);
  const pedestalTop = 1.0 + 0.07;
  slab.position.y = 1.0 + 0.035;
  const benchMat = new StandardMaterial('benchMat', scene);
  benchMat.diffuseColor = new Color3(0.16, 0.18, 0.26);
  benchMat.emissiveColor = new Color3(0.03, 0.04, 0.07);
  benchMat.specularColor = new Color3(0.05, 0.05, 0.07);
  column.material = benchMat;
  slab.material = benchMat;

  const curtainMat = new StandardMaterial('curtainMat', scene);
  curtainMat.diffuseColor = new Color3(0.24, 0.05, 0.08);
  curtainMat.emissiveColor = new Color3(0.06, 0.01, 0.02);
  curtainMat.specularColor = new Color3(0.0, 0.0, 0.0);
  const curtain =
      MeshBuilder.CreatePlane('curtain', {width: 14, height: 5.5}, scene);
  curtain.position.set(0, 2.75, -3.4);
  curtain.material = curtainMat;

  return {engine, scene, ground, pedestalTop};
}

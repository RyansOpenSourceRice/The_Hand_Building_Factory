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
import {addStaticCollider} from './physics';
import {
  CONVEYOR_BELT_TOP,
  CONVEYOR_HOME,
  PRINTER_BED_TOP,
  PRINTER_HOME,
} from '../game/handParts';

export interface Environment {
  engine: Engine;
  scene: Scene;
  ground: Mesh;
  column: Mesh;
  slab: Mesh;
  printerBed: Mesh;
  conveyorBelt: Mesh;
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

function machineMat(
    scene: Scene,
    name: string,
    hex: string,
    emissive: string,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.emissiveColor = Color3.FromHexString(emissive);
  mat.specularColor = new Color3(0.08, 0.08, 0.1);
  return mat;
}

function buildPrinter(scene: Scene): Mesh {
  const frameMat = machineMat(scene, 'printerFrameMat', '#2a2f3e', '#05070c');
  const accentMat = machineMat(scene, 'printerAccentMat', '#1f6f5c', '#02241c');
  const bedMat = machineMat(scene, 'printerBedMat', '#141821', '#02040a');

  const bed = MeshBuilder.CreateBox(
      'printerBed', {width: 0.3, depth: 0.3, height: 0.02}, scene);
  bed.position.set(PRINTER_HOME.x, PRINTER_BED_TOP - 0.01, PRINTER_HOME.z);
  bed.material = bedMat;

  const postSpec = {width: 0.025, depth: 0.025, height: 0.34};
  for (const dx of [-0.17, 0.17]) {
    const post = MeshBuilder.CreateBox(
        `printerPost${dx < 0 ? 'L' : 'R'}`, postSpec, scene);
    post.position.set(
        PRINTER_HOME.x + dx,
        PRINTER_BED_TOP + 0.17,
        PRINTER_HOME.z - 0.16,
    );
    post.material = frameMat;
  }
  const gantry = MeshBuilder.CreateBox(
      'printerGantry', {width: 0.39, depth: 0.025, height: 0.025}, scene);
  gantry.position.set(
      PRINTER_HOME.x,
      PRINTER_BED_TOP + 0.34,
      PRINTER_HOME.z - 0.16,
  );
  gantry.material = frameMat;

  const head = MeshBuilder.CreateBox(
      'printerHead', {width: 0.055, depth: 0.055, height: 0.05}, scene);
  head.position.set(PRINTER_HOME.x, PRINTER_BED_TOP + 0.42, PRINTER_HOME.z);
  head.material = accentMat;
  const nozzle = MeshBuilder.CreateCylinder(
      'printerNozzle', {diameter: 0.02, height: 0.03}, scene);
  nozzle.position.set(
      PRINTER_HOME.x,
      PRINTER_BED_TOP + 0.365,
      PRINTER_HOME.z,
  );
  nozzle.material = frameMat;
  return bed;
}

function buildConveyor(scene: Scene): Mesh {
  const frameMat = machineMat(scene, 'beltFrameMat', '#2a2f3e', '#05070c');
  const beltMat = machineMat(scene, 'beltMat', '#10141d', '#02040a');
  const rollerMat = machineMat(scene, 'beltRollerMat', '#3d4459', '#05070c');

  const belt = MeshBuilder.CreateBox(
      'conveyorBelt', {width: 0.3, depth: 0.7, height: 0.02}, scene);
  belt.position.set(CONVEYOR_HOME.x, CONVEYOR_BELT_TOP - 0.01, 0.25);
  belt.material = beltMat;

  const legSpec = {width: 0.03, depth: 0.03, height: 0.05};
  for (const dz of [-0.3, 0.3]) {
    for (const dx of [-0.12, 0.12]) {
      const leg = MeshBuilder.CreateBox('conveyorLeg', legSpec, scene);
      leg.position.set(
          CONVEYOR_HOME.x + dx,
          1.07 + 0.025,
          0.25 + dz,
      );
      leg.material = frameMat;
    }
  }
  const rollerSpec = {diameter: 0.05, height: 0.32};
  for (const [name, dz] of [['conveyorRollerBack', -0.35],
    ['conveyorRollerFront', 0.35]] as const) {
    const roller = MeshBuilder.CreateCylinder(name, rollerSpec, scene);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(CONVEYOR_HOME.x, CONVEYOR_BELT_TOP - 0.01, 0.25 + dz);
    roller.material = rollerMat;
  }
  return belt;
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

  const printerBed = buildPrinter(scene);
  const conveyorBelt = buildConveyor(scene);

  return {
    engine,
    scene,
    ground,
    column,
    slab,
    printerBed,
    conveyorBelt,
    pedestalTop,
  };
}

export function attachEnvironmentColliders(env: Environment): void {
  addStaticCollider(
      env.scene,
      env.ground,
      new Vector3(0, -0.05, 0),
      new Vector3(24, 0.1, 24),
  );
  addStaticCollider(
      env.scene,
      env.column,
      Vector3.Zero(),
      new Vector3(0.9, 1.0, 0.9),
  );
  addStaticCollider(
      env.scene,
      env.slab,
      Vector3.Zero(),
      new Vector3(1.15, 0.07, 1.15),
  );
  addStaticCollider(
      env.scene,
      env.printerBed,
      new Vector3(
          PRINTER_HOME.x,
          PRINTER_BED_TOP - 0.01,
          PRINTER_HOME.z,
      ),
      new Vector3(0.3, 0.02, 0.3),
  );
  addStaticCollider(
      env.scene,
      env.conveyorBelt,
      new Vector3(CONVEYOR_HOME.x, CONVEYOR_BELT_TOP - 0.01, 0.25),
      new Vector3(0.3, 0.02, 0.7),
  );
}

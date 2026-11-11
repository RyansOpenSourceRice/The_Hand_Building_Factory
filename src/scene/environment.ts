import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {
  Matrix,
  Quaternion,
  Vector3,
} from '@babylonjs/core/Maths/math.vector';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Constants} from '@babylonjs/core/Engines/constants';
import {Scene} from '@babylonjs/core/scene';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {SpotLight} from '@babylonjs/core/Lights/spotLight';
import {PointLight} from '@babylonjs/core/Lights/pointLight';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/instancedMesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Texture} from '@babylonjs/core/Materials/Textures/texture';
import {
  DynamicTexture,
} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {addStaticCollider, makeBoxBody} from './physics';
import {
  PhysicsMotionType,
} from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import {
  CONVEYOR_BELT_TOP,
  CONVEYOR_HOME,
  CONVEYOR_PATH,
  PRINTER_BED_TOP,
  PRINTER_HOME,
} from '../game/handParts';
import {PLAY_RADIUS} from '../input/locomotion';
import {FILAMENT_COLORS, FALLBACK_HEX} from '../game/palette';

export interface Environment {
  engine: Engine;
  scene: Scene;
  ground: Mesh;
  column: Mesh;
  slab: Mesh;
  printerBed: Mesh;
  conveyorBelt: Mesh;
  barrierRails: readonly Mesh[];
  pedestalTop: number;
}

function imageMat(
    scene: Scene,
    name: string,
    url: string,
    uScale: number,
    vScale: number,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  const texture = new Texture(url, scene);
  texture.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.wrapV = Constants.TEXTURE_WRAP_ADDRESSMODE;
  texture.uScale = uScale;
  texture.vScale = vScale;
  mat.diffuseTexture = texture;
  mat.specularColor = new Color3(0.04, 0.04, 0.05);
  return mat;
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

function spoolColor(index: number): string {
  return FILAMENT_COLORS[index]?.hex ?? FALLBACK_HEX;
}

function screenTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('printerScreenTex', {width: 128, height: 80},
      scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.save();
  ctx.translate(128, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, 128, 80);
  ctx.strokeStyle = '#58e0c8';
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, 118, 70);
  ctx.fillStyle = '#1c2531';
  ctx.fillRect(14, 46, 100, 12);
  ctx.fillStyle = '#8a9a7b';
  ctx.fillRect(14, 46, 65, 12);
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#d9a622';
  ctx.fillText('PRINTING', 22, 34);
  ctx.restore();
  tex.update();
  return tex;
}

function hazardTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture('hazardTex', {width: 64, height: 64},
      scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = '#161b26';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#d9a622';
  for (let x = -64; x < 128; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 12, 64);
    ctx.lineTo(x + 44, 0);
    ctx.lineTo(x + 32, 0);
    ctx.closePath();
    ctx.fill();
  }
  tex.update();
  tex.wrapU = Constants.TEXTURE_WRAP_ADDRESSMODE;
  tex.uScale = 3;
  return tex;
}

function buildPrinter(scene: Scene): Mesh {
  const frameMat = machineMat(scene, 'printerFrameMat', '#2a2f3e', '#05070c');
  const accentMat = machineMat(scene, 'printerAccentMat', '#1f6f5c', '#02241c');
  const bedMat = machineMat(scene, 'printerBedMat', '#141821', '#02040a');
  const glassMat = new StandardMaterial('printerGlassMat', scene);
  glassMat.diffuseColor = new Color3(0.04, 0.05, 0.08);
  glassMat.specularColor = new Color3(0.45, 0.47, 0.5);
  glassMat.specularPower = 64;
  const ledMat = machineMat(scene, 'printerLedMat', '#58e0c8', '#2e8d7c');
  const amberMat = machineMat(scene, 'printerAmberMat', '#d9a622', '#4a3a0c');
  const ventMat = machineMat(scene, 'printerVentMat', '#10141d', '#02040a');

  const screenMat = new StandardMaterial('printerScreenMat', scene);
  const screenTex = screenTexture(scene);
  screenMat.emissiveTexture = screenTex;
  screenMat.diffuseTexture = screenTex;
  screenMat.specularColor = new Color3(0.1, 0.1, 0.12);

  const px = PRINTER_HOME.x;
  const pz = PRINTER_HOME.z;

  const footSpec = {diameter: 0.02, height: 0.012};
  for (const dx of [-0.16, 0.16]) {
    for (const dz of [-0.16, 0.16]) {
      const foot = MeshBuilder.CreateCylinder('printerFoot', footSpec, scene);
      foot.position.set(px + dx, 1.076, pz + dz);
      foot.material = ventMat;
    }
  }

  const shell = MeshBuilder.CreateBox(
      'printerShell', {width: 0.36, depth: 0.36, height: 0.148}, scene);
  shell.position.set(px, 1.155, pz);
  shell.material = frameMat;

  const panelSpec = {width: 0.012, depth: 0.34, height: 0.14};
  for (const dx of [-0.18, 0.18]) {
    const panel = MeshBuilder.CreateBox('printerPanel', panelSpec, scene);
    panel.position.set(px + dx, 1.155, pz);
    panel.material = accentMat;
  }

  const glass = MeshBuilder.CreateBox(
      'printerWindow', {width: 0.22, depth: 0.008, height: 0.08}, scene);
  glass.position.set(px - 0.04, 1.13, pz + 0.181);
  glass.material = glassMat;

  const screen = MeshBuilder.CreateBox(
      'printerScreen', {width: 0.12, depth: 0.006, height: 0.06}, scene);
  screen.position.set(px + 0.1, 1.19, pz + 0.181);
  screen.material = screenMat;

  const led = MeshBuilder.CreateBox(
      'printerLed', {width: 0.34, depth: 0.006, height: 0.008}, scene);
  led.position.set(px, 1.09, pz + 0.18);
  led.material = ledMat;

  const plate = MeshBuilder.CreateBox(
      'printerPlate', {width: 0.05, depth: 0.004, height: 0.035}, scene);
  plate.position.set(px - 0.12, 1.09, pz + 0.181);
  plate.material = amberMat;

  const ventSpec = {width: 0.006, depth: 0.12, height: 0.02};
  for (const y of [1.12, 1.155, 1.19]) {
    const vent = MeshBuilder.CreateBox('printerVent', ventSpec, scene);
    vent.position.set(px + 0.187, y, pz);
    vent.material = ventMat;
  }

  const postSpec = {diameter: 0.012, height: 0.03};
  for (const dx of [-0.12, 0.12]) {
    const post = MeshBuilder.CreateCylinder('printerSpoolPost', postSpec,
        scene);
    post.position.set(px + dx, 1.244, pz - 0.1);
    post.material = frameMat;
  }
  const axle = MeshBuilder.CreateCylinder(
      'printerAxle', {diameter: 0.012, height: 0.3}, scene);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(px, 1.259, pz - 0.1);
  axle.material = frameMat;
  const spoolSpec = {diameter: 0.09, height: 0.045};
  const hubSpec = {diameter: 0.032, height: 0.052};
  for (const [name, dx, index] of [['printerSpoolA', -0.06, 5],
    ['printerSpoolB', 0.06, 7]] as const) {
    const spool = MeshBuilder.CreateCylinder(name, spoolSpec, scene);
    spool.rotation.z = Math.PI / 2;
    spool.position.set(px + dx, 1.259, pz - 0.1);
    spool.material = machineMat(scene, `${name}Mat`, spoolColor(index),
        '#0d0a04');
    const hub = MeshBuilder.CreateCylinder(`${name}Hub`, hubSpec, scene);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(px + dx, 1.259, pz - 0.1);
    hub.material = frameMat;
  }

  const bed = MeshBuilder.CreateBox(
      'printerBed', {width: 0.3, depth: 0.3, height: 0.02}, scene);
  bed.position.set(px, PRINTER_BED_TOP - 0.01, pz);
  bed.material = bedMat;

  const postHeight = 0.35;
  for (const dx of [-0.17, 0.17]) {
    const post = MeshBuilder.CreateBox(
        `printerPost${dx < 0 ? 'L' : 'R'}`,
        {width: 0.025, depth: 0.025, height: postHeight}, scene);
    post.position.set(
        px + dx,
        PRINTER_BED_TOP + 0.165,
        pz - 0.16,
    );
    post.material = frameMat;
  }
  const gantry = MeshBuilder.CreateBox(
      'printerGantry', {width: 0.39, depth: 0.025, height: 0.025}, scene);
  gantry.position.set(px, PRINTER_BED_TOP + 0.34, pz - 0.16);
  gantry.material = frameMat;

  const head = MeshBuilder.CreateBox(
      'printerHead', {width: 0.055, depth: 0.055, height: 0.06}, scene);
  head.position.set(px, PRINTER_BED_TOP + 0.37, pz - 0.03);
  head.material = accentMat;

  const bracket = MeshBuilder.CreateBox(
      'printerBracket', {width: 0.02, depth: 0.18, height: 0.018}, scene);
  bracket.position.set(px, PRINTER_BED_TOP + 0.356, pz - 0.065);
  bracket.material = frameMat;

  const nozzle = MeshBuilder.CreateCylinder(
      'printerNozzle', {diameter: 0.02, height: 0.03}, scene);
  nozzle.position.set(px, PRINTER_BED_TOP + 0.335, pz);
  nozzle.material = frameMat;
  return bed;
}

function buildConveyor(scene: Scene): Mesh {
  const frameMat = machineMat(scene, 'beltFrameMat', '#2a2f3e', '#05070c');
  const beltMat = machineMat(scene, 'beltMat', '#10141d', '#02040a');
  const rollerMat = machineMat(scene, 'beltRollerMat', '#3d4459', '#05070c');
  const hazardMat = new StandardMaterial('beltHazardMat', scene);
  hazardMat.diffuseTexture = hazardTexture(scene);
  hazardMat.specularColor = new Color3(0.05, 0.05, 0.06);

  const belt = MeshBuilder.CreateBox(
      'conveyorBelt', {width: 0.3, depth: 0.7, height: 0.02}, scene);
  belt.position.set(CONVEYOR_HOME.x, CONVEYOR_BELT_TOP - 0.01, 0.25);
  belt.material = beltMat;

  const railSpec = {width: 0.015, depth: 0.72, height: 0.05};
  for (const dx of [-0.157, 0.157]) {
    const rail = MeshBuilder.CreateBox('conveyorRail', railSpec, scene);
    rail.position.set(CONVEYOR_HOME.x + dx, 1.115, 0.25);
    rail.material = frameMat;
  }

  const band = MeshBuilder.CreateBox(
      'conveyorHazardBand', {width: 0.32, depth: 0.012, height: 0.06}, scene);
  band.position.set(CONVEYOR_HOME.x, 1.085, 0.628);
  band.material = hazardMat;

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
  const midRollerSpec = {diameter: 0.03, height: 0.28};
  for (const dz of [-0.15, 0, 0.15]) {
    const roller =
        MeshBuilder.CreateCylinder('conveyorMidRoller', midRollerSpec, scene);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(CONVEYOR_HOME.x, 1.1, 0.25 + dz);
    roller.material = rollerMat;
  }
  return belt;
}

const BARRIER_SEGMENTS = 16;
const BARRIER_HEIGHTS = [0.5, 0.95] as const;

function chevronTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const texture = new DynamicTexture('beltChevronTex', size, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#10141d';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#58e0c8';
  ctx.lineWidth = 6;
  for (let i = -1; i < 3; i++) {
    const y = i * 32;
    ctx.beginPath();
    ctx.moveTo(0, y + 22);
    ctx.lineTo(32, y + 6);
    ctx.lineTo(64, y + 22);
    ctx.stroke();
  }
  texture.update();
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  return texture;
}

function buildConveyorRun(scene: Scene): void {
  const frameMat = machineMat(scene, 'beltRunFrameMat', '#2a2f3e', '#05070c');
  const runMat = new StandardMaterial('beltRunMat', scene);
  const chevrons = chevronTexture(scene);
  runMat.diffuseTexture = chevrons;
  runMat.specularColor = new Color3(0.05, 0.05, 0.06);
  const [pitHome, floorStop, curveStop, beltSouth] = CONVEYOR_PATH;

  scene.onBeforeRenderObservable.add(() => {
    chevrons.uOffset -= scene.getEngine().getDeltaTime() / 4000;
  });

  const pitMat = machineMat(scene, 'beltRunPitMat', '#0c1016', '#02040a');
  const pit = MeshBuilder.CreateBox(
      'beltRunPit', {width: 0.9, depth: 0.7, height: 0.1}, scene);
  pit.position.set(pitHome.x, 0.05, pitHome.z);
  pit.material = pitMat;
  const rimSpec = {width: 0.12, depth: 0.86, height: 0.06};
  for (const dx of [-0.51, 0.51]) {
    const rim = MeshBuilder.CreateBox('beltRunRim', rimSpec, scene);
    rim.position.set(pitHome.x + dx, 0.03, pitHome.z);
    rim.material = frameMat;
  }

  const hatchFrame =
      machineMat(scene, 'beltRunHatchMat', '#333a48', '#0b0e14');
  const hatchSpec = {width: 1.3, depth: 0.16, height: 0.1};
  for (const dz of [-0.48, 0.48]) {
    const beam = MeshBuilder.CreateBox('beltRunHatch', hatchSpec, scene);
    beam.position.set(pitHome.x, 10.02, pitHome.z + dz);
    beam.material = hatchFrame;
  }
  const hatchSideSpec = {width: 0.14, depth: 0.8, height: 0.1};
  for (const dx of [-0.6, 0.6]) {
    const beam =
        MeshBuilder.CreateBox('beltRunHatch', hatchSideSpec, scene);
    beam.position.set(pitHome.x + dx, 10.02, pitHome.z);
    beam.material = hatchFrame;
  }
  const shaft = MeshBuilder.CreateBox(
      'beltRunShaft', {width: 1.05, depth: 0.75, height: 9.6}, scene);
  shaft.position.set(pitHome.x, 5.05, pitHome.z);
  const shaftMat = new StandardMaterial('beltRunShaftMat', scene);
  shaftMat.emissiveColor = new Color3(1, 0.97, 0.9);
  shaftMat.diffuseColor = Color3.Black();
  shaftMat.alpha = 0.07;
  shaft.material = shaftMat;
  shaft.isPickable = false;

  const floorLen = Math.abs(floorStop.x - pitHome.x);
  const floorBelt = MeshBuilder.CreateBox(
      'beltRunFloor', {width: floorLen, depth: 0.5, height: 0.14}, scene);
  floorBelt.position.set((pitHome.x + floorStop.x) / 2, 0.17, floorStop.z);
  floorBelt.material = runMat;
  const legSpec = {width: 0.04, depth: 0.04, height: 0.2};
  for (const dx of [-0.2, 0.2]) {
    const leg = MeshBuilder.CreateBox('beltRunLeg', legSpec, scene);
    leg.position.set(floorStop.x + dx, 0.1, floorStop.z);
    leg.material = frameMat;
  }

  const curve = MeshBuilder.CreateBox(
      'beltRunCurve', {width: 0.55, depth: 0.45, height: 0.06}, scene);
  curve.position.set(curveStop.x, 0.32, curveStop.z);
  curve.rotation.y = Math.PI / 4;
  curve.material = runMat;

  const rise = beltSouth.y - curveStop.y;
  const run = beltSouth.z - curveStop.z;
  const slopeLen = Math.hypot(rise, run);
  const slopeAngle = Math.atan2(rise, Math.abs(run));
  const slope = MeshBuilder.CreateBox(
      'beltRunSlope', {width: 0.5, height: 0.06, depth: slopeLen}, scene);
  slope.position.set(
      (curveStop.x + beltSouth.x) / 2,
      (curveStop.y + beltSouth.y) / 2,
      (curveStop.z + beltSouth.z) / 2,
  );
  slope.rotation.x = slopeAngle;
  slope.material = runMat;
  const slopeRailSpec = {width: 0.02, height: 0.08, depth: slopeLen};
  for (const dx of [-0.26, 0.26]) {
    const rail = MeshBuilder.CreateBox(
        'beltRunSlopeRail', slopeRailSpec, scene);
    rail.position.set(slope.position.x + dx, slope.position.y + 0.05,
        slope.position.z);
    rail.rotation.x = slopeAngle;
    rail.material = frameMat;
  }
  for (const dz of [1.05, 0.85, 0.65]) {
    const t = (1.25 - dz) / 0.7;
    const legX = curveStop.x + t * (beltSouth.x - curveStop.x);
    const supportY = curveStop.y + t * rise;
    const leg = MeshBuilder.CreateBox(
        'beltRunSlopeLeg', {width: 0.04, depth: 0.04, height: supportY},
        scene);
    leg.position.set(legX, supportY / 2, dz);
    leg.material = frameMat;
  }
}

const HALL_Z_NEAR = -8.2;
const HALL_Z_FAR = -28;
const HALL_HALF_WIDTH = 16;

function markingsTexture(scene: Scene): DynamicTexture {
  const size = 512;
  const texture = new DynamicTexture('hallMarkingsTex', size, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#70757d';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#7a7f87';
  for (let i = 0; i < 40; i++) {
    const x = (i * 197) % size;
    const y = (i * 331) % size;
    ctx.fillRect(x, y, 3 + (i % 3), 2 + (i % 4));
  }
  ctx.strokeStyle = '#d9a622';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, size - 28, size - 28);
  ctx.setLineDash([26, 20]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#e8e2d4';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(60 + i * 80, size / 2 - 40, 44, 80);
  }
  texture.update();
  return texture;
}

function boxesTexture(scene: Scene): DynamicTexture {
  const size = 256;
  const texture = new DynamicTexture('rackBoxesTex', size, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#23272f';
  ctx.fillRect(0, 0, size, size);
  const tones = ['#8a6f4d', '#9a7d57', '#7c6444'];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const tone = tones[(row * 3 + col) % 3] ?? '#8a6f4d';
      ctx.fillStyle = tone;
      ctx.fillRect(col * 86 + 8, row * 128 + 14, 70, 100);
      ctx.fillStyle = '#d9cbb3';
      ctx.fillRect(col * 86 + 30, row * 128 + 52, 26, 18);
    }
  }
  texture.update();
  return texture;
}

function corrugationTexture(scene: Scene): DynamicTexture {
  const size = 128;
  const texture = new DynamicTexture('doorCorrugationTex', size, scene, false);
  const ctx = texture.getContext();
  for (let x = 0; x < size; x += 16) {
    ctx.fillStyle = '#9aa2ad';
    ctx.fillRect(x, 0, 8, size);
    ctx.fillStyle = '#7d848e';
    ctx.fillRect(x + 8, 0, 8, size);
  }
  texture.update();
  return texture;
}

function stageScreenTexture(scene: Scene): DynamicTexture {
  const texture = new DynamicTexture('stageScreenTex', 256, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = '#0c1016';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#2e8d7c';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 60);
  ctx.fillStyle = '#2e8d7c';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('LIVE BUILD', 26, 50);
  ctx.strokeStyle = '#d9a622';
  for (let i = 0; i < 4; i++) {
    const y = 110 + i * 36;
    ctx.beginPath();
    ctx.moveTo(20, y);
    for (let x = 20; x < 236; x += 8) {
      ctx.lineTo(x, y - 10 - 14 * Math.abs(Math.sin(x / 28 + i)));
    }
    ctx.stroke();
  }
  texture.update();
  return texture;
}

function buildRobotArm(
    scene: Scene,
    yellowMat: StandardMaterial,
    jointMat: StandardMaterial,
    x: number,
    z: number,
    face: number,
): TransformNode {
  const root = new TransformNode(`robotArm${x}_${z}`, scene);
  root.position.set(x, 0, z);
  root.rotation.y = face;
  const base = MeshBuilder.CreateCylinder(
      `armBase${x}_${z}`, {diameter: 1.0, height: 0.5, tessellation: 16},
      scene);
  base.position.y = 0.25;
  base.parent = root;
  base.material = jointMat;
  const column = MeshBuilder.CreateBox(
      `armColumn${x}_${z}`, {width: 0.5, height: 1.3, depth: 0.5}, scene);
  column.position.y = 1.15;
  column.parent = root;
  column.material = yellowMat;
  const shoulder = MeshBuilder.CreateSphere(
      `armShoulder${x}_${z}`, {diameter: 0.6, segments: 8}, scene);
  shoulder.position.y = 1.95;
  shoulder.parent = root;
  shoulder.material = jointMat;
  const boomPivot = new TransformNode(`armBoom${x}_${z}`, scene);
  boomPivot.position.y = 1.95;
  boomPivot.parent = root;
  const boom1 = MeshBuilder.CreateBox(
      `armBoomA${x}_${z}`, {width: 0.36, height: 0.36, depth: 2.6}, scene);
  boom1.position.set(0, 0, 1.3);
  boom1.parent = boomPivot;
  boom1.material = yellowMat;
  const elbow = MeshBuilder.CreateSphere(
      `armElbow${x}_${z}`, {diameter: 0.5, segments: 8}, scene);
  elbow.position.set(0, 0, 2.6);
  elbow.parent = boomPivot;
  elbow.material = jointMat;
  const forePivot = new TransformNode(`armFore${x}_${z}`, scene);
  forePivot.position.set(0, 0, 2.6);
  forePivot.parent = boomPivot;
  forePivot.rotation.x = 1.25;
  const boom2 = MeshBuilder.CreateBox(
      `armBoomB${x}_${z}`, {width: 0.28, height: 0.28, depth: 1.9}, scene);
  boom2.position.set(0, 0, 0.95);
  boom2.parent = forePivot;
  boom2.material = yellowMat;
  const wrist = MeshBuilder.CreateSphere(
      `armWrist${x}_${z}`, {diameter: 0.36, segments: 8}, scene);
  wrist.position.set(0, 0, 1.9);
  wrist.parent = forePivot;
  wrist.material = jointMat;
  for (const side of [-0.09, 0.09]) {
    const finger = MeshBuilder.CreateBox(
        `armFinger${x}_${z}${side}`,
        {width: 0.07, height: 0.07, depth: 0.5}, scene);
    finger.position.set(side, side > 0 ? 0.1 : -0.1, 2.25);
    finger.rotation.x = side > 0 ? 0.35 : -0.35;
    finger.parent = forePivot;
    finger.material = jointMat;
  }
  return boomPivot;
}

function buildForklift(
    scene: Scene,
    yellowMat: StandardMaterial,
    darkMat: StandardMaterial,
    name: string,
): TransformNode {
  const root = new TransformNode(name, scene);
  const body = MeshBuilder.CreateBox(
      `${name}Body`, {width: 1.0, height: 0.7, depth: 1.8}, scene);
  body.position.y = 0.65;
  body.parent = root;
  body.material = yellowMat;
  const counterweight = MeshBuilder.CreateBox(
      `${name}Weight`, {width: 1.0, height: 0.5, depth: 0.5}, scene);
  counterweight.position.set(0, 0.55, -1.05);
  counterweight.parent = root;
  counterweight.material = darkMat;
  for (const dx of [-0.3, 0.3]) {
    const mast = MeshBuilder.CreateBox(
        `${name}Mast`, {width: 0.1, height: 2.0, depth: 0.1}, scene);
    mast.position.set(dx, 1.0, 0.95);
    mast.parent = root;
    mast.material = darkMat;
    const tine = MeshBuilder.CreateBox(
        `${name}Tine`, {width: 0.1, height: 0.05, depth: 0.9}, scene);
    tine.position.set(dx, 0.12, 1.45);
    tine.parent = root;
    tine.material = darkMat;
  }
  const roof = MeshBuilder.CreateBox(
      `${name}Roof`, {width: 1.0, height: 0.06, depth: 0.9}, scene);
  roof.position.set(0, 2.05, -0.3);
  roof.parent = root;
  roof.material = darkMat;
  for (const [dx, dz] of [[-0.4, -0.6], [0.4, -0.6], [-0.4, 0.1],
    [0.4, 0.1]] as const) {
    const post = MeshBuilder.CreateBox(
        `${name}Cage`, {width: 0.06, height: 1.0, depth: 0.06}, scene);
    post.position.set(dx, 1.55, dz);
    post.parent = root;
    post.material = darkMat;
  }
  const wheelSpec = {diameter: 0.42, height: 0.22, tessellation: 12};
  for (const [dx, dz] of [[-0.52, 0.55], [0.52, 0.55], [-0.52, -0.55],
    [0.52, -0.55]] as const) {
    const wheel = MeshBuilder.CreateCylinder(
        `${name}Wheel`, wheelSpec, scene);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(dx, 0.21, dz);
    wheel.parent = root;
    wheel.material = darkMat;
  }
  return root;
}

function buildRack(
    scene: Scene,
    steelMat: StandardMaterial,
    loadMat: StandardMaterial,
    x: number,
    z: number,
    flip: boolean,
): void {
  const frame = new TransformNode(`rack${x}_${z}`, scene);
  frame.position.set(x, 0, z);
  frame.rotation.y = flip ? Math.PI / 2 : 0;
  const uprightSpec = {width: 0.1, height: 4.2, depth: 0.1};
  for (const dx of [-1.4, 1.4]) {
    const upright = MeshBuilder.CreateBox(`rackPost${x}_${z}`, uprightSpec,
        scene);
    upright.position.set(dx, 2.1, 0);
    upright.parent = frame;
    upright.material = steelMat;
  }
  for (const y of [1.2, 2.4, 3.6]) {
    const beam = MeshBuilder.CreateBox(
        `rackBeam${x}_${z}`, {width: 2.9, height: 0.09, depth: 0.09}, scene);
    beam.position.set(0, y, -0.55);
    beam.parent = frame;
    beam.material = steelMat;
    const beamBack = MeshBuilder.CreateBox(
        `rackBeamBack${x}_${z}`, {width: 2.9, height: 0.09, depth: 0.09},
        scene);
    beamBack.position.set(0, y, 0.55);
    beamBack.parent = frame;
    beamBack.material = steelMat;
    const load = MeshBuilder.CreateBox(
        `rackLoad${x}_${z}${y}`, {width: 2.7, height: 1.0, depth: 1.0},
        scene);
    load.position.set(0, y + 0.55, 0);
    load.parent = frame;
    load.material = loadMat;
  }
}

function buildGrandHall(scene: Scene): void {
  const wallMat = machineMat(scene, 'hallWallMat', '#aeb6c0', '#363c44');
  const steelMat = machineMat(scene, 'hallSteelMat', '#7c8694', '#20252d');
  const yellowMat = machineMat(scene, 'hallYellowMat', '#d9a622', '#4a3a0c');
  const darkMat = machineMat(scene, 'hallDarkMat', '#2a2f3e', '#05070c');
  const crowdMat = new StandardMaterial('crowdMat', scene);
  crowdMat.diffuseColor = new Color3(0.75, 0.72, 0.66);
  crowdMat.specularColor = Color3.Black();

  const floor = MeshBuilder.CreateGround(
      'hallFloor', {width: HALL_HALF_WIDTH * 2, height: 19.8}, scene);
  floor.position.set(0, 0.012, (HALL_Z_NEAR + HALL_Z_FAR) / 2);
  const floorMat = new StandardMaterial('hallFloorMat', scene);
  const markings = markingsTexture(scene);
  markings.uScale = 8;
  markings.vScale = 5;
  floorMat.diffuseTexture = markings;
  floorMat.specularColor = new Color3(0.04, 0.04, 0.05);
  floor.material = floorMat;

  const sideSpec = {width: 0.3, depth: 19.8, height: WALL_HEIGHT};
  for (const [name, x] of [['hallLeft', -HALL_HALF_WIDTH],
    ['hallRight', HALL_HALF_WIDTH]] as const) {
    const side = MeshBuilder.CreateBox(name, sideSpec, scene);
    side.position.set(x, WALL_HEIGHT / 2, (HALL_Z_NEAR + HALL_Z_FAR) / 2);
    side.material = wallMat;
  }
  const endWall = MeshBuilder.CreateBox(
      'hallEnd', {width: HALL_HALF_WIDTH * 2, depth: 0.3, height: WALL_HEIGHT},
      scene);
  endWall.position.set(0, WALL_HEIGHT / 2, HALL_Z_FAR);
  endWall.material = wallMat;
  const hallRoof = MeshBuilder.CreateBox(
      'hallRoof', {width: HALL_HALF_WIDTH * 2, depth: 19.8, height: 0.06},
      scene);
  hallRoof.rotation.x = Math.PI / 2;
  hallRoof.position.set(0, 9.97, (HALL_Z_NEAR + HALL_Z_FAR) / 2);
  hallRoof.material =
      imageMat(scene, 'hallRoofMat', 'textures/metal-roof.png', 8, 5);
  for (const x of [-12, -6, 6, 12]) {
    const column = MeshBuilder.CreateBox(
        `hallColumn${x}`, {width: 0.5, depth: 0.5, height: WALL_HEIGHT},
        scene);
    column.position.set(x, WALL_HEIGHT / 2, HALL_Z_NEAR + 0.4);
    column.material = steelMat;
    const backColumn = MeshBuilder.CreateBox(
        `hallColumnBack${x}`, {width: 0.5, depth: 0.5, height: WALL_HEIGHT},
        scene);
    backColumn.position.set(x, WALL_HEIGHT / 2, HALL_Z_FAR + 0.5);
    backColumn.material = steelMat;
  }
  const fixtureSpec = {width: 1.3, height: 0.07, depth: 0.2};
  const tubeMat = machineMat(scene, 'hallTubeMat', '#fff3d6', '#c9b98a');
  for (const x of [-10, -4, 4, 10]) {
    for (const z of [-13, -19, -25]) {
      const tube = MeshBuilder.CreateBox('hallTube', fixtureSpec, scene);
      tube.position.set(x, 8.4, z);
      tube.material = tubeMat;
      const rod = MeshBuilder.CreateCylinder(
          'hallTubeRod', {diameter: 0.02, height: 1.5}, scene);
      rod.position.set(x, 9.2, z);
      rod.material = steelMat;
    }
  }

  const boomPivots: TransformNode[] = [];
  boomPivots.push(
      buildRobotArm(scene, yellowMat, darkMat, -6, -26.5, 0),
      buildRobotArm(scene, yellowMat, darkMat, 0, -26.5, 0),
      buildRobotArm(scene, yellowMat, darkMat, 6, -26.5, 0),
      buildRobotArm(scene, yellowMat, darkMat, 9, -20, -Math.PI / 4),
      buildRobotArm(scene, yellowMat, darkMat, -9, -20, Math.PI / 4),
  );
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    boomPivots.forEach((pivot, index) => {
      if (index > 2) {
        return;
      }
      pivot.rotation.x = 0.5 + Math.sin(t * 0.45 + index * 2.1) * 0.14;
    });
  });

  const loadMat = new StandardMaterial('rackLoadMat', scene);
  const boxes = boxesTexture(scene);
  loadMat.diffuseTexture = boxes;
  loadMat.specularColor = new Color3(0.05, 0.05, 0.06);
  buildRack(scene, steelMat, loadMat, -13, -13, true);
  buildRack(scene, steelMat, loadMat, -13, -17, true);
  buildRack(scene, steelMat, loadMat, -13, -22, true);
  buildRack(scene, steelMat, loadMat, 13, -13, true);
  buildRack(scene, steelMat, loadMat, 13, -17, true);
  buildRack(scene, steelMat, loadMat, 13, -22, true);

  const pallet = Mesh.MergeMeshes([
    MeshBuilder.CreateBox('palletSlat', {width: 1.2, height: 0.04, depth: 1},
        scene),
    MeshBuilder.CreateBox('palletFoot', {width: 1.0, height: 0.1, depth: 0.8},
        scene),
  ], true, true);
  const crateMat = machineMat(scene, 'hallCrateMat', '#8a6f4d', '#2a2118');
  const palletSpots: Array<[number, number]> = [
    [-14.5, -11], [-11.8, -12.2], [-14.2, -19.5], [14.5, -11.5],
    [11.5, -14.5], [14.2, -20], [-10, -25], [10.5, -25.2],
  ];
  palletSpots.forEach(([x, z], i) => {
    if (pallet) {
      const stack = pallet.createInstance(`palletStack${i}`);
      stack.position.set(x, 0.07, z);
      stack.rotation.y = (i % 4) * 0.4;
    }
    const load = MeshBuilder.CreateBox(
        `palletLoad${i}`, {width: 0.9, height: 0.7, depth: 0.75}, scene);
    load.position.set(x, 0.47, z);
    load.rotation.y = (i % 4) * 0.4;
    load.material = crateMat;
  });
  if (pallet) {
    pallet.setEnabled(false);
  }

  const parked = buildForklift(scene, yellowMat, darkMat, 'forkliftParked');
  parked.position.set(-12.5, 0, -24);
  parked.rotation.y = Math.PI / 2;
  const moving = buildForklift(scene, yellowMat, darkMat, 'forkliftMoving');
  moving.position.set(12.5, 0, -11);
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    const leg = Math.floor(t / 15) % 2;
    const phase = (t % 15) / 15;
    const eased = phase < 0.5 ? 2 * phase * phase :
        1 - Math.pow(-2 * phase + 2, 2) / 2;
    moving.position.z = leg === 0 ? -11 - eased * 13 : -24 + eased * 13;
    moving.rotation.y = leg === 0 ? 0 : Math.PI;
  });

  const stage = MeshBuilder.CreateBox(
      'stagePlatform', {width: 10, height: 0.6, depth: 4}, scene);
  stage.position.set(0, 0.3, -22.5);
  stage.material = darkMat;
  const stageFront = MeshBuilder.CreateBox(
      'stageFace', {width: 10, height: 0.12, depth: 0.05}, scene);
  stageFront.position.set(0, 0.42, -20.47);
  stageFront.material = yellowMat;
  const backdrop = MeshBuilder.CreateBox(
      'stageBackdrop', {width: 10, height: 4.5, depth: 0.2}, scene);
  backdrop.position.set(0, 2.85, -24.6);
  backdrop.material = machineMat(scene, 'backdropMat', '#1d2129', '#05070c');
  const bandMat = new StandardMaterial('stageBandMat', scene);
  const bandTex = new DynamicTexture('stageBandTex', 256, scene, false);
  const bandCtx = bandTex.getContext();
  bandCtx.fillStyle = '#101820';
  bandCtx.fillRect(0, 0, 256, 256);
  bandCtx.fillStyle = '#d9a622';
  bandCtx.font = 'bold 42px monospace';
  bandCtx.fillText('HANDS ON!', 30, 150);
  bandTex.update();
  bandMat.diffuseTexture = bandTex;
  bandMat.emissiveTexture = bandTex;
  bandMat.emissiveColor = new Color3(0.7, 0.6, 0.35);
  const band = MeshBuilder.CreatePlane(
      'stageBand', {width: 6.5, height: 0.75}, scene);
  band.position.set(0, 4.35, -24.48);
  band.material = bandMat;
  const screenSpec = {width: 2.3, height: 1.5};
  const screenMat = new StandardMaterial('stageScreenMat', scene);
  const screen = stageScreenTexture(scene);
  screenMat.diffuseTexture = screen;
  screenMat.emissiveTexture = screen;
  screenMat.emissiveColor = new Color3(0.55, 0.6, 0.58);
  for (const x of [-3.4, 0, 3.4]) {
    const panel = MeshBuilder.CreatePlane(`stageScreen${x}`, screenSpec, scene);
    panel.position.set(x, 2.6, -24.48);
    panel.material = screenMat;
  }
  const podium = MeshBuilder.CreateBox(
      'stagePodium', {width: 0.6, height: 1.1, depth: 0.45}, scene);
  podium.position.set(1.6, 1.15, -21.6);
  podium.material = machineMat(scene, 'podiumMat', '#333a48', '#0b0e14');
  const podiumTop = MeshBuilder.CreateBox(
      'stagePodiumTop', {width: 0.7, height: 0.05, depth: 0.55}, scene);
  podiumTop.position.set(1.6, 1.72, -21.6);
  podiumTop.material = yellowMat;

  const seat = Mesh.MergeMeshes([
    MeshBuilder.CreateBox('crowdSeat', {width: 0.44, height: 0.05, depth: 0.42},
        scene),
    MeshBuilder.CreateBox('crowdBack', {width: 0.44, height: 0.5, depth: 0.05},
        scene),
  ], true, true);
  const figure = Mesh.MergeMeshes([
    MeshBuilder.CreateSphere('crowdHead', {diameter: 0.16, segments: 6},
        scene),
    MeshBuilder.CreateBox(
        'crowdTorse', {width: 0.3, height: 0.44, depth: 0.2}, scene),
  ], true, true);
  if (seat && figure) {
    seat.setEnabled(false);
    figure.setEnabled(false);
    seat.material = machineMat(scene, 'crowdSeatMat', '#3e5a78', '#101c2a');
    figure.material = crowdMat;
    const colors: number[] = [];
    const palette = FILAMENT_COLORS.map((color) => {
      const c = Color3.FromHexString(color.hex);
      return [c.r, c.g, c.b];
    });
    const toneAt = (index: number): [number, number, number] => {
      const tone = palette[index % palette.length] ?? [0.6, 0.6, 0.6];
      return [tone[0] ?? 0.6, tone[1] ?? 0.6, tone[2] ?? 0.6];
    };
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 15; col++) {
        const x = -5.25 + col * 0.75 + (row % 2) * 0.15;
        const z = -12.6 - row * 0.85;
        seat.thinInstanceAdd(Matrix.Compose(
            Vector3.One(),
            Quaternion.Identity(),
            new Vector3(x, 0.28, z),
        ));
        figure.thinInstanceAdd(Matrix.Compose(
            Vector3.One(),
            Quaternion.Identity(),
            new Vector3(x, 0.78, z - 0.06),
        ));
        const [tr, tg, tb] = toneAt(row * 7 + col * 3);
        const shade = 0.75 + ((row * 13 + col * 5) % 5) * 0.08;
        colors.push(tr * shade, tg * shade, tb * shade, 1);
      }
    }
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 10; col++) {
        const x = -4 + col * 0.85;
        const z = -20.6 - row * 0.85;
        figure.thinInstanceAdd(Matrix.Compose(
            Vector3.One(),
            Quaternion.Identity(),
            new Vector3(x, 0.62, z),
        ));
        const [tr, tg, tb] = toneAt(row * 5 + col * 7);
        const shade = 0.7 + ((row * 11 + col * 3) % 5) * 0.08;
        colors.push(tr * shade, tg * shade, tb * shade, 1);
      }
    }
    figure.thinInstanceSetBuffer('color', new Float32Array(colors), 4);
  }

  const walkers: Mesh[] = [];
  if (figure) {
    for (let i = 0; i < 3; i++) {
      const walker = figure.createInstance(`crowdWalker${i}`);
      walkers.push(walker as unknown as Mesh);
    }
  }
  scene.onBeforeRenderObservable.add(() => {
    const t = performance.now() / 1000;
    walkers.forEach((walker, i) => {
      const phase = (t * 0.35 + i * 0.33) % 1;
      const z = -9.5 - phase * 2.5;
      const x = i === 0 ? -6.8 : i === 1 ? 6.6 : -0.4 + Math.sin(t + i) * 0.3;
      walker.position.set(x, 0.62, z);
    });
  });

  const barrierRunMat = yellowMat;
  const runRailSpec = {width: 4.2, depth: 0.05, height: 0.06};
  for (const [x, z] of [[-8, -25.2], [8, -25.2]] as const) {
    const rail = MeshBuilder.CreateBox('hallBarrierRail', runRailSpec, scene);
    rail.position.set(x, 0.55, z);
    rail.material = barrierRunMat;
    for (const dx of [-2, 0, 2]) {
      const post = MeshBuilder.CreateBox(
          'hallBarrierPost', {width: 0.05, height: 1.0, depth: 0.05}, scene);
      post.position.set(x + dx, 0.5, z);
      post.material = barrierRunMat;
    }
  }
  for (const x of [-6.6, 6.6]) {
    const rail = MeshBuilder.CreateBox(
        'hallAisleRail', {width: 0.05, height: 0.06, depth: 3.2}, scene);
    rail.position.set(x, 0.55, -10.8);
    rail.material = barrierRunMat;
    for (const dz of [-1.4, 0, 1.4]) {
      const post = MeshBuilder.CreateBox(
          'hallAislePost', {width: 0.05, height: 1.0, depth: 0.05}, scene);
      post.position.set(x, 0.5, -10.8 + dz);
      post.material = barrierRunMat;
    }
  }

  const doorMat = new StandardMaterial('garageDoorMat', scene);
  const corrugation = corrugationTexture(scene);
  corrugation.uScale = 6;
  doorMat.diffuseTexture = corrugation;
  doorMat.specularColor = new Color3(0.06, 0.06, 0.07);
  for (const x of [-5.5, 0, 5.5]) {
    const door = MeshBuilder.CreateBox(
        `garageDoor${x}`, {width: 3.4, height: 3.2, depth: 0.1}, scene);
    door.position.set(x, 1.6, WALL_Z - 0.16);
    door.material = doorMat;
  }
  const personnel = MeshBuilder.CreateBox(
      'personnelDoor', {width: 1.0, height: 2.2, depth: 0.08}, scene);
  personnel.position.set(8.6, 1.1, WALL_Z - 0.14);
  personnel.material = machineMat(scene, 'personnelDoorMat', '#3e5a78',
      '#101c2a');
}

function buildPrinterBench(scene: Scene): void {
  const frameMat = machineMat(scene, 'benchFrameMat', '#3a4149', '#0b0e14');
  const steelMat = machineMat(scene, 'benchSteelMat', '#9aa4b2', '#252a33');
  const pegMat = machineMat(scene, 'benchPegMat', '#2f3542', '#080b10');
  const cx = PRINTER_HOME.x;
  const cz = PRINTER_HOME.z;
  const top = MeshBuilder.CreateBox(
      'benchTop', {width: 0.6, depth: 0.55, height: 0.05}, scene);
  top.position.set(cx, 1.033, cz);
  top.material = frameMat;
  const plate = MeshBuilder.CreateBox(
      'benchPlate', {width: 0.58, depth: 0.53, height: 0.012}, scene);
  plate.position.set(cx, 1.064, cz);
  plate.material = steelMat;
  const legSpec = {width: 0.05, depth: 0.05, height: 1.008};
  const legSpots: Array<[number, number]> = [
    [-0.24, -0.21], [0.24, -0.21], [-0.24, 0.21], [0.24, 0.21],
  ];
  legSpots.forEach(([dx, dz], i) => {
    const leg = MeshBuilder.CreateBox(`benchLeg${i}`, legSpec, scene);
    leg.position.set(cx + dx, 0.504, cz + dz);
    leg.material = frameMat;
  });
  const shelf = MeshBuilder.CreateBox(
      'benchShelf', {width: 0.5, depth: 0.45, height: 0.03}, scene);
  shelf.position.set(cx, 0.38, cz);
  shelf.material = frameMat;
  const pegboard = MeshBuilder.CreateBox(
      'benchPegboard', {width: 0.6, depth: 0.03, height: 0.5}, scene);
  pegboard.position.set(cx, 1.32, cz + 0.26);
  pegboard.material = pegMat;
}

function buildBarrierRing(scene: Scene): Mesh[] {
  const yellowMat = machineMat(scene, 'barrierYellowMat', '#d9a622', '#4a3a0c');
  const footMat = machineMat(scene, 'barrierFootMat', '#2a2f3e', '#05070c');
  const stripeMat = machineMat(scene, 'barrierStripeMat', '#d9a622', '#4a3a0c');
  stripeMat.diffuseTexture = hazardTexture(scene);

  const radius = PLAY_RADIUS;
  const chord = (2 * Math.PI * radius) / BARRIER_SEGMENTS;
  const rails: Mesh[] = [];
  const trims: Mesh[] = [];
  for (let i = 0; i < BARRIER_SEGMENTS; i++) {
    const angle = (i / BARRIER_SEGMENTS) * Math.PI * 2;
    const mid = angle + Math.PI / BARRIER_SEGMENTS;
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const post = MeshBuilder.CreateBox(
        `barrierPost${i}`, {width: 0.05, height: 1.0, depth: 0.05}, scene);
    post.position.set(px, 0.5, pz);
    post.material = yellowMat;
    trims.push(post);
    const foot = MeshBuilder.CreateBox(
        `barrierFoot${i}`, {width: 0.16, height: 0.04, depth: 0.16}, scene);
    foot.position.set(px, 0.02, pz);
    foot.material = footMat;
    trims.push(foot);
    BARRIER_HEIGHTS.forEach((y, j) => {
      const rail = MeshBuilder.CreateBox(
          `barrierRail${i}-${j}`, {width: chord, height: 0.06, depth: 0.05},
          scene);
      rail.position.set(
          Math.cos(mid) * radius,
          y,
          Math.sin(mid) * radius,
      );
      rail.rotation.y = mid + Math.PI / 2;
      rail.material = y > 0.9 ? stripeMat : yellowMat;
      rails.push(rail);
    });
  }
  const trim = Mesh.MergeMeshes(trims, true, true);
  if (trim) {
    trim.name = 'barrierTrims';
    trim.isPickable = false;
  }
  for (const rail of rails) {
    rail.isPickable = false;
  }
  return rails;
}

const WALL_Z = 8.2;
const WALL_HEIGHT = 10;
const BEAM_LEVELS = [3.2, 6.4, 9.2];

function buildWarehouse(scene: Scene): void {
  const wallMat = machineMat(scene, 'warehouseWallMat', '#b6bfca', '#3a4149');
  const steelMat = machineMat(scene, 'warehouseSteelMat', '#7c8694', '#20252d');
  const crateMat = machineMat(scene, 'warehouseCrateMat', '#8a6f4d', '#2a2118');
  const bulbMat = machineMat(scene, 'warehouseBulbMat', '#fff3d6', '#8a7a54');
  const fixtureMat =
      machineMat(scene, 'warehouseFixtureMat', '#f5f8ff', '#c9d2e0');

  const wallSpec = {width: 24, depth: 0.2, height: WALL_HEIGHT};
  const front = MeshBuilder.CreateBox('warehouseFront', wallSpec, scene);
  front.position.set(0, WALL_HEIGHT / 2, WALL_Z);
  front.material = wallMat;
  const opening = MeshBuilder.CreateBox(
      'warehouseBack', {width: 24, depth: 0.2, height: 1.1}, scene);
  opening.position.set(0, 0.55, -WALL_Z);
  opening.material = wallMat;
  const sideSpec = {width: 0.2, depth: 16.6, height: WALL_HEIGHT};
  for (const [name, x] of [['warehouseLeft', -12],
    ['warehouseRight', 12]] as const) {
    const side = MeshBuilder.CreateBox(name, sideSpec, scene);
    side.position.set(x, WALL_HEIGHT / 2, 0);
    side.material = wallMat;
  }

  const columnSpec = {width: 0.5, depth: 0.5, height: WALL_HEIGHT};
  for (const x of [-8, -4, 4, 8]) {
    const column = MeshBuilder.CreateBox(
        `warehouseColumn${x}`, columnSpec, scene);
    column.position.set(x, WALL_HEIGHT / 2, -WALL_Z + 0.35);
    column.material = steelMat;
  }

  const beamSpec = {width: 23.6, depth: 0.35, height: 0.35};
  for (const y of BEAM_LEVELS) {
    const beam = MeshBuilder.CreateBox(`warehouseBeam${y}`, beamSpec, scene);
    beam.position.set(0, y, -WALL_Z + 0.35);
    beam.material = steelMat;
  }

  const railY = BEAM_LEVELS[0] ?? 3.2;
  const rail = MeshBuilder.CreateBox(
      'warehouseRail', {width: 23.6, depth: 0.06, height: 0.06}, scene);
  rail.position.set(0, railY + 1, -4);
  rail.material = steelMat;
  const postSpec = {width: 0.06, depth: 0.06, height: 1};
  for (let x = -11.5; x <= 11.5; x += 2.3) {
    const post = MeshBuilder.CreateBox('warehouseRailPost', postSpec, scene);
    post.position.set(x, railY + 0.5, -4);
    post.material = steelMat;
  }

  for (const x of [-2, 0, 2]) {
    const cord = MeshBuilder.CreateCylinder(
        `warehouseCord${x}`, {diameter: 0.02, height: 1.2}, scene);
    cord.position.set(x, railY - 0.6, 0.5);
    cord.material = steelMat;
    const shade = MeshBuilder.CreateCylinder(
        `warehouseShade${x}`, {diameterTop: 0.08, diameterBottom: 0.3,
          height: 0.18}, scene);
    shade.position.set(x, railY - 1.3, 0.5);
    shade.material = steelMat;
    const bulb = MeshBuilder.CreateSphere(
        `warehouseBulb${x}`, {diameter: 0.12}, scene);
    bulb.position.set(x, railY - 1.42, 0.5);
    bulb.material = bulbMat;
  }

  const barSpec = {width: 1.8, depth: 0.22, height: 0.08};
  const cordSpec = {diameter: 0.015, height: 5.9};
  for (const x of [-6, -2.4, 2.4, 6]) {
    const bar = MeshBuilder.CreateBox('warehouseBayBar', barSpec, scene);
    bar.position.set(x, 3.18, 0.6);
    bar.material = fixtureMat;
    for (const dx of [-0.7, 0.7]) {
      const hang = MeshBuilder.CreateCylinder(
          'warehouseBayCord', cordSpec, scene);
      hang.position.set(x + dx, 6.14, 0.6);
      hang.material = steelMat;
    }
  }

  const purlinSpec = {width: 0.15, depth: 16.4, height: 0.25};
  for (const x of [-8, -4, 0, 4, 8]) {
    const purlin = MeshBuilder.CreateBox('warehousePurlin', purlinSpec, scene);
    purlin.position.set(x, 9.8, 0);
    purlin.material = steelMat;
  }

  const roof = MeshBuilder.CreateBox(
      'warehouseRoof', {width: 23.6, depth: 0.06, height: 16.6}, scene);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, 9.97, 0);
  roof.material =
      imageMat(scene, 'warehouseRoofMat', 'textures/metal-roof.png', 4, 3);

  const diffuserMat = machineMat(
      scene, 'warehouseDiffuserMat', '#dde4ee', '#96a0ae');
  const skylightSpec = {width: 2.6, depth: 0.07, height: 1.5};
  for (const x of [-7, 0, 7]) {
    for (const z of [-2.6, 2.6]) {
      const panel =
          MeshBuilder.CreateBox('warehouseSkylight', skylightSpec, scene);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, 10.05, z);
      panel.material = diffuserMat;
    }
  }

  const crateSpec = {width: 0.8, depth: 0.8, height: 0.8};
  const crateSpots: Array<[number, number, number]> = [
    [-6, 0.4, -6.4], [-5.1, 0.4, -6.9], [-6.2, 1.2, -6.2],
    [5.4, 0.4, -6.6], [6.3, 0.4, -6.1], [5.8, 1.2, -6.4],
    [7, 0.4, 6], [-7, 0.4, 6.4],
  ];
  crateSpots.forEach(([x, y, z], index) => {
    const crate = MeshBuilder.CreateBox(
        `warehouseCrate${index}`, crateSpec, scene);
    crate.position.set(x, y, z);
    crate.rotation.y = (index % 3) * 0.21;
    crate.material = crateMat;
  });
}

export function createEnvironment(canvas: HTMLCanvasElement): Environment {
  const engine = new Engine(canvas, true, {stencil: false});
  const scene = new Scene(engine);
  const voidColor = new Color4(0.58, 0.63, 0.7, 1);
  scene.clearColor = voidColor;
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.58, 0.63, 0.7);
  scene.fogDensity = 0.016;

  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.85;
  ambient.groundColor = new Color3(0.42, 0.44, 0.48);

  const spot = new SpotLight(
      'stageSpot',
      new Vector3(0, 4.2, 1.2),
      new Vector3(0, -1, -0.25),
      Math.PI / 3.2,
      4,
      scene,
  );
  spot.intensity = 1.1;
  spot.diffuse = new Color3(1.0, 0.96, 0.9);

  for (const [name, x] of [['bayLightLeft', -2.4],
    ['bayLightRight', 2.4]] as const) {
    const bay = new PointLight(name, new Vector3(x, 3.1, 0.6), scene);
    bay.intensity = 0.5;
    bay.range = 14;
    bay.diffuse = new Color3(1, 0.98, 0.94);
  }

  const ground =
      MeshBuilder.CreateGround('ground', {width: 80, height: 44}, scene);
  ground.position.z = -6;
  const groundMat =
      imageMat(scene, 'groundMat', 'textures/concrete-floor.png', 20, 11);
  ground.material = groundMat;

  const column = MeshBuilder.CreateCylinder(
      'pedestalColumn', {diameter: 0.6, height: 1.0, tessellation: 24}, scene);
  column.position.y = 0.5;
  const baseRing = MeshBuilder.CreateCylinder(
      'pedestalBase', {diameter: 0.8, height: 0.06, tessellation: 24}, scene);
  baseRing.position.y = 0.03;
  const slab = MeshBuilder.CreateCylinder(
      'pedestalSlab', {diameter: 0.72, height: 0.07, tessellation: 24}, scene);
  const pedestalTop = 1.0 + 0.07;
  slab.position.y = 1.0 + 0.035;
  const accentRing = MeshBuilder.CreateCylinder(
      'pedestalAccent', {diameter: 0.78, height: 0.02, tessellation: 24},
      scene);
  accentRing.position.y = 0.995;
  const benchMat = new StandardMaterial('benchMat', scene);
  benchMat.diffuseColor = new Color3(0.62, 0.65, 0.72);
  benchMat.emissiveColor = new Color3(0.1, 0.11, 0.13);
  benchMat.specularColor = new Color3(0.3, 0.3, 0.34);
  column.material = benchMat;
  slab.material = benchMat;
  baseRing.material =
      machineMat(scene, 'pedestalBaseMat', '#2a2f3e', '#05070c');
  accentRing.material =
      machineMat(scene, 'pedestalAccentMat', '#2e8d7c', '#0b4a3e');

  const curtainMat = new StandardMaterial('curtainMat', scene);
  curtainMat.diffuseColor = new Color3(0.42, 0.1, 0.14);
  curtainMat.emissiveColor = new Color3(0.09, 0.02, 0.03);
  curtainMat.specularColor = new Color3(0.0, 0.0, 0.0);
  const curtain =
      MeshBuilder.CreatePlane('curtain', {width: 14, height: 5.5}, scene);
  curtain.position.set(0, 2.75, -3.4);
  curtain.material = curtainMat;

  const printerBed = buildPrinter(scene);
  buildPrinterBench(scene);
  const conveyorBelt = buildConveyor(scene);
  buildConveyorRun(scene);
  buildWarehouse(scene);
  buildGrandHall(scene);
  const barrierRails = buildBarrierRing(scene);

  return {
    engine,
    scene,
    ground,
    column,
    slab,
    printerBed,
    conveyorBelt,
    barrierRails,
    pedestalTop,
  };
}

export function attachEnvironmentColliders(env: Environment): void {
  addStaticCollider(
      env.scene,
      env.ground,
      new Vector3(0, -0.05, -6),
      new Vector3(80, 0.1, 44),
  );
  addStaticCollider(
      env.scene,
      env.column,
      Vector3.Zero(),
      new Vector3(0.6, 1.0, 0.6),
  );
  addStaticCollider(
      env.scene,
      env.slab,
      Vector3.Zero(),
      new Vector3(0.72, 0.07, 0.72),
  );
  addStaticCollider(
      env.scene,
      env.column,
      new Vector3(PRINTER_HOME.x, 0.535, PRINTER_HOME.z),
      new Vector3(0.6, 1.07, 0.55),
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
      env.printerBed,
      new Vector3(PRINTER_HOME.x, 1.155, PRINTER_HOME.z),
      new Vector3(0.36, 0.148, 0.36),
  );
  addStaticCollider(
      env.scene,
      env.conveyorBelt,
      new Vector3(CONVEYOR_HOME.x, CONVEYOR_BELT_TOP - 0.01, 0.25),
      new Vector3(0.3, 0.02, 0.7),
  );
  for (const rail of env.barrierRails) {
    makeBoxBody(rail, PhysicsMotionType.STATIC, 0);
  }
}

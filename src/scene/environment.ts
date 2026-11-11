import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {Engine} from '@babylonjs/core/Engines/engine';
import {Constants} from '@babylonjs/core/Engines/constants';
import {Scene} from '@babylonjs/core/scene';
import {HemisphericLight} from '@babylonjs/core/Lights/hemisphericLight';
import {SpotLight} from '@babylonjs/core/Lights/spotLight';
import {PointLight} from '@babylonjs/core/Lights/pointLight';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
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
  const back = MeshBuilder.CreateBox('warehouseBack', wallSpec, scene);
  back.position.set(0, WALL_HEIGHT / 2, -WALL_Z);
  back.material = wallMat;
  const front = MeshBuilder.CreateBox('warehouseFront', wallSpec, scene);
  front.position.set(0, WALL_HEIGHT / 2, WALL_Z);
  front.material = wallMat;
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
      MeshBuilder.CreateGround('ground', {width: 24, height: 24}, scene);
  const groundMat =
      imageMat(scene, 'groundMat', 'textures/concrete-floor.png', 6, 6);
  ground.material = groundMat;

  const column = MeshBuilder.CreateBox(
      'pedestalColumn', {width: 0.9, depth: 0.9, height: 1.0}, scene);
  column.position.y = 0.5;
  const slab = MeshBuilder.CreateBox(
      'pedestalSlab', {width: 1.15, depth: 1.15, height: 0.07}, scene);
  const pedestalTop = 1.0 + 0.07;
  slab.position.y = 1.0 + 0.035;
  const benchMat = new StandardMaterial('benchMat', scene);
  benchMat.diffuseColor = new Color3(0.62, 0.65, 0.72);
  benchMat.emissiveColor = new Color3(0.1, 0.11, 0.13);
  benchMat.specularColor = new Color3(0.08, 0.08, 0.1);
  column.material = benchMat;
  slab.material = benchMat;

  const curtainMat = new StandardMaterial('curtainMat', scene);
  curtainMat.diffuseColor = new Color3(0.42, 0.1, 0.14);
  curtainMat.emissiveColor = new Color3(0.09, 0.02, 0.03);
  curtainMat.specularColor = new Color3(0.0, 0.0, 0.0);
  const curtain =
      MeshBuilder.CreatePlane('curtain', {width: 14, height: 5.5}, scene);
  curtain.position.set(0, 2.75, -3.4);
  curtain.material = curtainMat;

  const printerBed = buildPrinter(scene);
  const conveyorBelt = buildConveyor(scene);
  buildWarehouse(scene);
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

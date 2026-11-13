import {Color3, Color4} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Engine} from '@babylonjs/core/Engines/engine';
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
import {applyTile, tiledMaterial, type TileName} from './textures';
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
import {
  BARRIER_HALF,
  BARRIER_SEGMENT,
  FORKLIFT_MOVING,
  FORKLIFT_PARKED,
  ROBOT_BASES,
  WAREHOUSE_CRATE_SPOTS,
} from './layout';
import {FILAMENT_COLORS, FALLBACK_HEX} from '../game/palette';

const AUDIENCE_ROWS = 2;
const AUDIENCE_COLS = 6;
export const AUDIENCE_COUNT = AUDIENCE_ROWS * AUDIENCE_COLS;

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

function machineMat(
    scene: Scene,
    name: string,
    hex: string,
    emissive: string,
    tile: TileName | null = 'paintedSteel',
    uScale = 2,
    vScale = 2,
): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.emissiveColor = Color3.FromHexString(emissive);
  mat.specularColor = new Color3(0.08, 0.08, 0.1);
  if (tile) {
    applyTile(mat, scene, tile, {
      uScale,
      vScale,
      offsetSeed: name,
    });
  }
  return mat;
}

function mergeStatic(meshes: Mesh[]): void {
  const groups = new Map<StandardMaterial, Mesh[]>();
  for (const mesh of meshes) {
    const material = mesh.material;
    if (!(material instanceof StandardMaterial)) {
      continue;
    }
    const list = groups.get(material) ?? [];
    list.push(mesh);
    groups.set(material, list);
  }
  for (const list of groups.values()) {
    if (list.length < 2) {
      continue;
    }
    Mesh.MergeMeshes(list, true, true, undefined, false);
  }
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

function buildPrinter(scene: Scene): Mesh {
  const frameMat = machineMat(scene, 'printerFrameMat', '#2a2f3e', '#05070c');
  const accentMat = machineMat(scene, 'printerAccentMat', '#1f6f5c', '#02241c');
  const bedMat = machineMat(scene, 'printerBedMat', '#141821', '#02040a');
  const glassMat = new StandardMaterial('printerGlassMat', scene);
  glassMat.diffuseColor = new Color3(0.04, 0.05, 0.08);
  glassMat.specularColor = new Color3(0.45, 0.47, 0.5);
  glassMat.specularPower = 64;
  const ledMat = machineMat(
      scene, 'printerLedMat', '#58e0c8', '#2e8d7c', null);
  const amberMat = machineMat(
      scene, 'printerAmberMat', '#d9a622', '#4a3a0c', null);
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
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

function buildConveyor(scene: Scene): Mesh {
  const frameMat = machineMat(scene, 'beltFrameMat', '#2a2f3e', '#05070c');
  const rollerMat = machineMat(scene, 'beltRollerMat', '#3d4459', '#05070c');
  const rubber = tiledMaterial(scene, 'beltRubberMat', 'rubber', {
    uScale: 2,
    vScale: 2,
    offsetSeed: 'beltRubberMat',
  });
  const chevrons = chevronTexture(scene);
  const beltMat = new StandardMaterial('beltSurfaceMat', scene);
  beltMat.diffuseTexture = chevrons;
  beltMat.specularColor = new Color3(0.04, 0.04, 0.05);
  chevrons.uScale = 1;
  chevrons.vScale = 10;
  scene.onBeforeRenderObservable.add(() => {
    chevrons.vOffset -= scene.getEngine().getDeltaTime() / 3200;
  });

  const bottom = new Vector3(
      CONVEYOR_PATH[0].x, CONVEYOR_PATH[0].y, CONVEYOR_PATH[0].z);
  const top = new Vector3(
      CONVEYOR_PATH[1].x, CONVEYOR_PATH[1].y, CONVEYOR_PATH[1].z);
  const delta = top.subtract(bottom);
  const length = delta.length();
  const center = Vector3.Center(bottom, top);
  const root = new TransformNode('conveyorRamp', scene);
  root.position.copyFrom(center);
  root.rotation.x = -Math.atan2(delta.y, -delta.z);
  const beltWidth = 0.34;

  const belt = MeshBuilder.CreateBox(
      'conveyorBelt',
      {width: beltWidth, height: 0.024, depth: length},
      scene,
  );
  belt.parent = root;
  belt.position.y = 0.012;
  belt.material = beltMat;

  const skirts: Mesh[] = [];
  for (const dx of [-beltWidth / 2 - 0.012, beltWidth / 2 + 0.012]) {
    const skirt = MeshBuilder.CreateBox(
        'conveyorSkirt',
        {width: 0.018, height: 0.085, depth: length},
        scene,
    );
    skirt.position.set(dx, 0.035, 0);
    skirt.material = frameMat;
    skirts.push(skirt);
  }
  const skirtMerged = Mesh.MergeMeshes(skirts, true, true);
  if (skirtMerged) {
    skirtMerged.parent = root;
    skirtMerged.name = 'conveyorSkirts';
  }

  const cleats: Mesh[] = [];
  const cleatCount = 15;
  for (let i = 1; i < cleatCount; i++) {
    const cleat = MeshBuilder.CreateBox(
        'conveyorCleat',
        {width: beltWidth - 0.03, height: 0.026, depth: 0.022},
        scene,
    );
    cleat.position.set(0, 0.038, -length / 2 + (i / cleatCount) * length);
    cleat.material = rubber;
    cleats.push(cleat);
  }
  const cleatMerged = Mesh.MergeMeshes(cleats, true, true);
  if (cleatMerged) {
    cleatMerged.parent = root;
    cleatMerged.name = 'conveyorCleats';
  }

  const rollerSpec = {diameter: 0.08, height: beltWidth + 0.05};
  for (const point of [bottom, top]) {
    const roller = MeshBuilder.CreateCylinder(
        'conveyorRoller', rollerSpec, scene);
    roller.rotation.z = Math.PI / 2;
    roller.position.set(point.x, point.y - 0.02, point.z);
    roller.material = rollerMat;
  }

  for (const t of [0.35, 0.62, 0.86]) {
    const point = Vector3.Lerp(bottom, top, t);
    const height = Math.max(0.12, point.y - 0.06);
    const leg = MeshBuilder.CreateBox(
        'conveyorLeg',
        {width: 0.04, height, depth: 0.04},
        scene,
    );
    leg.position.set(point.x + 0.16, height / 2, point.z);
    leg.material = frameMat;
    const brace = MeshBuilder.CreateBox(
        'conveyorBrace',
        {width: 0.36, height: 0.03, depth: 0.035},
        scene,
    );
    brace.position.set(point.x, height - 0.02, point.z);
    brace.material = frameMat;
  }

  const tray = MeshBuilder.CreateBox(
      'conveyorTray', {width: 0.42, height: 0.05, depth: 0.42}, scene);
  tray.position.set(top.x, top.y - 0.04, top.z + 0.02);
  tray.material = frameMat;
  for (const dx of [-0.2, 0.2]) {
    const guard = MeshBuilder.CreateBox(
        'conveyorTrayGuard',
        {width: 0.024, height: 0.12, depth: 0.4},
        scene,
    );
    guard.position.set(top.x + dx, top.y + 0.02, top.z + 0.02);
    guard.material = frameMat;
  }

  const pit = MeshBuilder.CreateBox(
      'conveyorPit', {width: 0.62, height: 0.06, depth: 0.9}, scene);
  pit.position.set(bottom.x, 0.015, bottom.z - 0.12);
  pit.material = machineMat(scene, 'beltRunPitMat', '#0c1016', '#02040a');
  const hoodMat = machineMat(
      scene, 'conveyorHoodMat', '#333a48', '#0b0e14');
  const hood = MeshBuilder.CreateBox(
      'conveyorHood', {width: 0.62, height: 0.34, depth: 0.52}, scene);
  hood.position.set(0.62, 0.19, 2.24);
  hood.material = hoodMat;
  const hoodLip = MeshBuilder.CreateBox(
      'conveyorHoodLip', {width: 0.68, height: 0.05, depth: 0.08}, scene);
  hoodLip.position.set(0.62, 0.35, 2.5);
  hoodLip.material = hoodMat;
  for (const dx of [-0.3, 0.3]) {
    const side = MeshBuilder.CreateBox(
        'conveyorHoodSide', {width: 0.03, height: 0.3, depth: 0.48}, scene);
    side.position.set(0.62 + dx, 0.17, 2.24);
    side.material = hazardMat(scene);
  }
  return belt;
}

function hazardMat(scene: Scene): StandardMaterial {
  return tiledMaterial(scene, 'hazardTileMat', 'hazard', {
    uScale: 1,
    vScale: 1,
    offsetSeed: 'hazardTileMat',
  });
}

const HALL_Z_NEAR = -8.2;
const HALL_Z_FAR = -28;
const HALL_HALF_WIDTH = 16;

function markingsTexture(scene: Scene): DynamicTexture {
  const size = 256;
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
  const add = (
      label: string,
      size: {width: number; height: number; depth: number},
      at: [number, number, number],
      material: StandardMaterial,
  ): Mesh => {
    const mesh = MeshBuilder.CreateBox(`${name}${label}`, size, scene);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.parent = root;
    mesh.material = material;
    return mesh;
  };
  add('Chassis', {width: 1.04, height: 0.4, depth: 1.55}, [0, 0.52, 0],
      yellowMat);
  add('Counterweight', {width: 1.04, height: 0.66, depth: 0.42},
      [0, 0.5, -0.98], darkMat);
  add('Hood', {width: 0.86, height: 0.28, depth: 0.72}, [0, 0.83, -0.45],
      yellowMat);
  add('SeatBase', {width: 0.52, height: 0.1, depth: 0.46}, [0, 0.99, -0.12],
      darkMat);
  add('SeatBack', {width: 0.52, height: 0.5, depth: 0.1}, [0, 1.24, -0.35],
      darkMat);
  const column = MeshBuilder.CreateCylinder(
      `${name}SteeringColumn`, {diameter: 0.045, height: 0.5}, scene);
  column.position.set(0, 1.1, 0.16);
  column.rotation.x = -0.5;
  column.parent = root;
  column.material = darkMat;
  const wheel = MeshBuilder.CreateTorus(
      `${name}SteeringWheel`,
      {diameter: 0.2, thickness: 0.022, tessellation: 16},
      scene,
  );
  wheel.position.set(0, 1.3, 0.28);
  wheel.rotation.x = Math.PI / 2 - 0.5;
  wheel.parent = root;
  wheel.material = darkMat;

  for (const z of [-0.5, 0.28]) {
    for (const x of [-0.42, 0.42]) {
      add('CagePost', {width: 0.055, height: 0.88, depth: 0.055},
          [x, 1.6, z], darkMat);
    }
  }
  add('CageRoof', {width: 0.96, height: 0.055, depth: 1.05}, [0, 2.06, -0.11],
      darkMat);
  for (const x of [-0.42, 0.42]) {
    add('Mast', {width: 0.09, height: 1.9, depth: 0.09}, [x, 1.12, 0.78],
        darkMat);
  }
  for (const y of [0.75, 1.45, 1.95]) {
    add('MastTie', {width: 0.95, height: 0.06, depth: 0.07}, [0, y, 0.78],
        darkMat);
  }
  add('Carriage', {width: 0.9, height: 0.62, depth: 0.07}, [0, 0.76, 0.88],
      yellowMat);
  const cylinder = MeshBuilder.CreateCylinder(
      `${name}Hydraulic`, {diameter: 0.075, height: 1.35}, scene);
  cylinder.position.set(0, 1.16, 0.8);
  cylinder.parent = root;
  cylinder.material = darkMat;
  for (const x of [-0.3, 0.3]) {
    add('ForkUpright', {width: 0.09, height: 0.66, depth: 0.055},
        [x, 0.44, 0.93], darkMat);
    add('ForkTine', {width: 0.09, height: 0.05, depth: 0.9}, [x, 0.11, 1.4],
        darkMat);
    add('Fender', {width: 0.16, height: 0.06, depth: 0.62}, [x, 0.54, 0.52],
        yellowMat);
  }
  const wheelSpec = {diameter: 0.5, height: 0.22, tessellation: 14};
  for (const [x, z] of [[-0.57, 0.55], [0.57, 0.55], [-0.55, -0.58],
    [0.55, -0.58]] as const) {
    const wheelMesh = MeshBuilder.CreateCylinder(
        `${name}Wheel`, wheelSpec, scene);
    wheelMesh.rotation.z = Math.PI / 2;
    wheelMesh.position.set(x, 0.25, z);
    wheelMesh.parent = root;
    wheelMesh.material = machineMat(
        scene, 'forkliftTyreMat', '#111317', '#020203', 'rubber', 2, 2);
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
): Mesh[] {
  const parts: Mesh[] = [];
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
    parts.push(upright);
  }
  for (const y of [1.2, 2.4, 3.6]) {
    const beam = MeshBuilder.CreateBox(
        `rackBeam${x}_${z}`, {width: 2.9, height: 0.09, depth: 0.09}, scene);
    beam.position.set(0, y, -0.55);
    beam.parent = frame;
    beam.material = steelMat;
    parts.push(beam);
    const beamBack = MeshBuilder.CreateBox(
        `rackBeamBack${x}_${z}`, {width: 2.9, height: 0.09, depth: 0.09},
        scene);
    beamBack.position.set(0, y, 0.55);
    beamBack.parent = frame;
    beamBack.material = steelMat;
    parts.push(beamBack);
    const load = MeshBuilder.CreateBox(
        `rackLoad${x}_${z}${y}`, {width: 2.7, height: 1.0, depth: 1.0},
        scene);
    load.position.set(0, y + 0.55, 0);
    load.parent = frame;
    load.material = loadMat;
    parts.push(load);
  }
  return parts;
}

function buildGrandHall(scene: Scene): void {
  const wallMat = machineMat(scene, 'hallWallMat', '#aeb6c0', '#363c44');
  const steelMat = machineMat(scene, 'hallSteelMat', '#7c8694', '#20252d');
  const yellowMat = machineMat(scene, 'hallYellowMat', '#d9a622', '#4a3a0c');
  const darkMat = machineMat(scene, 'hallDarkMat', '#2a2f3e', '#05070c');

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
      tiledMaterial(scene, 'hallRoofMat', 'galvanized', {
        uScale: 4,
        vScale: 3,
        offsetSeed: 'hallRoofMat',
      });
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
  const tubeMat = machineMat(
      scene, 'hallTubeMat', '#fff3d6', '#c9b98a', null);
  const fixtureMeshes: Mesh[] = [];
  for (const x of [-10, -4, 4, 10]) {
    for (const z of [-13, -19, -25]) {
      const tube = MeshBuilder.CreateBox('hallTube', fixtureSpec, scene);
      tube.position.set(x, 8.4, z);
      tube.material = tubeMat;
      fixtureMeshes.push(tube);
      const rod = MeshBuilder.CreateCylinder(
          'hallTubeRod', {diameter: 0.02, height: 1.5}, scene);
      rod.position.set(x, 9.2, z);
      rod.material = steelMat;
      fixtureMeshes.push(rod);
    }
  }
  mergeStatic(fixtureMeshes);

  const boomPivots: TransformNode[] = ROBOT_BASES.map(([x, z]) =>
    buildRobotArm(
        scene,
        yellowMat,
        darkMat,
        x,
        z,
        z < -25 ? 0 : x < 0 ? Math.PI / 4 : -Math.PI / 4,
    ),
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

  const loadMat =
      tiledMaterial(scene, 'rackLoadMat', 'cardboard', {
        uScale: 2,
        vScale: 2,
        offsetSeed: 'rackLoadMat',
      });
  const rackMeshes = [
    ...buildRack(scene, steelMat, loadMat, -13, -13, true),
    ...buildRack(scene, steelMat, loadMat, -13, -17, true),
    ...buildRack(scene, steelMat, loadMat, -13, -22, true),
    ...buildRack(scene, steelMat, loadMat, 13, -13, true),
    ...buildRack(scene, steelMat, loadMat, 13, -17, true),
    ...buildRack(scene, steelMat, loadMat, 13, -22, true),
  ];
  mergeStatic(rackMeshes);

  const pallet = Mesh.MergeMeshes([
    MeshBuilder.CreateBox('palletSlat', {width: 1.2, height: 0.04, depth: 1},
        scene),
    MeshBuilder.CreateBox('palletFoot', {width: 1.0, height: 0.1, depth: 0.8},
        scene),
  ], true, true);
  const crateMat = machineMat(
      scene, 'hallCrateMat', '#8a6f4d', '#2a2118', 'wood', 2, 2);
  const palletSpots: Array<[number, number]> = [
    [-14.5, -11], [-11.8, -12.2], [-14.2, -19.5], [14.5, -11.5],
    [11.5, -14.5], [14.2, -20], [-10, -25], [10.5, -25.2],
  ];
  const palletLoads: Mesh[] = [];
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
    palletLoads.push(load);
  });
  mergeStatic(palletLoads);
  if (pallet) {
    pallet.setEnabled(false);
  }

  const parked = buildForklift(scene, yellowMat, darkMat, 'forkliftParked');
  parked.position.set(FORKLIFT_PARKED.x, 0, FORKLIFT_PARKED.z);
  parked.rotation.y = -Math.PI / 2;
  const moving = buildForklift(scene, yellowMat, darkMat, 'forkliftMoving');
  moving.position.set(FORKLIFT_MOVING.x, 0, FORKLIFT_MOVING.zStart);
  moving.rotation.y = Math.PI;
  scene.onBeforeRenderObservable.add(() => {
    const cycle = 18;
    const t = (performance.now() / 1000) % cycle;
    const travel = FORKLIFT_MOVING.zStart - FORKLIFT_MOVING.zEnd;
    let z: number = FORKLIFT_MOVING.zStart;
    if (t < 7) {
      const phase = t / 7;
      const eased = phase * phase * (3 - 2 * phase);
      z = FORKLIFT_MOVING.zStart - travel * eased;
    } else if (t < 9) {
      z = FORKLIFT_MOVING.zEnd;
    } else if (t < 16) {
      const phase = (t - 9) / 7;
      const eased = phase * phase * (3 - 2 * phase);
      z = FORKLIFT_MOVING.zEnd + travel * eased;
    }
    moving.position.z = z;
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

  const seatMat = machineMat(
      scene, 'crowdSeatMat', '#6d7480', '#1e2229', 'fabric', 2, 2);
  const tierMat = machineMat(
      scene, 'crowdTierMat', '#565c66', '#181b20', 'paintedSteel', 2, 2);
  const figureMat = new StandardMaterial('crowdFigureMat', scene);
  figureMat.diffuseColor = Color3.FromHexString('#d9a622');
  figureMat.emissiveColor = new Color3(0.12, 0.09, 0.02);
  figureMat.specularColor = Color3.Black();
  applyTile(figureMat, scene, 'fabric', {
    uScale: 2,
    vScale: 2,
    offsetSeed: 'crowdFigureMat',
  });
  const hatMat = new StandardMaterial('crowdHatMat', scene);
  hatMat.diffuseColor = Color3.FromHexString('#2f6fd0');
  hatMat.emissiveColor = new Color3(0.03, 0.08, 0.2);
  hatMat.specularColor = new Color3(0.08, 0.1, 0.14);
  applyTile(hatMat, scene, 'paintedSteel', {
    uScale: 2,
    vScale: 2,
    offsetSeed: 'crowdHatMat',
  });

  const part = (
      name: string,
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
  ): Mesh => {
    const box = MeshBuilder.CreateBox(
        name, {width, height, depth}, scene);
    box.position.set(x, y, z);
    return box;
  };

  const head = (name: string, y: number, z = 0): Mesh => {
    const sphere = MeshBuilder.CreateSphere(
        name, {diameter: 0.17, segments: 8}, scene);
    sphere.position.set(0, y, z);
    return sphere;
  };

  const buildSeatedFigure = (name: string): Mesh | null =>
    Mesh.MergeMeshes([
      part(`${name}-lap`, 0.34, 0.2, 0.42, 0, 0.02, 0.08),
      part(`${name}-torso`, 0.36, 0.46, 0.22, 0, 0.35, 0),
      part(`${name}-armL`, 0.1, 0.32, 0.12, -0.23, 0.32, 0.02),
      part(`${name}-armR`, 0.1, 0.32, 0.12, 0.23, 0.32, 0.02),
      head(`${name}-head`, 0.69, 0.01),
    ], true, true);

  const buildHat = (name: string): Mesh | null => {
    const dome = MeshBuilder.CreateSphere(
        `${name}-dome`, {diameter: 0.21, segments: 10}, scene);
    dome.scaling.y = 0.62;
    dome.position.set(0, 0.045, 0);
    return Mesh.MergeMeshes([dome,
      MeshBuilder.CreateCylinder(
          `${name}-brim`, {diameter: 0.3, height: 0.02}, scene,
      )], true, true);
  };

  const seat = Mesh.MergeMeshes([
    part('crowdSeat', 0.46, 0.06, 0.44, 0, 0, 0),
    part('crowdBack', 0.46, 0.5, 0.06, 0, 0.28, -0.21),
  ], true, true);
  const seated = buildSeatedFigure('crowdSeated');
  const hat = buildHat('crowdHat');

  if (seat && seated && hat) {
    seat.material = seatMat;
    seated.material = figureMat;
    hat.material = hatMat;
    for (const source of [seat, seated, hat]) {
      source.setEnabled(false);
    }

    let seatIndex = 0;
    let figureIndex = 0;
    let hatIndex = 0;
    for (let row = 0; row < AUDIENCE_ROWS; row++) {
      const tierTop = 0.42 + row * 0.24;
      const z = -11.1 - row * 0.92;
      const tier = part(`crowdTier${row}`, 6.8, tierTop, 1.0, 0,
          tierTop / 2, z);
      tier.material = tierMat;
      for (let col = 0; col < AUDIENCE_COLS; col++) {
        const x = -2.25 + col * 0.9;
        seat.createInstance(`crowdSeatInstance${seatIndex++}`)
            .position.set(x, tierTop + 0.03, z);
        seated.createInstance(`crowdFigureInstance${figureIndex++}`)
            .position.set(x, tierTop + 0.06, z - 0.02);
        hat.createInstance(`crowdHatInstance${hatIndex++}`)
            .position.set(x, tierTop + 0.78, z - 0.02);
      }
    }
  }

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

  const doorMat =
      tiledMaterial(scene, 'garageDoorMat', 'paintedSteel', {
        uScale: 2,
        vScale: 2,
        offsetSeed: 'garageDoorMat',
      });
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
  const steelMat =
      tiledMaterial(scene, 'benchSteelMat', 'bareSteel', {
        uScale: 2,
        vScale: 2,
        offsetSeed: 'benchSteelMat',
      });
  const pegMat =
      tiledMaterial(scene, 'benchPegMat', 'pegboard', {
        uScale: 2,
        vScale: 2,
        offsetSeed: 'benchPegMat',
      });
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

const BARRIER_HEIGHTS = [0.5, 0.95] as const;

function buildBarrierFence(scene: Scene): Mesh[] {
  const yellowMat = machineMat(
      scene, 'barrierYellowMat', '#d9a622', '#4a3a0c', 'paintedSteel', 2, 2);
  const footMat = machineMat(
      scene, 'barrierFootMat', '#2a2f3e', '#05070c', 'rubber', 2, 2);
  const stripeMat = hazardMat(scene);
  const half = BARRIER_HALF;
  const span = half * 2;
  const segments = Math.ceil(span / BARRIER_SEGMENT);
  const step = span / segments;
  const rails: Mesh[] = [];
  const trims: Mesh[] = [];
  const addPost = (px: number, pz: number): void => {
    const post = MeshBuilder.CreateBox(
        'barrierPost', {width: 0.05, height: 1.0, depth: 0.05}, scene);
    post.position.set(px, 0.5, pz);
    post.material = yellowMat;
    trims.push(post);
    const foot = MeshBuilder.CreateBox(
        'barrierFoot', {width: 0.16, height: 0.04, depth: 0.16}, scene);
    foot.position.set(px, 0.02, pz);
    foot.material = footMat;
    trims.push(foot);
  };
  const addRail = (
      alongX: boolean,
      fixed: number,
      y: number,
      center: number,
      length: number,
  ): void => {
    const rail = MeshBuilder.CreateBox(
        'barrierRail',
        alongX ?
            {width: length, height: 0.06, depth: 0.045} :
            {width: 0.045, height: 0.06, depth: length},
        scene,
    );
    if (alongX) {
      rail.position.set(center, y, fixed);
    } else {
      rail.position.set(fixed, y, center);
    }
    rail.material = y > 0.9 ? stripeMat : yellowMat;
    rail.isPickable = false;
    rails.push(rail);
  };
  for (const fixed of [-half, half]) {
    for (let i = 0; i <= segments; i++) {
      const along = -half + i * step;
      addPost(along, fixed);
      addPost(fixed, along);
    }
    for (let i = 0; i < segments; i++) {
      const center = -half + (i + 0.5) * step;
      for (const y of BARRIER_HEIGHTS) {
        addRail(true, fixed, y, center, step);
        addRail(false, fixed, y, center, step);
      }
    }
  }
  const trim = Mesh.MergeMeshes(trims, true, true);
  if (trim) {
    trim.name = 'barrierTrims';
    trim.isPickable = false;
  }
  mergeStatic(rails.filter((rail) => rail.material !== stripeMat));
  const colliders: Mesh[] = [];
  for (const [alongX, fixed] of [
    [true, -half], [true, half], [false, -half], [false, half],
  ] as const) {
    const collider = MeshBuilder.CreateBox(
        'barrierCollider',
        alongX ?
            {width: span + 0.1, height: 1, depth: 0.08} :
            {width: 0.08, height: 1, depth: span + 0.1},
        scene,
    );
    if (alongX) {
      collider.position.set(0, 0.5, fixed);
    } else {
      collider.position.set(fixed, 0.5, 0);
    }
    collider.isVisible = false;
    collider.isPickable = false;
    colliders.push(collider);
  }
  return colliders;
}

const WALL_Z = 8.2;
const WALL_HEIGHT = 10;
const BEAM_LEVELS = [3.2, 6.4, 9.2];

function buildWarehouse(scene: Scene): void {
  const wallMat = machineMat(scene, 'warehouseWallMat', '#b6bfca', '#3a4149');
  const steelMat = machineMat(scene, 'warehouseSteelMat', '#7c8694', '#20252d');
  const crateMat = machineMat(
      scene, 'warehouseCrateMat', '#8a6f4d', '#2a2118', 'wood', 2, 2);
  const bulbMat = machineMat(
      scene, 'warehouseBulbMat', '#fff3d6', '#8a7a54', null);
  const fixtureMat =
      machineMat(scene, 'warehouseFixtureMat', '#f5f8ff', '#c9d2e0', null);
  const steelParts: Mesh[] = [];
  const bulbParts: Mesh[] = [];
  const barParts: Mesh[] = [];
  const panelParts: Mesh[] = [];
  const crateParts: Mesh[] = [];

  const wallSpec = {width: 24, depth: 0.2, height: WALL_HEIGHT};
  const front = MeshBuilder.CreateBox('warehouseFront', wallSpec, scene);
  front.position.set(0, WALL_HEIGHT / 2, WALL_Z);
  front.material = wallMat;
  const opening = MeshBuilder.CreateBox(
      'warehouseBack', {width: 24, depth: 0.2, height: 0.85}, scene);
  opening.position.set(0, 0.425, -WALL_Z);
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
  steelParts.push(rail);
  const postSpec = {width: 0.06, depth: 0.06, height: 1};
  for (let x = -11.5; x <= 11.5; x += 2.3) {
    const post = MeshBuilder.CreateBox('warehouseRailPost', postSpec, scene);
    post.position.set(x, railY + 0.5, -4);
    post.material = steelMat;
    steelParts.push(post);
  }

  const pendantTop = railY + 1;
  const pendantShadeY = 2.9;
  const pendantCordHeight = pendantTop - pendantShadeY;
  for (const x of [-2, 0, 2]) {
    const cord = MeshBuilder.CreateCylinder(
        `warehouseCord${x}`, {diameter: 0.02, height: pendantCordHeight},
        scene);
    cord.position.set(x, pendantTop - pendantCordHeight / 2, 0.5);
    cord.material = steelMat;
    steelParts.push(cord);
    const shade = MeshBuilder.CreateCylinder(
        `warehouseShade${x}`, {diameterTop: 0.08, diameterBottom: 0.3,
          height: 0.18}, scene);
    shade.position.set(x, pendantShadeY, 0.5);
    shade.material = steelMat;
    steelParts.push(shade);
    const bulb = MeshBuilder.CreateSphere(
        `warehouseBulb${x}`, {diameter: 0.12}, scene);
    bulb.position.set(x, pendantShadeY - 0.1, 0.5);
    bulb.material = bulbMat;
    bulbParts.push(bulb);
  }

  const barSpec = {width: 1.8, depth: 0.22, height: 0.08};
  const cordSpec = {diameter: 0.015, height: 5.9};
  for (const x of [-6, -2.4, 2.4, 6]) {
    const bar = MeshBuilder.CreateBox('warehouseBayBar', barSpec, scene);
    bar.position.set(x, 3.18, 0.6);
    bar.material = fixtureMat;
    barParts.push(bar);
    for (const dx of [-0.7, 0.7]) {
      const hang = MeshBuilder.CreateCylinder(
          'warehouseBayCord', cordSpec, scene);
      hang.position.set(x + dx, 6.14, 0.6);
      hang.material = steelMat;
      steelParts.push(hang);
    }
  }

  const purlinSpec = {width: 0.15, depth: 16.4, height: 0.25};
  for (const x of [-8, -4, 0, 4, 8]) {
    const purlin = MeshBuilder.CreateBox('warehousePurlin', purlinSpec, scene);
    purlin.position.set(x, 9.8, 0);
    purlin.material = steelMat;
    steelParts.push(purlin);
  }

  const roof = MeshBuilder.CreateBox(
      'warehouseRoof', {width: 23.6, depth: 0.06, height: 16.6}, scene);
  roof.rotation.x = Math.PI / 2;
  roof.position.set(0, 9.97, 0);
  roof.material =
      tiledMaterial(scene, 'warehouseRoofMat', 'galvanized', {
        uScale: 4,
        vScale: 3,
        offsetSeed: 'warehouseRoofMat',
      });

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
      panelParts.push(panel);
    }
  }

  const crateSpec = {width: 0.8, depth: 0.8, height: 0.8};
  WAREHOUSE_CRATE_SPOTS.forEach(([x, y, z], index) => {
    const crate = MeshBuilder.CreateBox(
        `warehouseCrate${index}`, crateSpec, scene);
    crate.position.set(x, y, z);
    crate.rotation.y = (index % 3) * 0.21;
    crate.material = crateMat;
    crateParts.push(crate);
  });
  mergeStatic(steelParts);
  mergeStatic(bulbParts);
  mergeStatic(barParts);
  mergeStatic(panelParts);
  mergeStatic(crateParts);
}

export function createEnvironment(canvas: HTMLCanvasElement): Environment {
  const engine = new Engine(canvas, true, {stencil: false, audioEngine: true});
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
      tiledMaterial(scene, 'groundMat', 'concrete', {
        uScale: 20,
        vScale: 11,
        offsetSeed: 'groundMat',
      });
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

  const printerBed = buildPrinter(scene);
  buildPrinterBench(scene);
  const conveyorBelt = buildConveyor(scene);
  buildWarehouse(scene);
  buildGrandHall(scene);
  const barrierRails = buildBarrierFence(scene);

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
      new Vector3(CONVEYOR_HOME.x, CONVEYOR_BELT_TOP, CONVEYOR_HOME.z),
      new Vector3(0.42, 0.12, 0.42),
  );
  const hood = env.scene.getMeshByName('conveyorHood');
  if (hood instanceof Mesh) {
    addStaticCollider(
        env.scene,
        hood,
        new Vector3(0.62, 0.19, 2.24),
        new Vector3(0.62, 0.34, 0.52),
    );
  }
  for (const rail of env.barrierRails) {
    makeBoxBody(rail, PhysicsMotionType.STATIC, 0);
  }
}

import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {SceneLoader} from '@babylonjs/core/Loading/sceneLoader';
import {Scene} from '@babylonjs/core/scene';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/loaders/STL';
import type {GameSettings} from '../game/settings';
import {FILAMENT_COLORS, FALLBACK_HEX, type ThemeSlot} from '../game/palette';
import type {PartDef} from '../game/handParts';
import {brushedMetalMaterial} from './metal';
import {applyTile, ensurePlanarUVs} from './textures';

export type PrototypeMap = Map<string, Mesh>;
export type PartMeshProvider = (def: PartDef, scene: Scene) => Mesh;

export interface ThemeMaterials {
  body: StandardMaterial;
  accent: StandardMaterial;
  trim: StandardMaterial;
}

type MaterialRole = keyof ThemeMaterials;

const STL_FILES = [
  'palm.stl',
  'finger.stl',
  'thumb-base.stl',
  'thumb-segments.stl',
  'upper-cover.stl',
];

const FILE_ROLES: Readonly<Record<string, MaterialRole>> = {
  'palm.stl': 'body',
  'finger.stl': 'body',
  'thumb-base.stl': 'body',
  'thumb-segments.stl': 'body',
  'upper-cover.stl': 'accent',
};

const MODEL_DIR = 'models/hand/';

function colorForSlot(settings: GameSettings, slot: ThemeSlot): string {
  const index = slot === 'primary' ? settings.themePrimary :
      slot === 'secondary' ? settings.themeSecondary :
      settings.themeTertiary;
  return FILAMENT_COLORS[index]?.hex ?? FALLBACK_HEX;
}

export function createThemeMaterials(
    scene: Scene,
    settings: GameSettings,
): ThemeMaterials {
  const build = (slot: ThemeSlot, name: string): StandardMaterial => {
    const mat = new StandardMaterial(name, scene);
    const diffuse = Color3.FromHexString(colorForSlot(settings, slot));
    mat.diffuseColor = diffuse;
    mat.emissiveColor = diffuse.scale(0.06);
    mat.specularColor = new Color3(0.05, 0.05, 0.06);
    applyTile(mat, scene, 'pla', {offsetSeed: name});
    return mat;
  };
  return {
    body: build('primary', 'themeBodyMat'),
    accent: build('secondary', 'themeAccentMat'),
    trim: build('tertiary', 'themeTrimMat'),
  };
}

export function applyTheme(
    theme: ThemeMaterials,
    settings: GameSettings,
): void {
  const set = (mat: StandardMaterial, hex: string): void => {
    const diffuse = Color3.FromHexString(hex);
    mat.diffuseColor = diffuse;
    mat.emissiveColor = diffuse.scale(0.06);
  };
  set(theme.body, colorForSlot(settings, 'primary'));
  set(theme.accent, colorForSlot(settings, 'secondary'));
  set(theme.trim, colorForSlot(settings, 'tertiary'));
}

export async function loadPrototypes(
    scene: Scene,
    theme: ThemeMaterials,
): Promise<PrototypeMap> {
  const map: PrototypeMap = new Map();
  for (const file of STL_FILES) {
    const result = await SceneLoader.ImportMeshAsync(
        '',
        MODEL_DIR,
        file,
        scene,
    );
    const mesh =
        result.meshes.find((entry): entry is Mesh => entry instanceof Mesh);
    if (!mesh) {
      throw new Error(`STL ${file} produced no mesh`);
    }
    mesh.name = `proto:${file}`;
    mesh.material = theme[FILE_ROLES[file] ?? 'body'];
    mesh.setEnabled(false);
    map.set(file, mesh);
  }
  return map;
}

function proxyMaterial(
    scene: Scene,
    name: string,
    hex: string,
    tile?: 'paintedSteel' | 'rubber' | 'fabric',
): StandardMaterial {
  const cached = scene.getMaterialByName(name);
  if (cached instanceof StandardMaterial) {
    return cached;
  }
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.emissiveColor = Color3.FromHexString(hex).scale(0.08);
  mat.specularColor = new Color3(0.12, 0.12, 0.14);
  if (tile) {
    applyTile(mat, scene, tile, {
      uScale: 2,
      vScale: 2,
      offsetSeed: name,
    });
  }
  return mat;
}

function child(
    parent: Mesh,
    mesh: Mesh,
    material: StandardMaterial,
): Mesh {
  mesh.parent = parent;
  mesh.material = material;
  mesh.isPickable = false;
  return mesh;
}

function buildServo(id: string, scene: Scene): Mesh {
  const bodyMat =
      proxyMaterial(scene, 'servoBodyMat', '#20262e', 'paintedSteel');
  const darkMat = proxyMaterial(scene, 'servoDarkMat', '#0d1116', 'rubber');
  const metal = brushedMetalMaterial(scene);
  const body = MeshBuilder.CreateBox(
      `part:${id}`,
      {width: 0.05, height: 0.10, depth: 0.03},
      scene,
  );
  body.material = bodyMat;

  child(
      body,
      MeshBuilder.CreateBox(
          `part:${id}-top`, {width: 0.034, height: 0.04, depth: 0.008},
          scene),
      metal,
  ).position.set(0, 0.014, -0.018);
  child(
      body,
      MeshBuilder.CreateBox(
          `part:${id}-mount`, {width: 0.05, height: 0.09, depth: 0.016},
          scene),
      metal,
  ).position.z = 0.025;
  child(
      body,
      MeshBuilder.CreateBox(
          `part:${id}-seam`, {width: 0.041, height: 0.06, depth: 0.002},
          scene),
      darkMat,
  ).position.y = -0.006;
  child(
      body,
      MeshBuilder.CreateBox(
          `part:${id}-gearbox`, {width: 0.024, height: 0.024, depth: 0.01},
          scene),
      metal,
  ).position.set(0, 0.01, -0.024);

  for (const side of [-1, 1]) {
    const tab = child(
        body,
        MeshBuilder.CreateBox(
            `part:${id}-tab-${side > 0 ? 'r' : 'l'}`,
            {width: 0.03, height: 0.018, depth: 0.006},
            scene),
        metal,
    );
    tab.position.set(side * 0.04, -0.055, -0.015);
    const hole = child(
        body,
        MeshBuilder.CreateCylinder(
            `part:${id}-hole-${side > 0 ? 'r' : 'l'}`,
            {diameter: 0.008, height: 0.008, tessellation: 10},
            scene),
        darkMat,
    );
    hole.rotation.x = Math.PI / 2;
    hole.position.set(side * 0.04, -0.055, -0.015);
  }

  const horn = child(
      body,
      MeshBuilder.CreateCylinder(
          `part:${id}-horn`,
          {diameter: 0.016, height: 0.008, tessellation: 16},
          scene),
      metal,
  );
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, 0.025, -0.025);
  const arm = child(
      body,
      MeshBuilder.CreateBox(
          `part:${id}-arm`, {width: 0.03, height: 0.008, depth: 0.005},
          scene),
      metal,
  );
  arm.position.set(0.008, 0.025, -0.03);
  const shaft = child(
      body,
      MeshBuilder.CreateCylinder(
          `part:${id}-shaft`,
          {diameter: 0.004, height: 0.008, tessellation: 10},
          scene),
      metal,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.set(0, 0.025, -0.034);

  const wireColors = ['#b23a2e', '#1e242c', '#d8a62c'];
  wireColors.forEach((hex, index) => {
    const wire = child(
        body,
        MeshBuilder.CreateCylinder(
            `part:${id}-wire-${index}`,
            {diameter: 0.003, height: 0.055, tessellation: 8},
            scene),
        proxyMaterial(scene, `servoWireMat${index}`, hex, 'rubber'),
    );
    wire.position.set(-0.018 + index * 0.018, -0.072, 0);
  });
  return body;
}

function buildWristPlate(
    id: string,
    scene: Scene,
    material: StandardMaterial,
): Mesh {
  const plate = MeshBuilder.CreateBox(
      `part:${id}`,
      {width: 0.17, height: 0.026, depth: 0.105},
      scene,
  );
  plate.material = material;
  const collar = MeshBuilder.CreateCylinder(
      `part:${id}-collar`,
      {diameter: 0.085, height: 0.02, tessellation: 20},
      scene,
  );
  collar.position.y = 0.018;
  collar.material = material;
  const merged = Mesh.MergeMeshes([plate, collar], true, true);
  if (!merged) {
    throw new Error(`failed to build ${id}`);
  }
  merged.name = `part:${id}`;
  merged.material = material;
  return merged;
}

function buildPin(
    id: string,
    scene: Scene,
    material: StandardMaterial,
): Mesh {
  const length = id.includes('thumb') ? 0.048 : 0.057;
  const body = MeshBuilder.CreateCylinder(
      `part:${id}`,
      {diameter: 0.012, height: length, tessellation: 12},
      scene,
  );
  body.rotation.z = Math.PI / 2;
  body.material = material;
  const parts: Mesh[] = [body];
  for (const side of [-1, 1]) {
    const cap = MeshBuilder.CreateCylinder(
        `part:${id}-cap${side > 0 ? 'a' : 'b'}`,
        {diameter: 0.018, height: 0.006, tessellation: 12},
        scene,
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.x = side * length / 2;
    cap.material = material;
    parts.push(cap);
  }
  const merged = Mesh.MergeMeshes(parts, true, true);
  if (!merged) {
    throw new Error(`failed to build ${id}`);
  }
  merged.name = `part:${id}`;
  merged.material = material;
  return merged;
}

function buildHingeBoss(
    id: string,
    scene: Scene,
    material: StandardMaterial,
): Mesh {
  const boss = MeshBuilder.CreateCylinder(
      `part:${id}`,
      {diameter: 0.038, height: 0.034, tessellation: 18},
      scene,
  );
  boss.rotation.z = Math.PI / 2;
  boss.material = material;
  const flange = MeshBuilder.CreateCylinder(
      `part:${id}-flange`,
      {diameter: 0.052, height: 0.008, tessellation: 18},
      scene,
  );
  flange.rotation.z = Math.PI / 2;
  flange.position.x = 0.018;
  flange.material = material;
  const merged = Mesh.MergeMeshes([boss, flange], true, true);
  if (!merged) {
    throw new Error(`failed to build ${id}`);
  }
  merged.name = `part:${id}`;
  merged.material = material;
  return merged;
}

export function createPartProvider(
    prototypes: PrototypeMap,
    theme?: ThemeMaterials,
): PartMeshProvider {
  return (def: PartDef, scene: Scene): Mesh => {
    if (def.file) {
      const proto = prototypes.get(def.file);
      if (!proto) {
        throw new Error(`missing prototype for ${def.file}`);
      }
      const mesh = proto.clone(`part:${def.id}`);
      mesh.makeGeometryUnique();
      if (def.scale !== 1) {
        mesh.scaling.setAll(def.scale);
        mesh.bakeCurrentTransformIntoVertices();
        mesh.scaling.setAll(1);
      }
      ensurePlanarUVs(mesh, 18, 55);
      return mesh;
    }
    if (def.primitive === 'servo') {
      return buildServo(def.id, scene);
    }
    const printed = theme?.trim ?? proxyMaterial(
        scene, 'partPrintedMat', '#8a9a7b', 'paintedSteel');
    if (def.primitive === 'wrist-plate') {
      return buildWristPlate(def.id, scene, printed);
    }
    if (def.primitive === 'pin') {
      return buildPin(def.id, scene, brushedMetalMaterial(scene));
    }
    if (def.primitive === 'hinge-boss') {
      return buildHingeBoss(def.id, scene, printed);
    }
    throw new Error(`no mesh source for ${def.id}`);
  };
}

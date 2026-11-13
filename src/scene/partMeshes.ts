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
): StandardMaterial {
  const cached = scene.getMaterialByName(name);
  if (cached instanceof StandardMaterial) {
    return cached;
  }
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.emissiveColor = Color3.FromHexString(hex).scale(0.08);
  mat.specularColor = new Color3(0.12, 0.12, 0.14);
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
  const bodyMat = proxyMaterial(scene, 'servoBodyMat', '#20262e');
  const darkMat = proxyMaterial(scene, 'servoDarkMat', '#0d1116');
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
        proxyMaterial(scene, `servoWireMat${index}`, hex),
    );
    wire.position.set(-0.018 + index * 0.018, -0.072, 0);
  });
  return body;
}

export function createPartProvider(
    prototypes: PrototypeMap,
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
      return mesh;
    }
    if (def.primitive === 'servo') {
      return buildServo(def.id, scene);
    }
    throw new Error(`no mesh source for ${def.id}`);
  };
}

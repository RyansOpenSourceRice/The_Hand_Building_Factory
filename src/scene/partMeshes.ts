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
    mat.diffuseColor = Color3.FromHexString(colorForSlot(settings, slot));
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
  theme.body.diffuseColor =
      Color3.FromHexString(colorForSlot(settings, 'primary'));
  theme.accent.diffuseColor =
      Color3.FromHexString(colorForSlot(settings, 'secondary'));
  theme.trim.diffuseColor =
      Color3.FromHexString(colorForSlot(settings, 'tertiary'));
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

function buildServo(id: string, theme: ThemeMaterials, scene: Scene): Mesh {
  const body = MeshBuilder.CreateBox(
      `part:${id}`,
      {width: 0.126, depth: 0.126, height: 0.063},
      scene,
  );
  const horn = MeshBuilder.CreateCylinder(
      `part:${id}-horn`,
      {diameter: 0.042, height: 0.018},
      scene,
  );
  horn.position.y = 0.04;
  horn.material = theme.trim;
  horn.parent = body;
  body.material = theme.accent;
  return body;
}

export function createPartProvider(
    prototypes: PrototypeMap,
    theme: ThemeMaterials,
): PartMeshProvider {
  return (def: PartDef, scene: Scene): Mesh => {
    if (def.file) {
      const proto = prototypes.get(def.file);
      if (!proto) {
        throw new Error(`missing prototype for ${def.file}`);
      }
      const mesh = proto.clone(`part:${def.id}`);
      if (def.scale !== 1) {
        mesh.scaling.setAll(def.scale);
        mesh.bakeCurrentTransformIntoVertices();
        mesh.scaling.setAll(1);
      }
      return mesh;
    }
    if (def.primitive === 'servo') {
      return buildServo(def.id, theme, scene);
    }
    throw new Error(`no mesh source for ${def.id}`);
  };
}

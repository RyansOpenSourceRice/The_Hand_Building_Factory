import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {SceneLoader} from '@babylonjs/core/Loading/sceneLoader';
import {Scene} from '@babylonjs/core/scene';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/loaders/glTF';
import type {GameSettings} from '../game/settings';
import {FILAMENT_COLORS, FALLBACK_HEX, type ThemeSlot} from '../game/palette';
import type {PartDef} from '../game/handParts';
import {applyTile} from './textures';

export type PrototypeMap = Map<string, Mesh>;
export type PartMeshProvider = (def: PartDef, scene: Scene) => Mesh;

export interface ThemeMaterials {
  body: StandardMaterial;
  accent: StandardMaterial;
  trim: StandardMaterial;
}

type MaterialRole = keyof ThemeMaterials;

const GLB_FILES = [
  'palm.glb',
  'finger.glb',
  'thumb-base.glb',
  'thumb-segments.glb',
  'upper-cover.glb',
  'servo.glb',
  'wrist-plate.glb',
  'pin.glb',
  'thumb-pin.glb',
  'hinge-boss.glb',
  'knuckle-cap.glb',
];

// Parts we print get the palette so players can pick their filament. The
// servo is a bought component, so it keeps the materials it is modelled
// with.
const FILE_ROLES: Readonly<Record<string, MaterialRole>> = {
  'palm.glb': 'body',
  'finger.glb': 'body',
  'thumb-base.glb': 'body',
  'thumb-segments.glb': 'body',
  'upper-cover.glb': 'accent',
  'wrist-plate.glb': 'trim',
  'pin.glb': 'trim',
  'thumb-pin.glb': 'trim',
  'hinge-boss.glb': 'trim',
  'knuckle-cap.glb': 'accent',
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

export type ExportedAnchor = {
  point: [number, number, number];
  normal: [number, number, number];
};
export type ExportedAnchors = Record<string, ExportedAnchor[]>;

export async function loadPartAnchors(): Promise<ExportedAnchors> {
  const response = await fetch(`${MODEL_DIR}parts.json`);
  if (!response.ok) {
    throw new Error(`missing parts.json (${response.status})`);
  }
  const payload = await response.json() as {
    parts: Record<string, {anchors?: ExportedAnchor[]}>;
  };
  const anchors: ExportedAnchors = {};
  for (const [id, entry] of Object.entries(payload.parts ?? {})) {
    // Screwless parts still get an entry: a missing one means the manifest
    // and the part list have drifted apart, and that should fail loudly.
    anchors[id] = entry.anchors ?? [];
  }
  return anchors;
}

export async function loadPrototypes(
    scene: Scene,
    theme: ThemeMaterials,
): Promise<PrototypeMap> {
  const map: PrototypeMap = new Map();
  for (const file of GLB_FILES) {
    const result = await SceneLoader.ImportMeshAsync(
        '',
        MODEL_DIR,
        file,
        scene,
    );
    // A glTF import returns a root node plus the real mesh, and the root
    // carries no geometry, so pick the mesh with vertices.
    const mesh = result.meshes
        .filter((entry): entry is Mesh => entry instanceof Mesh)
        .reduce<Mesh | null>(
            (best, entry) =>
              entry.getTotalVertices() > (best?.getTotalVertices() ?? 0) ?
                entry : best,
            null,
        );
    if (!mesh) {
      throw new Error(`GLB ${file} produced no mesh`);
    }
    // The loader parents every import under a root that mirrors x, which is
    // how a right-handed glTF file is converted for this left-handed scene.
    // The exported meshes are already baked into the game frame and are
    // always cloned as bare parts, so drop that root and cancel its mirror by
    // reversing the winding instead. A part that kept the root would answer
    // to it as its hierarchy root, and grabbing looks parts up that way.
    mesh.parent = null;
    mesh.flipFaces(false);
    for (const node of result.meshes) {
      if (node !== mesh) {
        node.dispose(false, true);
      }
    }
    mesh.name = `proto:${file}`;
    const role = FILE_ROLES[file];
    if (role) {
      mesh.material = theme[role];
    }
    mesh.setEnabled(false);
    map.set(file, mesh);
  }
  return map;
}

export function createPartProvider(
    prototypes: PrototypeMap,
): PartMeshProvider {
  return (def: PartDef): Mesh => {
    const proto = prototypes.get(def.file);
    if (!proto) {
      throw new Error(`missing prototype for ${def.file}`);
    }
    // Clones share prototype geometry, so the four fingers draw one mesh and
    // the five servos draw another. The GLBs already carry real UVs and
    // game-scale units.
    return proto.clone(`part:${def.id}`);
  };
}

import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {SceneLoader} from '@babylonjs/core/Loading/sceneLoader';
import {Scene} from '@babylonjs/core/scene';
import '@babylonjs/loaders/STL';
import type {PartDef} from '../game/handParts';

export type PrototypeMap = Map<string, Mesh>;
export type PartMeshProvider = (def: PartDef, scene: Scene) => Mesh;

const STL_FILES = [
  'palm.stl',
  'finger.stl',
  'thumb-base.stl',
  'thumb-segments.stl',
  'upper-cover.stl',
];

const MODEL_DIR = 'models/hand/';

export async function loadPrototypes(scene: Scene): Promise<PrototypeMap> {
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
    mesh.setEnabled(false);
    map.set(file, mesh);
  }
  return map;
}

function buildServo(id: string, scene: Scene): Mesh {
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
  horn.parent = body;
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

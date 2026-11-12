import {Color3} from '@babylonjs/core/Maths/math.color';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Scene} from '@babylonjs/core/scene';

const HEAD_DIAMETER = 0.016;
const HEAD_HEIGHT = 0.0045;
const SHAFT_DIAMETER = 0.008;
const SHAFT_HEIGHT = 0.015;
const TESSELATION = 8;

function screwMaterial(scene: Scene): StandardMaterial {
  const cached = scene.getMaterialByName('screwMat');
  if (cached instanceof StandardMaterial) {
    return cached;
  }
  const mat = new StandardMaterial('screwMat', scene);
  mat.diffuseColor = new Color3(0.86, 0.88, 0.92);
  mat.emissiveColor = new Color3(0.16, 0.17, 0.2);
  mat.specularColor = new Color3(0.4, 0.4, 0.45);
  return mat;
}

export function createScrew(id: string, scene: Scene): Mesh {
  const head = MeshBuilder.CreateCylinder(
      `screw:${id}-head`,
      {
        diameter: HEAD_DIAMETER,
        height: HEAD_HEIGHT,
        tessellation: TESSELATION,
      },
      scene,
  );
  head.position.y = SHAFT_HEIGHT / 2 + HEAD_HEIGHT / 2;
  const shaft = MeshBuilder.CreateCylinder(
      `screw:${id}-shaft`,
      {
        diameter: SHAFT_DIAMETER,
        height: SHAFT_HEIGHT,
        tessellation: TESSELATION,
      },
      scene,
  );
  const root = Mesh.MergeMeshes([head, shaft], true, true, undefined, false);
  if (!root) {
    throw new Error(`failed to build screw ${id}`);
  }
  root.name = `screw:${id}`;
  root.material = screwMaterial(scene);
  root.setEnabled(false);
  return root;
}

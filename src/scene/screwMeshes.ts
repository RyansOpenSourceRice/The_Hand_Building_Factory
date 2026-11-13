import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {brushedMetalMaterial} from './metal';

export const SCREW_HEAD_DIAMETER = 0.018;
export const SCREW_HEAD_HEIGHT = 0.005;
const SHAFT_DIAMETER = 0.006;
const SHAFT_HEIGHT = 0.03;
const TESSELATION = 12;

export function createScrew(id: string, scene: Scene): Mesh {
  const head = MeshBuilder.CreateCylinder(
      `screw:${id}-head`,
      {
        diameter: SCREW_HEAD_DIAMETER,
        height: SCREW_HEAD_HEIGHT,
        tessellation: TESSELATION,
      },
      scene,
  );
  head.position.y = SCREW_HEAD_HEIGHT / 2;
  const shaft = MeshBuilder.CreateCylinder(
      `screw:${id}-shaft`,
      {
        diameter: SHAFT_DIAMETER,
        height: SHAFT_HEIGHT,
        tessellation: TESSELATION,
      },
      scene,
  );
  shaft.position.y = -SHAFT_HEIGHT / 2;
  const root = Mesh.MergeMeshes([head, shaft], true, true, undefined, false);
  if (!root) {
    throw new Error(`failed to build screw ${id}`);
  }
  root.name = `screw:${id}`;
  root.material = brushedMetalMaterial(scene, 'screwMetalMat');
  root.setEnabled(false);
  return root;
}

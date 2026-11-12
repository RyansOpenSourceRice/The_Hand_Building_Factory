import {Color3} from '@babylonjs/core/Maths/math.color';
import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Scene} from '@babylonjs/core/scene';

const HOVER = 0.11;
const PART_HOVER = 0.3;
const BOB = 0.008;

function arrowMesh(
    name: string,
    scene: Scene,
    material: StandardMaterial,
): Mesh {
  const shaft = MeshBuilder.CreateCylinder(
      `${name}-shaft`, {diameter: 0.008, height: 0.05, tessellation: 8}, scene);
  const tip = MeshBuilder.CreateCylinder(
      `${name}-tip`,
      {
        diameterTop: 0,
        diameterBottom: 0.03,
        height: 0.032,
        tessellation: 10,
      },
      scene,
  );
  tip.position.y = 0.041;
  const merged = Mesh.MergeMeshes([shaft, tip], true, true, undefined, false);
  if (!merged) {
    throw new Error('failed to build arrow');
  }
  merged.name = name;
  merged.material = material;
  merged.isPickable = false;
  merged.setEnabled(false);
  return merged;
}

function aim(arrow: Mesh, target: Vector3, from: Vector3): void {
  const direction = target.subtract(from).normalize();
  const up = Vector3.Up();
  const dot = Vector3.Dot(up, direction);
  if (dot > 0.9999) {
    arrow.rotationQuaternion = Quaternion.Identity();
    return;
  }
  if (dot < -0.9999) {
    arrow.rotationQuaternion = Quaternion.FromEulerAngles(Math.PI, 0, 0);
    return;
  }
  const axis = Vector3.Cross(up, direction).normalize();
  arrow.rotationQuaternion = Quaternion.RotationAxis(axis, Math.acos(dot));
}

export class ArrowGuides {
  private readonly screwArrows: Mesh[] = [];
  private readonly screwBases: Vector3[] = [];
  private readonly partArrow: Mesh;
  private partBase = new Vector3(0, -10, 0);
  private partVisible = false;
  private screwCount = 0;

  constructor(scene: Scene) {
    const material = new StandardMaterial('guideArrowMat', scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.FromHexString('#d9a622');
    material.emissiveColor = Color3.FromHexString('#f2c230');
    material.specularColor = Color3.Black();
    for (let i = 0; i < 4; i++) {
      this.screwArrows.push(arrowMesh(`guideArrow${i}`, scene, material));
      this.screwBases.push(new Vector3());
    }
    this.partArrow = arrowMesh('guidePartArrow', scene, material);
  }

  setScrewTargets(points: readonly Vector3[], axes: readonly Vector3[]): void {
    let count = 0;
    for (let i = 0; i < this.screwArrows.length; i++) {
      const arrow = this.screwArrows[i];
      const point = points[i];
      const axis = axes[i];
      if (!arrow) {
        continue;
      }
      if (!point || !axis) {
        arrow.setEnabled(false);
        continue;
      }
      const base = point.add(axis.scale(HOVER));
      this.screwBases[i] = base;
      arrow.position.copyFrom(base);
      aim(arrow, point, base);
      arrow.setEnabled(true);
      count++;
    }
    this.screwCount = count;
  }

  clearScrews(): void {
    this.screwCount = 0;
    for (const arrow of this.screwArrows) {
      arrow.setEnabled(false);
    }
  }

  setPartPosition(position: Vector3 | null): void {
    if (!position) {
      this.partVisible = false;
      this.partArrow.setEnabled(false);
      return;
    }
    this.partVisible = true;
    this.partBase.copyFrom(position);
    this.partBase.y += PART_HOVER;
    this.partArrow.position.copyFrom(this.partBase);
    aim(this.partArrow, position, this.partBase);
    this.partArrow.setEnabled(true);
  }

  count(): number {
    return this.screwCount + (this.partVisible ? 1 : 0);
  }

  tick(time: number): void {
    for (let i = 0; i < this.screwArrows.length; i++) {
      const arrow = this.screwArrows[i];
      const base = this.screwBases[i];
      if (!arrow?.isEnabled() || !base) {
        continue;
      }
      arrow.position.y = base.y + Math.sin(time * 3 + i) * BOB;
    }
    if (this.partVisible) {
      this.partArrow.position.y =
          this.partBase.y + Math.sin(time * 2.4) * BOB * 1.6;
    }
  }
}

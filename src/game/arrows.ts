import {Color3} from '@babylonjs/core/Maths/math.color';
import {Quaternion, Vector3} from '@babylonjs/core/Maths/math.vector';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Constants} from '@babylonjs/core/Engines/constants';
import {Scene} from '@babylonjs/core/scene';

const SCREW_HOVER = 0.12;
const PART_HOVER = 0.3;
const BOB = 0.009;

function arrowMesh(
    name: string,
    scene: Scene,
    material: StandardMaterial,
): Mesh {
  const shaft = MeshBuilder.CreateCylinder(
      `${name}-shaft`, {diameter: 0.011, height: 0.06, tessellation: 8}, scene);
  const tip = MeshBuilder.CreateCylinder(
      `${name}-tip`,
      {
        diameterTop: 0,
        diameterBottom: 0.038,
        height: 0.038,
        tessellation: 10,
      },
      scene,
  );
  tip.position.y = 0.049;
  const merged = Mesh.MergeMeshes([shaft, tip], true, true, undefined, false);
  if (!merged) {
    throw new Error('failed to build arrow');
  }
  merged.name = name;
  merged.material = material;
  merged.isPickable = false;
  merged.renderingGroupId = 1;
  merged.alwaysSelectAsActiveMesh = true;
  merged.setEnabled(false);
  return merged;
}

function aim(arrow: Mesh, target: Vector3, from: Vector3): void {
  const delta = target.subtract(from);
  if (delta.lengthSquared() < 1e-8) {
    arrow.rotationQuaternion = Quaternion.Identity();
    return;
  }
  const direction = delta.normalize();
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
  private readonly sourceArrow: Mesh;
  private readonly destArrow: Mesh;
  private readonly sourceBase = new Vector3(0, -10, 0);
  private readonly destBase = new Vector3(0, -10, 0);
  private sourceVisible = false;
  private destVisible = false;
  private screwCount = 0;

  constructor(scene: Scene) {
    const material = new StandardMaterial('guideArrowMat', scene);
    material.disableLighting = true;
    material.diffuseColor = Color3.FromHexString('#d9a622');
    material.emissiveColor = Color3.FromHexString('#f2c230');
    material.specularColor = Color3.Black();
    material.disableDepthWrite = true;
    material.depthFunction = Constants.ALWAYS;
    for (let i = 0; i < 4; i++) {
      this.screwArrows.push(arrowMesh(`guideArrow${i}`, scene, material));
      this.screwBases.push(new Vector3());
    }
    this.sourceArrow = arrowMesh('guideSourceArrow', scene, material);
    this.destArrow = arrowMesh('guideDestArrow', scene, material);
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
      const base = point.add(axis.scale(SCREW_HOVER));
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

  setPartTargets(source: Vector3 | null, destination: Vector3 | null): void {
    this.sourceVisible = this.place(this.sourceArrow, this.sourceBase, source);
    this.destVisible = this.place(this.destArrow, this.destBase, destination);
  }

  clearParts(): void {
    this.sourceVisible = false;
    this.destVisible = false;
    this.sourceArrow.setEnabled(false);
    this.destArrow.setEnabled(false);
  }

  count(): number {
    return this.screwCount +
        (this.sourceVisible ? 1 : 0) +
        (this.destVisible ? 1 : 0);
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
    if (this.sourceVisible) {
      this.sourceArrow.position.y =
          this.sourceBase.y + Math.sin(time * 2.2) * BOB * 1.5;
    }
    if (this.destVisible) {
      this.destArrow.position.y =
          this.destBase.y + Math.sin(time * 2.2 + 1.4) * BOB * 1.5;
    }
  }

  private place(
      arrow: Mesh,
      base: Vector3,
      target: Vector3 | null,
  ): boolean {
    if (!target) {
      arrow.setEnabled(false);
      return false;
    }
    base.copyFrom(target);
    base.y += PART_HOVER;
    arrow.position.copyFrom(base);
    aim(arrow, target, base);
    arrow.setEnabled(true);
    return true;
  }
}

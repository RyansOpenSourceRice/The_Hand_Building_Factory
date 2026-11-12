import {Color3} from '@babylonjs/core/Maths/math.color';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import type {Material} from '@babylonjs/core/Materials/material';
import type {Mesh} from '@babylonjs/core/Meshes/mesh';

const AMBER = Color3.FromHexString('#f2c230');

type GlowEntry = {
  mesh: Mesh;
  original: Material | null;
  glow: StandardMaterial;
};

export class HostGlow {
  private entries: GlowEntry[] = [];
  private activeId = '';

  set(id: string, meshes: readonly Mesh[] | null): void {
    if (id === this.activeId) {
      return;
    }
    this.clear();
    this.activeId = id;
    if (!id || !meshes || meshes.length === 0) {
      return;
    }
    for (const mesh of meshes) {
      const original = mesh.material;
      if (!(original instanceof StandardMaterial)) {
        continue;
      }
      const glow = original.clone(`hostGlow:${mesh.name}`);
      if (!(glow instanceof StandardMaterial)) {
        continue;
      }
      glow.name = `hostGlow:${mesh.name}`;
      glow.emissiveColor = AMBER.scale(0.18);
      glow.specularColor = Color3.Black();
      mesh.material = glow;
      this.entries.push({mesh, original, glow});
    }
  }

  tick(time: number): void {
    if (this.entries.length === 0) {
      return;
    }
    const pulse = 0.14 + Math.sin(time * 3) * 0.05;
    for (const entry of this.entries) {
      entry.glow.emissiveColor = AMBER.scale(pulse);
    }
  }

  clear(): void {
    for (const entry of this.entries) {
      if (entry.mesh.material === entry.glow) {
        entry.mesh.material = entry.original;
      }
      entry.glow.dispose();
    }
    this.entries = [];
    this.activeId = '';
  }

  active(): string {
    return this.activeId;
  }

  count(): number {
    return this.entries.length;
  }
}

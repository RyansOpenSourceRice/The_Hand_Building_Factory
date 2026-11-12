import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {Scene} from '@babylonjs/core/scene';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Quaternion} from '@babylonjs/core/Maths/math.vector';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import type {WebXRInputSource} from '@babylonjs/core/XR/webXRInputSource';
import type {
  MotionControllerComponentType,
  WebXRControllerComponent,
} from '@babylonjs/core/XR/motionController';
import {
  FALLBACK_HEX,
  FILAMENT_COLORS,
  isValidColorIndex,
} from '../game/palette';

export const HAND_REP_ALPHA = 0.55;
const EMISSIVE_SHARE = 0.12;
const CURL_REST = 0.18;
const CURL_RANGE = [0.82, 0.92, 0.98, 0.78] as const;
const FINGER_X = [-0.028, -0.0095, 0.0095, 0.028];

type HandPose = (trigger: number, squeeze: number) => void;

type Finger = {pivot: TransformNode; distal: TransformNode; range: number};

function box(
    name: string,
    size: [number, number, number],
    parent: TransformNode,
    at: [number, number, number],
): Mesh {
  const mesh = MeshBuilder.CreateBox(
      name,
      {width: size[0], height: size[1], depth: size[2]},
      parent.getScene(),
  );
  mesh.parent = parent;
  mesh.position.set(at[0], at[1], at[2]);
  mesh.isPickable = false;
  return mesh;
}

function buildFinger(
    index: number,
    x: number,
    root: TransformNode,
): Finger {
  const pivot = new TransformNode(`handRep-finger${index}`, root.getScene());
  pivot.parent = root;
  pivot.position.set(x, -0.052, 0.03);
  box(`handRep-proximal${index}`, [0.017, 0.042, 0.017], pivot, [0, -0.021, 0]);
  const distal = new TransformNode(`handRep-distal${index}`, root.getScene());
  distal.parent = pivot;
  distal.position.set(0, -0.042, 0);
  box(`handRep-tip${index}`, [0.015, 0.036, 0.015], distal, [0, -0.018, 0]);
  return {pivot, distal, range: CURL_RANGE[index] ?? 1.1};
}

function buildHand(
    thumbSide: number,
    material: StandardMaterial,
    scene: Scene,
): {root: TransformNode; pose: HandPose; dispose: () => void} {
  const root = new TransformNode('handRep-root', scene);
  box('handRep-wrist', [0.055, 0.03, 0.045], root, [0, -0.055, -0.045])
      .material = material;
  box('handRep-palm', [0.075, 0.035, 0.085], root, [0, -0.035, 0])
      .material = material;
  const fingers = FINGER_X.map((x, i) => buildFinger(i, x, root));

  const thumbPivot = new TransformNode('handRep-thumb', scene);
  thumbPivot.parent = root;
  thumbPivot.position.set(thumbSide * 0.04, -0.03, 0.005);
  box('handRep-thumbSeg', [0.02, 0.02, 0.05], thumbPivot, [0, 0, 0.026])
      .material = material;

  const pose: HandPose = (trigger, squeeze) => {
    const grip = Math.max(trigger, squeeze);
    const fist = squeeze;
    for (const finger of fingers) {
      const bend = CURL_REST + finger.range * 0.8 * grip + 0.15 * fist;
      finger.pivot.rotation.x = bend;
      finger.distal.rotation.x = finger.range * 0.4 * grip + 0.18 * fist;
    }
    thumbPivot.rotation.y = thumbSide * (0.32 + 0.3 * fist);
    thumbPivot.rotation.x = 0.2 * fist;
  };
  pose(0.12, 0);

  const dispose = (): void => {
    root.dispose(false, true);
  };
  return {root, pose, dispose};
}

export function handRepTint(colorIndex: number): Color3 {
  const entry = isValidColorIndex(colorIndex) ?
      FILAMENT_COLORS[colorIndex] :
      undefined;
  return Color3.FromHexString(entry?.hex ?? FALLBACK_HEX);
}

export function setHandTint(material: StandardMaterial, tint: Color3): void {
  material.diffuseColor = tint;
  material.emissiveColor = tint.scale(EMISSIVE_SHARE);
}

type ActiveHand = {
  controller: WebXRInputSource;
  motion: {
    getComponentOfType: (
        type: MotionControllerComponentType,
    ) => WebXRControllerComponent | null;
  };
  hand: {root: TransformNode; pose: HandPose; dispose: () => void};
};

export function attachControllerHands(
    xr: WebXRDefaultExperience,
    scene: Scene,
    colorIndex: number,
): StandardMaterial {
  const material = new StandardMaterial('handRepMat', scene);
  material.specularColor = Color3.Black();
  material.alpha = HAND_REP_ALPHA;
  setHandTint(material, handRepTint(colorIndex));

  const active = new Map<'left' | 'right', ActiveHand>();

  const attach = (controller: WebXRInputSource): void => {
    controller.onMotionControllerInitObservable.add((motion) => {
      const handedness = motion.handedness === 'left' ? 'left' : 'right';
      const previous = active.get(handedness);
      if (previous) {
        previous.hand.dispose();
      }
      const thumbSide = handedness === 'left' ? 1 : -1;
      const hand = buildHand(thumbSide, material, scene);
      hand.root.name = `handRep-${handedness}`;
      active.set(handedness, {controller, motion, hand});
    });
  };

  for (const controller of xr.input.controllers) {
    attach(controller);
  }
  xr.input.onControllerAddedObservable.add(attach);

  xr.input.onControllerRemovedObservable.add((controller) => {
    for (const [handedness, entry] of active) {
      if (entry.controller === controller) {
        entry.hand.dispose();
        active.delete(handedness);
      }
    }
  });

  scene.onBeforeRenderObservable.add(() => {
    for (const entry of active.values()) {
      const anchor = entry.controller.grip ?? entry.controller.pointer;
      if (!anchor) {
        continue;
      }
      anchor.computeWorldMatrix(true);
      anchor.getWorldMatrix().decompose(
          undefined,
          entry.hand.root.rotationQuaternion ??=
              Quaternion.Identity(),
          entry.hand.root.position,
          undefined,
      );
      const trigger = entry.motion.getComponentOfType('trigger');
      const squeeze = entry.motion.getComponentOfType('squeeze');
      entry.hand.pose(trigger?.value ?? 0, squeeze?.value ?? 0);
    }
  });

  return material;
}

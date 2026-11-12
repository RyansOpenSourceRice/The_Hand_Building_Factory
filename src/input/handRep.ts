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
const CURL_REST = 0.6;
const CURL_RANGE = 0.32;
const DISTAL_REST = 1.05;
const DISTAL_RANGE = 0.35;
const FINGER_Y = [0.036, 0.012, -0.012, -0.036];

type HandPose = (trigger: number, squeeze: number) => void;

type Finger = {pivot: TransformNode; distal: TransformNode};

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
    y: number,
    side: number,
    root: TransformNode,
): Finger {
  const pivot = new TransformNode(`handRep-finger${index}`, root.getScene());
  pivot.parent = root;
  pivot.position.set(side * 0.034, y, 0.022);
  box(`handRep-proximal${index}`, [0.019, 0.019, 0.036], pivot, [0, 0, 0.018]);
  const distal = new TransformNode(`handRep-distal${index}`, root.getScene());
  distal.parent = pivot;
  distal.position.set(0, 0, 0.036);
  box(`handRep-tip${index}`, [0.016, 0.016, 0.028], distal, [0, 0, 0.014]);
  return {pivot, distal};
}

function buildHand(
    side: number,
    material: StandardMaterial,
    scene: Scene,
): {root: TransformNode; pose: HandPose; dispose: () => void} {
  const root = new TransformNode('handRep-root', scene);
  const palm = box(
      'handRep-palm', [0.026, 0.095, 0.082], root,
      [side * 0.034, 0, 0.004]);
  palm.material = material;
  box('handRep-wrist', [0.032, 0.05, 0.055], root,
      [side * 0.032, -0.075, -0.004])
      .material = material;
  box('handRep-knuckle', [0.024, 0.088, 0.024], root,
      [side * 0.03, 0, 0.045])
      .material = material;

  const fingers = FINGER_Y.map((y, i) => buildFinger(i, y, side, root));

  const thumbPivot = new TransformNode('handRep-thumb', scene);
  thumbPivot.parent = root;
  thumbPivot.position.set(side * 0.024, 0.055, 0.026);
  box('handRep-thumbSeg', [0.021, 0.021, 0.052], thumbPivot, [0, 0, 0.026])
      .material = material;

  if (new URLSearchParams(window.location.search).has('handDebug')) {
    const proxy = MeshBuilder.CreateCylinder(
        'handRep-controllerProxy',
        {height: 0.12, diameter: 0.036, tessellation: 12},
        scene,
    );
    proxy.parent = root;
    proxy.position.set(0, 0, 0.005);
    const proxyMat = new StandardMaterial('handRepProxyMat', scene);
    proxyMat.diffuseColor = new Color3(0.12, 0.13, 0.16);
    proxy.material = proxyMat;
  }

  const pose: HandPose = (trigger, squeeze) => {
    const grip = Math.max(trigger, squeeze);
    const fist = squeeze;
    for (const finger of fingers) {
      finger.pivot.rotation.y = -side * (CURL_REST + CURL_RANGE * grip +
          0.12 * fist);
      finger.distal.rotation.y = -side * (DISTAL_REST + DISTAL_RANGE * grip +
          0.1 * fist);
    }
    thumbPivot.rotation.y = -side * (0.7 + 0.2 * fist);
    thumbPivot.rotation.x = 0.18 + 0.12 * fist;
  };
  pose(0.12, 0);

  const dispose = (): void => {
    for (const child of root.getChildMeshes()) {
      if (!child.name.startsWith('handRep-')) {
        child.setParent(null);
      }
    }
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

export function createDebugHand(
    scene: Scene,
    colorIndex: number,
): TransformNode {
  const material = new StandardMaterial('handRepDebugMat', scene);
  material.specularColor = Color3.Black();
  material.alpha = 0.85;
  setHandTint(material, handRepTint(colorIndex));
  return buildHand(1, material, scene).root;
}

export type ControllerHands = {
  material: StandardMaterial;
  rootFor: (controller: WebXRInputSource) => TransformNode | null;
};

export function attachControllerHands(
    xr: WebXRDefaultExperience,
    scene: Scene,
    colorIndex: number,
): ControllerHands {
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
      const side = handedness === 'left' ? -1 : 1;
      const hand = buildHand(side, material, scene);
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

  return {
    material,
    rootFor: (controller) => {
      for (const entry of active.values()) {
        if (entry.controller === controller) {
          return entry.hand.root;
        }
      }
      return null;
    },
  };
}

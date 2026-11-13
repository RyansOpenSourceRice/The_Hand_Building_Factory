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
import {applyTile} from '../scene/textures';

export const HAND_REP_ALPHA = 0.55;
const EMISSIVE_SHARE = 0.12;
const CURL_REST = 0.36;
const CURL_RANGE = 0.48;
const DISTAL_REST = 0.42;
const DISTAL_RANGE = 0.35;
const FINGER_X = [-0.03, -0.01, 0.01, 0.03] as const;
const PALM_WIDTH = 0.082;
const PALM_HEIGHT = 0.026;
const PALM_DEPTH = 0.078;

type HandPose = (trigger: number, squeeze: number) => void;

type Finger = {
  pivot: TransformNode;
  distal: TransformNode;
};

export type DigitAudit = {
  fingers: number;
  thumbs: number;
  digits: number;
  meshes: number;
};

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
    side: number,
    root: TransformNode,
): Finger {
  const pivot = new TransformNode(`handRep-finger${index}`, root.getScene());
  pivot.parent = root;
  pivot.position.set(
      side * (FINGER_X[index] ?? 0),
      0,
      PALM_DEPTH / 2 - 0.002,
  );
  box(`handRep-finger${index}-proximal`, [0.016, 0.018, 0.036], pivot,
      [0, 0, 0.018]);
  const distal = new TransformNode(
      `handRep-finger${index}-distal`, root.getScene());
  distal.parent = pivot;
  distal.position.z = 0.036;
  box(`handRep-finger${index}-tip`, [0.013, 0.015, 0.028], distal,
      [0, 0, 0.014]);
  return {pivot, distal};
}

function buildHand(
    side: number,
    material: StandardMaterial,
    scene: Scene,
    showProxy = false,
): {root: TransformNode; pose: HandPose; dispose: () => void} {
  const root = new TransformNode('handRep-root', scene);
  box(
      'handRep-palm',
      [PALM_WIDTH, PALM_HEIGHT, PALM_DEPTH],
      root,
      [0, 0, 0.018],
  ).material = material;
  box(
      'handRep-wrist',
      [0.056, 0.032, 0.048],
      root,
      [0, -0.004, -0.043],
  ).material = material;

  const fingers = FINGER_X.map(
      (_x, i) => buildFinger(i, side, root));

  const thumbPivot = new TransformNode('handRep-thumb', scene);
  thumbPivot.parent = root;
  thumbPivot.position.set(side * -0.049, 0.002, 0.038);
  thumbPivot.rotation.y = side * -0.68;
  box('handRep-thumb-base', [0.019, 0.019, 0.034], thumbPivot,
      [0, 0, 0.017]).material = material;
  const thumbDistal = new TransformNode('handRep-thumb-distal', scene);
  thumbDistal.parent = thumbPivot;
  thumbDistal.position.z = 0.034;
  box('handRep-thumb-tip', [0.016, 0.016, 0.027], thumbDistal,
      [0, 0, 0.0135]).material = material;

  if (showProxy) {
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
      finger.pivot.rotation.x = CURL_REST + CURL_RANGE * grip + 0.1 * fist;
      finger.distal.rotation.x =
          DISTAL_REST + DISTAL_RANGE * grip + 0.08 * fist;
    }
    thumbPivot.rotation.x = 0.2 + 0.22 * grip + 0.08 * fist;
    thumbDistal.rotation.x = 0.32 + 0.2 * grip;
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

export function digitAudit(root: TransformNode): DigitAudit {
  let fingers = 0;
  let thumbs = 0;
  let meshes = 0;
  const visit = (node: TransformNode): void => {
    for (const child of node.getChildren()) {
      if (child instanceof Mesh) {
        meshes++;
      }
      if (child.name === 'handRep-thumb') {
        thumbs++;
      } else if (/^handRep-finger\d+$/.test(child.name)) {
        fingers++;
      }
      visit(child as TransformNode);
    }
  };
  visit(root);
  return {fingers, thumbs, digits: fingers + thumbs, meshes};
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

type MotionHand = {
  getComponentOfType: (
      type: MotionControllerComponentType,
  ) => WebXRControllerComponent | null;
};

type ActiveHand = {
  controller: WebXRInputSource;
  motion: MotionHand | null;
  hand: {root: TransformNode; pose: HandPose; dispose: () => void};
};

export function createDebugHand(
    scene: Scene,
    colorIndex: number,
    showProxy = true,
): TransformNode {
  const material = new StandardMaterial('handRepDebugMat', scene);
  material.specularColor = Color3.Black();
  material.alpha = 0.85;
  applyTile(material, scene, 'pla', {
    uScale: 3,
    vScale: 9,
    offsetSeed: 'handRepDebugMat',
  });
  setHandTint(material, handRepTint(colorIndex));
  return buildHand(1, material, scene, showProxy).root;
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
  applyTile(material, scene, 'pla', {
    uScale: 3,
    vScale: 9,
    offsetSeed: 'handRepMat',
  });
  setHandTint(material, handRepTint(colorIndex));

  const active = new Map<WebXRInputSource, ActiveHand>();

  const ensure = (controller: WebXRInputSource): ActiveHand => {
    const existing = active.get(controller);
    if (existing) {
      return existing;
    }
    const handedness =
        controller.inputSource.handedness === 'left' ? 'left' : 'right';
    const side = handedness === 'left' ? -1 : 1;
    const hand = buildHand(side, material, scene);
    hand.root.name = `handRep-${handedness}`;
    const entry: ActiveHand = {controller, motion: null, hand};
    active.set(controller, entry);
    return entry;
  };

  const attach = (controller: WebXRInputSource): void => {
    ensure(controller);
    controller.onMotionControllerInitObservable.add((motion) => {
      ensure(controller).motion = motion;
    });
  };

  for (const controller of xr.input.controllers) {
    attach(controller);
  }
  xr.input.onControllerAddedObservable.add(attach);

  xr.input.onControllerRemovedObservable.add((controller) => {
    const entry = active.get(controller);
    if (entry) {
      entry.hand.dispose();
      active.delete(controller);
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
      const trigger = entry.motion?.getComponentOfType('trigger');
      const squeeze = entry.motion?.getComponentOfType('squeeze');
      entry.hand.pose(trigger?.value ?? 0, squeeze?.value ?? 0);
    }
  });

  return {
    material,
    rootFor: (controller) => ensure(controller).hand.root,
  };
}

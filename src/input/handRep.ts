import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {Scene} from '@babylonjs/core/scene';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import type {
  WebXRDefaultExperience,
} from '@babylonjs/core/XR/webXRDefaultExperience';
import type {WebXRInputSource} from '@babylonjs/core/XR/webXRInputSource';
import {
  FALLBACK_HEX,
  FILAMENT_COLORS,
  isValidColorIndex,
} from '../game/palette';

export const HAND_REP_ALPHA = 0.55;
const EMISSIVE_SHARE = 0.12;

const FINGER_X = [-0.0325, -0.011, 0.011, 0.0325];

function buildHand(
    thumbSide: number,
    material: StandardMaterial,
    scene: Scene,
): Mesh {
  const parts = [];
  const palm = MeshBuilder.CreateBox(
      'handRep-palm', {width: 0.085, height: 0.03, depth: 0.09}, scene);
  palm.position = new Vector3(0, 0, 0.06);
  parts.push(palm);
  const wrist = MeshBuilder.CreateBox(
      'handRep-wrist', {width: 0.06, height: 0.026, depth: 0.035}, scene);
  wrist.position = new Vector3(0, 0, 0.005);
  parts.push(wrist);
  for (let i = 0; i < FINGER_X.length; i++) {
    const x = FINGER_X[i] ?? 0;
    const knuckle = MeshBuilder.CreateBox(
        `handRep-knuckle${i}`, {width: 0.018, height: 0.018, depth: 0.042},
        scene);
    knuckle.position = new Vector3(x, -0.004, 0.125);
    parts.push(knuckle);
    const tip = MeshBuilder.CreateBox(
        `handRep-tip${i}`, {width: 0.016, height: 0.016, depth: 0.038}, scene);
    tip.position = new Vector3(x, -0.012, 0.162);
    tip.rotation.x = 0.25;
    parts.push(tip);
  }
  const thumb = MeshBuilder.CreateBox(
      'handRep-thumb', {width: 0.022, height: 0.022, depth: 0.055}, scene);
  thumb.position = new Vector3(thumbSide * 0.05, -0.008, 0.055);
  thumb.rotation.y = thumbSide * 0.35;
  parts.push(thumb);
  const hand = Mesh.MergeMeshes(parts, true, true) ?? palm;
  hand.material = material;
  hand.isPickable = false;
  return hand;
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

export function attachControllerHands(
    xr: WebXRDefaultExperience,
    scene: Scene,
    colorIndex: number,
): StandardMaterial {
  const material = new StandardMaterial('handRepMat', scene);
  material.specularColor = Color3.Black();
  material.alpha = HAND_REP_ALPHA;
  setHandTint(material, handRepTint(colorIndex));

  const byController = new Map<WebXRInputSource, Mesh>();

  xr.input.onControllerAddedObservable.add((controller) => {
    controller.onMotionControllerInitObservable.add((motion) => {
      const thumbSide = motion.handedness === 'left' ? 1 : -1;
      const hand = buildHand(thumbSide, material, scene);
      hand.name = `handRep-${motion.handedness}`;
      byController.set(controller, hand);
      const anchor = controller.grip ?? controller.pointer;
      hand.rotation.x = 0.3;
      hand.position.y = -0.03;
      anchor.addChild(hand);
    });
  });

  xr.input.onControllerRemovedObservable.add((controller) => {
    const hand = byController.get(controller);
    if (hand) {
      hand.dispose();
      byController.delete(controller);
    }
  });

  return material;
}

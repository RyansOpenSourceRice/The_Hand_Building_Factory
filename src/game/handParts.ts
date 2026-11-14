export type PartSource = 'printer' | 'conveyor';

export type PartPhase =
    | 'palm'
    | 'motors'
    | 'thumb-base'
    | 'fingers'
    | 'thumb-segments'
    | 'cover';

export type Vec3Literal = {x: number; y: number; z: number};

export type PartDef = {
  id: string;
  label: string;
  file: string;
  source: PartSource;
  phase: PartPhase;
  hostId: string;
  hostLabel: string;
  local: Vec3Literal;
  home: Vec3Literal;
  snapRadius: number;
  screwCount: number;
  screwOffsets: Vec3Literal[];
  screwNormals: Vec3Literal[];
};

export const HAND_ROOT: Vec3Literal = {x: 0, y: 1.4949, z: 0};
export const HAND_TILT_X = 0;
export const HAND_YAW = 0;

export const FINGER_X = 0.0993;
export const FINGER_STEP = 0.0626;
export const FINGER_SCREW_Y = -0.12;
export const FINGER_SCREW_Z = 0.012;
export const KNUCKLE_CAP_Y = -0.03;
export const KNUCKLE_CAP_Z = 0.034;
export const KNUCKLE_CAP_SCREW_Z = 0.010;
const SERVO_BACK_Z = -0.035;

export const PRINTER_HOME: Vec3Literal = {x: -0.75, y: 1.265, z: 0.3};
export const CONVEYOR_HOME: Vec3Literal = {x: 0.62, y: 1.16, z: 0.55};
export const CONVEYOR_PATH: readonly [Vec3Literal, Vec3Literal] = [
  {x: 0.62, y: -0.45, z: 2.85},
  {x: 0.62, y: 1.16, z: 0.55},
];
export const PRINTER_BED_TOP = 1.24;
export const CONVEYOR_BELT_TOP = 1.13;

// Screw normals here point out of the part, the same convention the exported
// facets use. They are design-time placeholders: `applyPartAnchors` replaces
// them with the anchors in parts.json before the stage is built, and the
// stage turns each one into a driving direction.
const down = (): Vec3Literal => ({x: 0, y: -1, z: 0});
const servoBack = (): Vec3Literal => ({x: 0, y: 0, z: -1});
const up = (): Vec3Literal => ({x: 0, y: 0, z: 1});
const thumbSide = (): Vec3Literal => ({x: -1, y: 0, z: 0});

const servoLocal = (x: number, y: number): Vec3Literal => ({
  x,
  y,
  z: SERVO_BACK_Z,
});

const servoDef = (
    id: string,
    label: string,
    local: Vec3Literal,
): PartDef => ({
  id,
  label,
  file: 'servo.glb',
  source: 'conveyor',
  phase: 'motors',
  hostId: 'palm',
  hostLabel: 'the back of the hand',
  local,
  home: CONVEYOR_HOME,
  snapRadius: 0.18,
  screwCount: 1,
  screwOffsets: [{x: 0, y: 0, z: -0.015}],
  screwNormals: [servoBack()],
});

const finger = (
    id: string,
    label: string,
    x: number,
): PartDef => ({
  id,
  label,
  file: 'finger.glb',
  source: 'printer',
  phase: 'fingers',
  hostId: 'palm',
  hostLabel: 'the top of the palm',
  local: {x, y: 0, z: 0},
  home: PRINTER_HOME,
  snapRadius: 0.22,
  screwCount: 1,
  screwOffsets: [{x: FINGER_X, y: FINGER_SCREW_Y, z: FINGER_SCREW_Z}],
  screwNormals: [{x: 0, y: 0, z: -1}],
});

const hardPart = (
    id: string,
    label: string,
    file: string,
    phase: PartPhase,
    hostId: string,
    hostLabel: string,
    local: Vec3Literal,
    snapRadius: number,
): PartDef => ({
  id,
  label,
  file,
  source: 'printer',
  phase,
  hostId,
  hostLabel,
  local,
  home: PRINTER_HOME,
  snapRadius,
  screwCount: 0,
  screwOffsets: [],
  screwNormals: [],
});

const knucklePin = (
    id: string,
    label: string,
    x: number,
): PartDef => hardPart(
    id,
    label,
    'pin.glb',
    'fingers',
    'palm',
    'the knuckle',
    {x, y: -0.03, z: 0},
    0.085,
);

const knuckleCap = (
    id: string,
    label: string,
    hostId: string,
    hostLabel: string,
    fingerX: number,
): PartDef => ({
  id,
  label,
  file: 'knuckle-cap.glb',
  source: 'printer',
  phase: 'fingers',
  hostId,
  hostLabel,
  local: {x: FINGER_X + fingerX, y: KNUCKLE_CAP_Y, z: KNUCKLE_CAP_Z},
  home: PRINTER_HOME,
  snapRadius: 0.085,
  screwCount: 1,
  screwOffsets: [{x: 0, y: 0, z: KNUCKLE_CAP_SCREW_Z}],
  screwNormals: [up()],
});

const thumbPinBase = hardPart(
    'thumb-pin-base',
    'thumb hinge pin',
    'thumb-pin.glb',
    'thumb-segments',
    'thumb-base',
    'the thumb hinge',
    {x: 0.04, y: -0.28, z: 0},
    0.075,
);

const thumbPinTip = hardPart(
    'thumb-pin-tip',
    'thumb tip pin',
    'thumb-pin.glb',
    'thumb-segments',
    'thumb-segments',
    'the thumb tip hinge',
    {x: 0.16, y: -0.23, z: 0},
    0.075,
);

const wristPlate: PartDef = {
  ...hardPart(
      'wrist-plate',
      'wrist plate',
      'wrist-plate.glb',
      'palm',
      'palm',
      'the bottom of the palm',
      {x: 0, y: -0.427, z: 0.01},
      0.2,
  ),
  screwCount: 2,
  screwOffsets: [
    {x: 0.06, y: 0.013, z: 0},
    {x: -0.06, y: 0.013, z: 0},
  ],
  screwNormals: [up(), up()],
};

export const PART_DEFS: readonly PartDef[] = [
  {
    id: 'palm',
    label: 'palm',
    file: 'palm.glb',
    source: 'printer',
    phase: 'palm',
    hostId: 'stand',
    hostLabel: 'the stand',
    local: {x: 0, y: 0, z: 0},
    home: PRINTER_HOME,
    snapRadius: 0.35,
    screwCount: 4,
    screwOffsets: [
      {x: 0.094, y: -0.41, z: 0.02},
      {x: -0.094, y: -0.41, z: 0.02},
      {x: 0.094, y: -0.19, z: 0.02},
      {x: -0.094, y: -0.19, z: 0.02},
    ],
    screwNormals: [down(), down(), down(), down()],
  },
  wristPlate,
  servoDef('servo-base', 'wrist motor', servoLocal(0, -0.34)),
  servoDef('servo-f1', 'index motor', servoLocal(FINGER_X, -0.105)),
  servoDef(
      'servo-f2', 'middle motor', servoLocal(FINGER_X - FINGER_STEP, -0.105)),
  servoDef(
      'servo-f3', 'ring motor',
      servoLocal(FINGER_X - FINGER_STEP * 2, -0.105)),
  servoDef(
      'servo-f4', 'little motor',
      servoLocal(FINGER_X - FINGER_STEP * 3, -0.105)),
  {
    id: 'thumb-base',
    label: 'thumb base',
    file: 'thumb-base.glb',
    source: 'printer',
    phase: 'thumb-base',
    hostId: 'palm',
    hostLabel: 'the side of the palm',
    local: {x: 0, y: 0, z: 0},
    home: PRINTER_HOME,
    snapRadius: 0.22,
    screwCount: 1,
    screwOffsets: [{x: 0.04, y: -0.28, z: 0}],
    screwNormals: [thumbSide()],
  },
  hardPart(
      'thumb-hinge-boss',
      'thumb hinge boss',
      'hinge-boss.glb',
      'thumb-base',
      'palm',
      'the side of the palm',
      {x: 0.045, y: -0.28, z: 0.015},
      0.085,
  ),
  finger('finger-index', 'index finger', 0),
  finger('finger-middle', 'middle finger', -FINGER_STEP),
  finger('finger-ring', 'ring finger', -FINGER_STEP * 2),
  finger('finger-little', 'little finger', -FINGER_STEP * 3),
  knucklePin('knuckle-index', 'index knuckle pin', FINGER_X),
  knucklePin(
      'knuckle-middle', 'middle knuckle pin', FINGER_X - FINGER_STEP),
  knucklePin(
      'knuckle-ring', 'ring knuckle pin', FINGER_X - FINGER_STEP * 2),
  knucklePin(
      'knuckle-little', 'little knuckle pin', FINGER_X - FINGER_STEP * 3),
  knuckleCap(
      'knuckle-cap-index', 'index knuckle cap', 'finger-index',
      'the front of the index knuckle', 0),
  knuckleCap(
      'knuckle-cap-middle', 'middle knuckle cap', 'finger-middle',
      'the front of the middle knuckle', -FINGER_STEP),
  knuckleCap(
      'knuckle-cap-ring', 'ring knuckle cap', 'finger-ring',
      'the front of the ring knuckle', -FINGER_STEP * 2),
  knuckleCap(
      'knuckle-cap-little', 'little knuckle cap', 'finger-little',
      'the front of the little knuckle', -FINGER_STEP * 3),
  {
    id: 'thumb-segments',
    label: 'thumb segments',
    file: 'thumb-segments.glb',
    source: 'printer',
    phase: 'thumb-segments',
    hostId: 'thumb-base',
    hostLabel: 'the thumb base',
    local: {x: 0, y: 0, z: 0},
    home: PRINTER_HOME,
    snapRadius: 0.2,
    screwCount: 1,
    screwOffsets: [{x: 0.16, y: -0.23, z: 0}],
    screwNormals: [{x: 0, y: -1, z: 0}],
  },
  thumbPinBase,
  thumbPinTip,
  {
    id: 'upper-cover',
    label: 'upper cover',
    file: 'upper-cover.glb',
    source: 'printer',
    phase: 'cover',
    hostId: 'palm',
    hostLabel: 'the back of the hand',
    local: {x: 0, y: 0, z: 0},
    home: PRINTER_HOME,
    snapRadius: 0.3,
    screwCount: 4,
    screwOffsets: [
      {x: 0.09, y: -0.36, z: -0.085},
      {x: -0.09, y: -0.36, z: -0.085},
      {x: 0.09, y: -0.20, z: -0.085},
      {x: -0.09, y: -0.20, z: -0.085},
    ],
    screwNormals: [
      up(),
      up(),
      up(),
      up(),
    ],
  },
];

export const TOTAL_PARTS = PART_DEFS.length;

export const totalScrews = (): number =>
  PART_DEFS.reduce((sum, def) => sum + def.screwCount, 0);

export type AnchorRecord = {
  point: [number, number, number];
  normal: [number, number, number];
};

/**
 * Replace the authored screw placeholders with the anchors exported from
 * Blender. Each anchor sits on the part surface by construction, so a screw
 * cannot float away from its host. Call once, before the stage is built.
 *
 * Exported facet normals point out of the part, while the stage drives a
 * screw along `screwNormals`, so each one is flipped into a driving
 * direction here. Getting this backwards buries the screws inside the part.
 */
export function applyPartAnchors(
    anchors: Record<string, AnchorRecord[]>,
): void {
  for (const def of PART_DEFS) {
    const asset = def.file.replace(/\.glb$/, '');
    const list = anchors[asset];
    if (!list) {
      throw new Error(`parts.json has no entry for ${def.file}`);
    }
    if (list.length !== def.screwCount) {
      throw new Error(
          `${def.file} exports ${list.length} anchors but ` +
          `${def.id} expects ${def.screwCount}`);
    }
    if (!list.length) {
      continue;
    }
    def.screwOffsets = list.map((anchor) => ({
      x: anchor.point[0],
      y: anchor.point[1],
      z: anchor.point[2],
    }));
    def.screwNormals = list.map((anchor) => ({
      x: -anchor.normal[0],
      y: -anchor.normal[1],
      z: -anchor.normal[2],
    }));
  }
}

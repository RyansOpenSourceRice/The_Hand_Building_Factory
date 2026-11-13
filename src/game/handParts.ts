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
  file: string | null;
  primitive: 'servo' | 'pin' | 'wrist-plate' | 'hinge-boss' |
      'knuckle-cap' | null;
  source: PartSource;
  phase: PartPhase;
  hostId: string;
  hostLabel: string;
  scale: number;
  local: Vec3Literal;
  home: Vec3Literal;
  snapRadius: number;
  screwCount: number;
  screwOffsets: Vec3Literal[];
  screwNormals: Vec3Literal[];
};

export const MODEL_SCALE = 0.00313;
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

const down = (): Vec3Literal => ({x: 0, y: -1, z: 0});
const intoPalmFromBack = (): Vec3Literal => ({x: 0, y: 0, z: 1});
const intoPalmFromCover = (): Vec3Literal => ({x: 0, y: 0, z: 1});
const intoPalmFromThumb = (): Vec3Literal => ({x: -1, y: 0, z: 0});

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
  file: null,
  primitive: 'servo',
  source: 'conveyor',
  phase: 'motors',
  hostId: 'palm',
  hostLabel: 'the back of the hand',
  scale: 1,
  local,
  home: CONVEYOR_HOME,
  snapRadius: 0.18,
  screwCount: 1,
  screwOffsets: [{x: 0, y: 0, z: -0.015}],
  screwNormals: [intoPalmFromBack()],
});

const finger = (
    id: string,
    label: string,
    x: number,
): PartDef => ({
  id,
  label,
  file: 'finger.stl',
  primitive: null,
  source: 'printer',
  phase: 'fingers',
  hostId: 'palm',
  hostLabel: 'the top of the palm',
  scale: MODEL_SCALE,
  local: {x, y: 0, z: 0},
  home: PRINTER_HOME,
  snapRadius: 0.22,
  screwCount: 1,
  screwOffsets: [{x: FINGER_X, y: FINGER_SCREW_Y, z: FINGER_SCREW_Z}],
  screwNormals: [{x: 0, y: 0, z: -1}],
});

const primitiveDef = (
    id: string,
    label: string,
    primitive: 'pin' | 'wrist-plate' | 'hinge-boss' | 'knuckle-cap',
    phase: PartPhase,
    hostId: string,
    hostLabel: string,
    local: Vec3Literal,
    snapRadius: number,
): PartDef => ({
  id,
  label,
  file: null,
  primitive,
  source: 'printer',
  phase,
  hostId,
  hostLabel,
  scale: 1,
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
): PartDef => primitiveDef(
    id,
    label,
    'pin',
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
  file: null,
  primitive: 'knuckle-cap',
  source: 'printer',
  phase: 'fingers',
  hostId,
  hostLabel,
  scale: 1,
  local: {x: FINGER_X + fingerX, y: KNUCKLE_CAP_Y, z: KNUCKLE_CAP_Z},
  home: PRINTER_HOME,
  snapRadius: 0.085,
  screwCount: 1,
  screwOffsets: [{x: 0, y: 0, z: KNUCKLE_CAP_SCREW_Z}],
  screwNormals: [{x: 0, y: 0, z: -1}],
});

const thumbPinBase = primitiveDef(
    'thumb-pin-base',
    'thumb hinge pin',
    'pin',
    'thumb-segments',
    'thumb-base',
    'the thumb hinge',
    {x: 0.04, y: -0.28, z: 0},
    0.075,
);

const thumbPinTip = primitiveDef(
    'thumb-pin-tip',
    'thumb tip pin',
    'pin',
    'thumb-segments',
    'thumb-segments',
    'the thumb tip hinge',
    {x: 0.16, y: -0.23, z: 0},
    0.075,
);

const wristPlate: PartDef = {
  ...primitiveDef(
      'wrist-plate',
      'wrist plate',
      'wrist-plate',
      'palm',
      'palm',
      'the bottom of the palm',
      {x: 0, y: -0.427, z: 0.01},
      0.2,
  ),
  screwCount: 2,
  screwOffsets: [
    {x: 0.06, y: 0, z: 0},
    {x: -0.06, y: 0, z: 0},
  ],
  screwNormals: [{x: 0, y: 1, z: 0}, {x: 0, y: 1, z: 0}],
};

export const PART_DEFS: readonly PartDef[] = [
  {
    id: 'palm',
    label: 'palm',
    file: 'palm.stl',
    primitive: null,
    source: 'printer',
    phase: 'palm',
    hostId: 'stand',
    hostLabel: 'the stand',
    scale: MODEL_SCALE,
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
    file: 'thumb-base.stl',
    primitive: null,
    source: 'printer',
    phase: 'thumb-base',
    hostId: 'palm',
    hostLabel: 'the side of the palm',
    scale: MODEL_SCALE,
    local: {x: 0, y: 0, z: 0},
    home: PRINTER_HOME,
    snapRadius: 0.22,
    screwCount: 1,
    screwOffsets: [{x: 0.04, y: -0.28, z: 0}],
    screwNormals: [intoPalmFromThumb()],
  },
  primitiveDef(
      'thumb-hinge-boss',
      'thumb hinge boss',
      'hinge-boss',
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
    file: 'thumb-segments.stl',
    primitive: null,
    source: 'printer',
    phase: 'thumb-segments',
    hostId: 'thumb-base',
    hostLabel: 'the thumb base',
    scale: MODEL_SCALE,
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
    file: 'upper-cover.stl',
    primitive: null,
    source: 'printer',
    phase: 'cover',
    hostId: 'palm',
    hostLabel: 'the back of the hand',
    scale: MODEL_SCALE,
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
      intoPalmFromCover(),
      intoPalmFromCover(),
      intoPalmFromCover(),
      intoPalmFromCover(),
    ],
  },
];

export const TOTAL_PARTS = PART_DEFS.length;
export const TOTAL_SCREWS =
    PART_DEFS.reduce((sum, def) => sum + def.screwCount, 0);

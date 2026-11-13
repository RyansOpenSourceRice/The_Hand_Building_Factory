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
  primitive: 'servo' | null;
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

const FINGER_X = 0.0993;
const FINGER_STEP = 0.0626;
const SERVO_BACK_Z = -0.035;

export const PRINTER_HOME: Vec3Literal = {x: -0.75, y: 1.265, z: 0.3};
export const CONVEYOR_HOME: Vec3Literal = {x: 0.62, y: 1.16, z: 0.35};
export const CONVEYOR_PATH: readonly [
  Vec3Literal,
  Vec3Literal,
  Vec3Literal,
  Vec3Literal,
] = [
  {x: 1.75, y: -0.06, z: 1.4},
  {x: 1.1, y: 0.14, z: 1.4},
  {x: 0.75, y: 0.55, z: 1.28},
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
  screwOffsets: [{x: 0, y: 0, z: -0.03}],
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
  screwOffsets: [{x: 0, y: -0.15, z: 0}],
  screwNormals: [{x: 0, y: 1, z: 0}],
});

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
  finger('finger-index', 'index finger', 0),
  finger('finger-middle', 'middle finger', -FINGER_STEP),
  finger('finger-ring', 'ring finger', -FINGER_STEP * 2),
  finger('finger-little', 'little finger', -FINGER_STEP * 3),
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
    screwCount: 2,
    screwOffsets: [
      {x: 0.09, y: -0.30, z: -0.10},
      {x: -0.09, y: -0.30, z: -0.10},
    ],
    screwNormals: [intoPalmFromCover(), intoPalmFromCover()],
  },
];

export const TOTAL_PARTS = PART_DEFS.length;
export const TOTAL_SCREWS =
    PART_DEFS.reduce((sum, def) => sum + def.screwCount, 0);

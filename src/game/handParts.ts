export type PartSource = 'printer' | 'conveyor';

export type Vec3Literal = {x: number; y: number; z: number};

export type PartDef = {
  id: string;
  label: string;
  file: string | null;
  primitive: 'servo' | null;
  source: PartSource;
  scale: number;
  home: Vec3Literal;
  socket: Vec3Literal;
  socketYaw: number;
  snapRadius: number;
  screwCount: number;
  screwOffsets: Vec3Literal[];
  color: string;
};

const PALM_CENTER_Y = 1.2155;
const FINGER_CENTER_Y = 1.541;
const SERVO_BACK_Z = -0.19;

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

const servoScrew = (x: number, y: number): Vec3Literal => ({
  x,
  y,
  z: 0.063,
});

export const PART_DEFS: readonly PartDef[] = [
  {
    id: 'palm',
    label: 'palm',
    file: 'palm.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: 0, y: PALM_CENTER_Y, z: 0},
    socketYaw: 0,
    snapRadius: 0.24,
    screwCount: 4,
    screwOffsets: [
      {x: -0.1, y: 0.11, z: 0.05},
      {x: 0.1, y: 0.11, z: 0.05},
      {x: -0.1, y: -0.11, z: 0.05},
      {x: 0.1, y: -0.11, z: 0.05},
    ],
    color: '#e8e4d8',
  },
  {
    id: 'servo-base',
    label: 'wrist servo',
    file: null,
    primitive: 'servo',
    source: 'conveyor',
    scale: 1,
    home: CONVEYOR_HOME,
    socket: {x: 0, y: 1.1, z: SERVO_BACK_Z},
    socketYaw: 0,
    snapRadius: 0.14,
    screwCount: 1,
    screwOffsets: [servoScrew(0, 0)],
    color: '#3a4a6b',
  },
  {
    id: 'servo-f1',
    label: 'index servo',
    file: null,
    primitive: 'servo',
    source: 'conveyor',
    scale: 1,
    home: CONVEYOR_HOME,
    socket: {x: -0.062, y: 1.27, z: SERVO_BACK_Z},
    socketYaw: 0,
    snapRadius: 0.14,
    screwCount: 1,
    screwOffsets: [servoScrew(0, 0)],
    color: '#3a4a6b',
  },
  {
    id: 'servo-f2',
    label: 'middle servo',
    file: null,
    primitive: 'servo',
    source: 'conveyor',
    scale: 1,
    home: CONVEYOR_HOME,
    socket: {x: 0.062, y: 1.27, z: SERVO_BACK_Z},
    socketYaw: 0,
    snapRadius: 0.14,
    screwCount: 1,
    screwOffsets: [servoScrew(0, 0)],
    color: '#3a4a6b',
  },
  {
    id: 'servo-f3',
    label: 'ring servo',
    file: null,
    primitive: 'servo',
    source: 'conveyor',
    scale: 1,
    home: CONVEYOR_HOME,
    socket: {x: -0.062, y: 1.16, z: SERVO_BACK_Z},
    socketYaw: 0,
    snapRadius: 0.14,
    screwCount: 1,
    screwOffsets: [servoScrew(0, 0)],
    color: '#3a4a6b',
  },
  {
    id: 'servo-f4',
    label: 'little servo',
    file: null,
    primitive: 'servo',
    source: 'conveyor',
    scale: 1,
    home: CONVEYOR_HOME,
    socket: {x: 0.062, y: 1.16, z: SERVO_BACK_Z},
    socketYaw: 0,
    snapRadius: 0.14,
    screwCount: 1,
    screwOffsets: [servoScrew(0, 0)],
    color: '#3a4a6b',
  },
  {
    id: 'thumb-base',
    label: 'thumb base',
    file: 'thumb-base.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: -0.155, y: 1.21, z: 0.02},
    socketYaw: 0.7,
    snapRadius: 0.16,
    screwCount: 1,
    screwOffsets: [{x: 0, y: 0.02, z: 0.075}],
    color: '#d0cab8',
  },
  {
    id: 'finger-index',
    label: 'index finger',
    file: 'finger.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: -0.0945, y: FINGER_CENTER_Y, z: 0},
    socketYaw: 0,
    snapRadius: 0.16,
    screwCount: 1,
    screwOffsets: [{x: 0, y: 0.06, z: 0.03}],
    color: '#dcd7c9',
  },
  {
    id: 'finger-middle',
    label: 'middle finger',
    file: 'finger.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: -0.0315, y: FINGER_CENTER_Y, z: 0},
    socketYaw: 0,
    snapRadius: 0.16,
    screwCount: 1,
    screwOffsets: [{x: 0, y: 0.06, z: 0.03}],
    color: '#dcd7c9',
  },
  {
    id: 'finger-ring',
    label: 'ring finger',
    file: 'finger.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: 0.0315, y: FINGER_CENTER_Y, z: 0},
    socketYaw: 0,
    snapRadius: 0.16,
    screwCount: 1,
    screwOffsets: [{x: 0, y: 0.06, z: 0.03}],
    color: '#dcd7c9',
  },
  {
    id: 'finger-little',
    label: 'little finger',
    file: 'finger.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: 0.0945, y: FINGER_CENTER_Y, z: 0},
    socketYaw: 0,
    snapRadius: 0.16,
    screwCount: 1,
    screwOffsets: [{x: 0, y: 0.06, z: 0.03}],
    color: '#dcd7c9',
  },
  {
    id: 'thumb-segments',
    label: 'thumb segments',
    file: 'thumb-segments.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: -0.21, y: 1.3, z: 0.08},
    socketYaw: 0.7,
    snapRadius: 0.14,
    screwCount: 1,
    screwOffsets: [{x: 0, y: 0, z: 0.03}],
    color: '#dcd7c9',
  },
  {
    id: 'upper-cover',
    label: 'upper cover',
    file: 'upper-cover.stl',
    primitive: null,
    source: 'printer',
    scale: 0.00313,
    home: PRINTER_HOME,
    socket: {x: 0, y: PALM_CENTER_Y, z: -0.095},
    socketYaw: 0,
    snapRadius: 0.22,
    screwCount: 2,
    screwOffsets: [
      {x: -0.09, y: 0, z: -0.095},
      {x: 0.09, y: 0, z: -0.095},
    ],
    color: '#e8e4d8',
  },
];

export const TOTAL_PARTS = PART_DEFS.length;
export const TOTAL_SCREWS =
    PART_DEFS.reduce((sum, def) => sum + def.screwCount, 0);

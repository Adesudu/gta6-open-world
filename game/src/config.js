// Palmera Bay — every tuning number and colour in one place.
// The camera shows a 1280x720 window onto a much larger city; no rule
// below depends on the screen size, only on the world coordinates.
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'palmera-bay.save.v1';

// The city: a grid of avenues and streets, blocks between them, and the
// bay along the south edge. All coordinates are world coordinates.
export const WORLD = { width: 4800, height: 3600, bayY: 3300 };
export const ROAD_W = 96;
export const AVENUES = [300, 900, 1500, 2100, 2700, 3300, 3900, 4500];
export const STREETS = [300, 900, 1500, 2100, 2700, 3300];

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 300,
  health: 100,
  punchDamage: 25,
  punchRange: 36,
  punchArc: 1.1,
  shootDamage: 34,
  bulletSpeed: 760,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 430,
  brake: 720,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  handbrakeGrip: 0.6,
  offroadFactor: 0.55,
};

export const WANTED = {
  decaySeconds: 22,
  maxStars: 5,
  // police cars on the street per star level (index = stars)
  policeCars: [0, 1, 2, 3, 4, 6],
  policeFoot: [0, 0, 1, 2, 3, 4],
  bustSeconds: 2.2,
};

export const PALETTE = {
  grass: '#7fae5a',
  park: '#69a84f',
  sand: '#e8d29a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  sidewalk: '#b9b3a4',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8d44d',
  building: '#c98f5f',
  building2: '#8fa3b8',
  building3: '#b8a58a',
  roof: '#a9713f',
  glass: '#5f8296',
  player: '#ff5a3c',
  playerCar: '#ff5a3c',
  police: '#2b6fd6',
  traffic: '#e8e4d8',
  ped: '#f2d8a7',
  cash: '#37d67a',
  health: '#ff4d6d',
  text: '#f5f1e6',
  muted: '#c9c2ae',
  panel: 'rgba(12, 18, 30, 0.80)',
  marker: '#ffd23e',
  danger: '#ff3b30',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

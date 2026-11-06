// sky.js
// level 3: the "sky" of our world is the water above the seafloor.
// every object is made of the same unit cube. each piece gets the matrix
//   object matrix * translation(offset) * rotation * scaling(size)
// where the object matrix = translation(position on path) * rotationY(turn).
// getSkyParts(time) returns a list of { model, color } and main.js draws each one.

// ---------- the bezier paths ----------

// submarine: a closed loop of 5 cubic pieces. the last point of each piece is
// the first point of the next, and the control points on both sides of a join
// are on a straight line, so there is no sharp turn.
const SUB_PATH = [
  [[-14, 13, -10], [-9, 14, -13], [5, 15, -17], [10, 15, -14]],
  [[10, 15, -14], [15, 15, -11], [19, 12, 2], [17, 12, 7]],
  [[17, 12, 7], [15, 12, 12], [3, 16, 15], [-3, 16, 15]],
  [[-3, 16, 15], [-9, 16, 15], [-15, 12, 9], [-17, 11, 5]],
  [[-17, 11, 5], [-19, 11, 1], [-18, 12, -7], [-14, 13, -10]],
];
const SUB_LOOP_SECONDS = 45;

// fish schools: one cubic each, they swim to the end and then swim back
const FISH_PATH_A = [[-34, 11, -6], [-10, 21, -24], [8, 5, 20], [34, 14, 4]];
const FISH_PATH_B = [[30, 17, -26], [10, 9, 6], [-6, 22, -12], [-32, 13, 26]];

// jellyfish drift up and down on their own curves
const JELLY_PATHS = [
  [[-8, 8, 6], [-4, 13, 2], [-11, 19, 9], [-7, 27, 5]],
  [[9, 9, -4], [14, 15, -8], [6, 20, -1], [10, 28, -5]],
  [[2, 10, 12], [-2, 16, 16], [6, 21, 10], [1, 29, 14]],
];

// random spots around the school center, picked once so the school keeps its shape
function makeSchool(count) {
  const fish = [];
  for (let i = 0; i < count; i++) {
    fish.push([Math.random() * 5 - 2.5, Math.random() * 3 - 1.5, Math.random() * 5 - 2.5]);
  }
  return fish;
}
const SCHOOL_A = makeSchool(9);
const SCHOOL_B = makeSchool(11);

// ---------- helpers ----------

// puts an object at pos and turns it to face dir (objects are built facing +x)
function placeObject(pos, dir) {
  const turn = Math.atan2(-dir[2], dir[0]);
  return multiply(translation(pos[0], pos[1], pos[2]), rotationY(turn));
}

// glow = true means drawn with no lighting (windows, headlight)
function addPart(parts, objectMatrix, offset, size, color, rotation, glow) {
  const model = multiplyAll([
    objectMatrix,
    translation(offset[0], offset[1], offset[2]),
    rotation || identity(),
    scaling(size[0], size[1], size[2]),
  ]);
  parts.push({ model: model, color: color, glow: glow === true });
}

// ---------- the objects ----------

// submarine, built facing +x
function addSubmarine(parts, m, time) {
  const yellow = [0.95, 0.72, 0.15];
  const dark = [0.35, 0.3, 0.2];
  const glass = [0.4, 0.9, 1.0];

  addPart(parts, m, [0, 0, 0], [6, 1.8, 1.8], yellow);          // body
  addPart(parts, m, [3.3, 0, 0], [0.8, 1.3, 1.3], yellow);      // nose
  addPart(parts, m, [-3.4, 0, 0], [1, 1.2, 1.2], yellow);       // back
  addPart(parts, m, [0.5, 1.4, 0], [1.6, 1.1, 1], yellow);      // tower
  addPart(parts, m, [1, 2.4, 0], [0.2, 1, 0.2], dark);          // periscope
  addPart(parts, m, [1.25, 2.85, 0], [0.5, 0.2, 0.2], dark);
  addPart(parts, m, [-3.7, 0, 0], [0.6, 2.6, 0.15], yellow);    // tail fin up/down
  addPart(parts, m, [-3.7, 0, 0], [0.6, 0.15, 2.6], yellow);    // tail fin sides

  for (let i = -1; i <= 1; i++) {
    addPart(parts, m, [i * 1.3, 0.2, 0.92], [0.55, 0.55, 0.1], glass, null, true);
    addPart(parts, m, [i * 1.3, 0.2, -0.92], [0.55, 0.55, 0.1], glass, null, true);
  }

  // propeller
  const spin = time * 8;
  addPart(parts, m, [-4.15, 0, 0], [0.15, 2, 0.35], dark, rotationX(spin));
  addPart(parts, m, [-4.15, 0, 0], [0.15, 2, 0.35], dark, rotationX(spin + Math.PI / 2));

  addPart(parts, m, [3.75, 0, 0], [0.15, 0.5, 0.5], [1, 1, 0.8], null, true);
}

// one fish, built facing +x
function addFish(parts, m, color, wag) {
  addPart(parts, m, [0, 0, 0], [1.2, 0.6, 0.3], color);
  // tail rotates around the back of the body
  const tail = multiplyAll([m, translation(-0.6, 0, 0), rotationY(wag)]);
  addPart(parts, tail, [-0.25, 0, 0], [0.5, 0.5, 0.08], color);
  addPart(parts, m, [0.4, 0.1, 0.16], [0.12, 0.12, 0.05], [0.05, 0.05, 0.05]); // eye
  addPart(parts, m, [0.4, 0.1, -0.16], [0.12, 0.12, 0.05], [0.05, 0.05, 0.05]);
}

// t goes 0 -> 1 -> 0 and slows down at the ends, so nothing jumps back.
// one trip from 0 to 1 takes "seconds".
function backAndForth(time, seconds) {
  return 0.5 - 0.5 * Math.cos(Math.PI * time / seconds);
}

// true while t is going up (0 -> 1), false on the way back
function goingForward(time, seconds) {
  return Math.sin(Math.PI * time / seconds) >= 0;
}

function addSchool(parts, path, school, color, time, seconds) {
  const t = backAndForth(time, seconds);
  const center = deCasteljau(path, t);
  let dir = bezierDirection(path, t);
  // on the way back the fish turn around and face the other way
  if (!goingForward(time, seconds)) dir = scaleVec(dir, -1);
  for (let i = 0; i < school.length; i++) {
    const pos = add(center, school[i]);
    const m = placeObject(pos, dir);
    addFish(parts, m, color, Math.sin(time * 10 + i) * 0.5);
  }
}

function addJellyfish(parts, pos, time, phase) {
  const pink = [1, 0.45, 0.8];
  const pulse = 1 + 0.15 * Math.sin(time * 3 + phase);
  const m = translation(pos[0], pos[1], pos[2]);
  addPart(parts, m, [0, 0, 0], [1.6 * pulse, 0.9 / pulse, 1.6 * pulse], pink);
  addPart(parts, m, [0, 0.6, 0], [1, 0.5, 1], pink);
  const corners = [[0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5]];
  for (let i = 0; i < 4; i++) {
    const sway = rotationZ(0.25 * Math.sin(time * 2 + phase + i));
    const tm = multiply(m, translation(corners[i][0], -0.45, corners[i][1]));
    addPart(parts, multiply(tm, sway), [0, -0.9, 0], [0.12, 1.8, 0.12], [1, 0.6, 0.9]);
  }
}

// little cubes along a curve to show the path and control points
function addCurveDots(parts, points, color) {
  for (let i = 0; i <= 40; i++) {
    const p = deCasteljau(points, i / 40);
    addPart(parts, identity(), p, [0.15, 0.15, 0.15], color);
  }
  for (let i = 0; i < points.length; i++) {
    addPart(parts, identity(), points[i], [0.45, 0.45, 0.45], [1, 0.2, 0.4]);
  }
}

// ---------- everything for one frame ----------

const sky = {
  showPaths: false,
  subPos: [0, 0, 0],
  subDir: [1, 0, 0],
};

function getSkyParts(time) {
  const parts = [];

  const u = (time / SUB_LOOP_SECONDS) % 1;
  sky.subPos = pathPoint(SUB_PATH, u);
  sky.subDir = pathDirection(SUB_PATH, u);
  addSubmarine(parts, placeObject(sky.subPos, sky.subDir), time);

  addSchool(parts, FISH_PATH_A, SCHOOL_A, [1, 0.5, 0.1], time, 16);
  addSchool(parts, FISH_PATH_B, SCHOOL_B, [0.7, 0.8, 0.95], time, 21);

  for (let j = 0; j < JELLY_PATHS.length; j++) {
    const t = backAndForth(time + j * 10, 30);
    addJellyfish(parts, deCasteljau(JELLY_PATHS[j], t), time, j * 2);
  }

  if (sky.showPaths) {
    for (let i = 0; i < SUB_PATH.length; i++) addCurveDots(parts, SUB_PATH[i], [1, 0.85, 0.3]);
    addCurveDots(parts, FISH_PATH_A, [1, 0.6, 0.2]);
    addCurveDots(parts, FISH_PATH_B, [0.8, 0.9, 1]);
    for (let j = 0; j < JELLY_PATHS.length; j++) addCurveDots(parts, JELLY_PATHS[j], [1, 0.6, 0.9]);
  }

  return parts;
}

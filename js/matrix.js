// matrix.js
// all the matrix and vector helpers for the project.
// webgl wants 4x4 matrices as 16 numbers in column-major order,
// so the first 4 numbers are the first column. that is why the
// translation x, y, z ends up in the last row of numbers below.

function identity() {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

// move by (x, y, z)
function translation(x, y, z) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

// scale by (sx, sy, sz)
function scaling(sx, sy, sz) {
  return [
    sx, 0, 0, 0,
    0, sy, 0, 0,
    0, 0, sz, 0,
    0, 0, 0, 1,
  ];
}

// rotate around the x axis by angle (radians)
function rotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ];
}

// rotate around the y axis
function rotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ];
}

// rotate around the z axis
function rotationZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

// a times b. the result does b first and then a.
// so t * r * s means scale first, then rotate, then translate.
function multiply(a, b) {
  const result = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        result[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
      }
    }
  }
  return result;
}

// multiply a list of matrices left to right, so the last one happens first.
// multiplyAll([t, r, s]) is the same as t * r * s
function multiplyAll(list) {
  let result = list[0];
  for (let i = 1; i < list.length; i++) {
    result = multiply(result, list[i]);
  }
  return result;
}

// run one point (x, y, z, 1) through a matrix
function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

// perspective projection: squeezes the pyramid shaped view volume into the
// canonical view volume (-1 to 1 on every axis). the -1 in the last column
// puts -z into w, so after the divide by w far things get smaller.
// fieldOfView is the vertical angle, in radians.
function perspective(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
}

// ---- small vector helpers ----
function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scaleVec(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function normalize(a) {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len === 0) return [0, 0, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

// view matrix: takes world space to camera space.
// we build the camera's own axes u, v, w like the viewing slides (the class
// cube-grid example calls them xAxis, yAxis, zAxis, same math). the camera
// looks down -w, so w points from the target back to the eye. the matrix
// rotates the world so u lines up with x, v with y and w with z, and moves
// the eye to the origin.
function lookAt(eye, target, up) {
  const w = normalize(subtract(eye, target)); // backward
  const u = normalize(cross(up, w));          // camera right
  const v = cross(w, u);                      // camera up

  return [
    u[0], v[0], w[0], 0,
    u[1], v[1], w[1], 0,
    u[2], v[2], w[2], 0,
    -dot(u, eye), -dot(v, eye), -dot(w, eye), 1,
  ];
}

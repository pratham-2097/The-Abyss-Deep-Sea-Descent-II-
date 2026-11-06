// cube.js
// the only model in this project is this one cube.
// it is 1 unit wide and centered on the origin (-0.5 to 0.5 on every axis).
// everything else is this same cube scaled, rotated and translated.
// each face is 2 triangles = 6 vertices, so 36 vertices in total.

const CUBE_FACES = [
  // normal, then the 4 corners of the face
  { n: [0, 0, 1], c: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },     // front
  { n: [0, 0, -1], c: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] }, // back
  { n: [0, 1, 0], c: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },     // top
  { n: [0, -1, 0], c: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] }, // bottom
  { n: [1, 0, 0], c: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },     // right
  { n: [-1, 0, 0], c: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] }, // left
];

// the two triangles of a face use corners 0,1,2 and 0,2,3
const FACE_ORDER = [0, 1, 2, 0, 2, 3];

const FLOATS_PER_VERTEX = 9; // x y z, nx ny nz, r g b
const VERTS_PER_CUBE = 36;

// writes one cube into the float32array starting at offset.
// model places the cube, colorOf(corner) gives the color of a corner.
// returns the new offset so the next cube goes right after it.
function writeCube(data, offset, model, colorOf) {
  for (let f = 0; f < 6; f++) {
    const face = CUBE_FACES[f];
    for (let k = 0; k < 6; k++) {
      const corner = face.c[FACE_ORDER[k]];
      const p = transformPoint(model, corner);
      const col = colorOf(corner);
      data[offset++] = p[0];
      data[offset++] = p[1];
      data[offset++] = p[2];
      // cubes are only scaled and translated here, so the normal stays the same
      data[offset++] = face.n[0];
      data[offset++] = face.n[1];
      data[offset++] = face.n[2];
      data[offset++] = col[0];
      data[offset++] = col[1];
      data[offset++] = col[2];
    }
  }
  return offset;
}

// copies the vertices to a new gpu buffer
function makeBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { buffer: buffer, count: data.length / FLOATS_PER_VERTEX };
}

// plain white cube, the sky objects get their color from the uTint uniform
function makeUnitCube(gl) {
  const data = new Float32Array(VERTS_PER_CUBE * FLOATS_PER_VERTEX);
  writeCube(data, 0, identity(), function () { return [1, 1, 1]; });
  return makeBuffer(gl, data);
}

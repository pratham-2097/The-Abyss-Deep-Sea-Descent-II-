// terrain.js
// builds the seafloor out of cubes for levels 1 and 2.
//
// the grid is always WORLD_SIZE wide, so a bigger grid just means thinner cubes.
// every cube gets scaling(width, height, width) and then
// translation(x, height / 2, z). the cube is centered on 0, so we move it up
// by half its height to make its bottom sit on y = 0.
//
// level 1 draws each cube with its own uModel like the class cube-grid
// example (see main.js). level 2 goes up to 200 x 200 = 40,000 cubes, which is
// too many draw calls, so there we do the same matrices on the cpu once, copy
// every cube into one big buffer and draw the floor with one drawArrays call.

const WORLD_SIZE = 40;   // floor goes from -20 to 20 in x and z
const MAX_HEIGHT = 9;
const MIN_HEIGHT = 0.3;  // so even black pixels still show a cube

// ---------------- heights (level 1b) ----------------

function randomHeights(n) {
  const heights = [];
  for (let i = 0; i < n * n; i++) {
    heights.push(MIN_HEIGHT + Math.random() * MAX_HEIGHT * 0.6);
  }
  return heights;
}

// my own formula: sine hills plus a trench that winds through the middle
function waveHeights(n) {
  const heights = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const u = col / (n - 1);
      const v = row / (n - 1);
      let h = 0.5 + 0.18 * Math.sin(u * 9) * Math.cos(v * 7) + 0.1 * Math.sin((u + v) * 15);
      const trenchCenter = 0.5 + 0.15 * Math.sin(v * 8);
      const d = (u - trenchCenter) / 0.07;
      h -= 0.45 * Math.exp(-d * d);
      if (h < 0) h = 0;
      heights.push(MIN_HEIGHT + h * MAX_HEIGHT);
    }
  }
  return heights;
}

// ---------------- colors (level 1c) ----------------

// deep blue in the trench, gray rock, then sand on the high parts.
// we mix between the two closest colors.
const COLOR_STOPS = [
  { h: 0.0, c: [0.03, 0.06, 0.2] },
  { h: 0.3, c: [0.1, 0.25, 0.45] },
  { h: 0.55, c: [0.4, 0.42, 0.4] },
  { h: 0.75, c: [0.65, 0.58, 0.42] },
  { h: 1.0, c: [0.9, 0.82, 0.6] },
];

function heightToColor(height) {
  const h = (height - MIN_HEIGHT) / MAX_HEIGHT;
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i];
    const b = COLOR_STOPS[i + 1];
    if (h <= b.h) {
      const t = (h - a.h) / (b.h - a.h);
      return pointBetween(a.c, b.c, Math.max(0, t));
    }
  }
  return COLOR_STOPS[COLOR_STOPS.length - 1].c;
}

// ---------------- sampling the images (level 2) ----------------

// draws the image on a hidden canvas and reads the pixels with getImageData
// (4 numbers per pixel: r, g, b, a from 0 to 255)
function readPixels(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

// the grid is n x n but the image is 512 x 512, so each cube covers a block
// of pixels (512 / 100 = 5.12 pixels per cube). one sample per cube could
// alias and skip details, so we average every pixel in the block, kind of
// like supersampling.
function averageBlock(pixels, n, row, col) {
  const x0 = Math.floor(col * pixels.width / n);
  const x1 = Math.max(x0 + 1, Math.floor((col + 1) * pixels.width / n));
  const y0 = Math.floor(row * pixels.height / n);
  const y1 = Math.max(y0 + 1, Math.floor((row + 1) * pixels.height / n));
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * pixels.width + x) * 4;
      r += pixels.data[i];
      g += pixels.data[i + 1];
      b += pixels.data[i + 2];
      count++;
    }
  }
  return [r / count, g / count, b / count];
}

// grayscale: black (0) is the lowest cube, white (255) is the tallest
function heightsFromImage(pixels, n) {
  const heights = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const gray = averageBlock(pixels, n, row, col)[0];
      heights.push(MIN_HEIGHT + (gray / 255) * MAX_HEIGHT);
    }
  }
  return heights;
}

// 0-255 changed to 0-1 for webgl
function colorsFromImage(pixels, n) {
  const colors = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const c = averageBlock(pixels, n, row, col);
      colors.push([c[0] / 255, c[1] / 255, c[2] / 255]);
    }
  }
  return colors;
}

// ---------------- building the buffer ----------------

// bottom corners are darker, so the rasterizer fades each side from dark at
// the bottom to the full color at the top
function buildTerrain(gl, n, heights, colors) {
  const data = new Float32Array(n * n * VERTS_PER_CUBE * FLOATS_PER_VERTEX);
  const w = WORLD_SIZE / n;
  let offset = 0;

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const h = heights[i];
      const top = colors[i];
      const bottom = scaleVec(top, 0.3);

      const x = -WORLD_SIZE / 2 + (col + 0.5) * w;
      const z = -WORLD_SIZE / 2 + (row + 0.5) * w;

      // scale first, then translate
      const model = multiply(translation(x, h / 2, z), scaling(w, h, w));

      offset = writeCube(data, offset, model, function (corner) {
        return corner[1] > 0 ? top : bottom;
      });
    }
  }
  return makeBuffer(gl, data);
}

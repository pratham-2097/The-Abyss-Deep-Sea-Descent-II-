// main.js
// sets up webgl, the shaders and the camera, handles the level tabs,
// and draws every frame.
//
// order of the file:
//   1. webgl context and shaders
//   2. buffers and attribute layout
//   3. levels (what each tab shows)
//   4. camera (orbit, mouse controls, ride along)
//   5. draw loop

// ---------------------------------------------------------------
// 1. webgl context and shaders
// ---------------------------------------------------------------
const canvas = document.getElementById('c');
// the gpu pipeline slides mention webgl2, but we used webgl 1 like the class examples
const gl = canvas.getContext('webgl');
if (!gl) {
  alert('WebGL is not supported in this browser');
}

// language=GLSL
const vertexShaderSource = /* glsl */ `
  attribute vec3 aPosition;
  attribute vec3 aNormal;
  attribute vec3 aColor;

  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;

  varying vec3 vNormal;
  varying vec3 vColor;
  varying vec3 vWorldPos;

  void main() {
    // our pieces are boxes scaled along their own axes and then rotated,
    // so each face normal still points the right way after mat3(uModel).
    // we normalize because the scaling changes its length.
    vNormal = normalize(mat3(uModel) * aNormal);
    vColor = aColor;

    vec4 world = uModel * vec4(aPosition, 1.0);
    vWorldPos = world.xyz;

    // object space -> world space -> camera space -> clip space
    gl_Position = uProjection * uView * world;
  }
`;

// language=GLSL
const fragmentShaderSource = /* glsl */ `
  precision mediump float;

  varying vec3 vNormal;
  varying vec3 vColor;     // the rasterizer interpolates this with barycentric coordinates
  varying vec3 vWorldPos;

  uniform vec3 uTint;      // multiplied with the vertex color
  uniform float uNoLight;  // 1 = just show the color (skybox, windows)

  uniform vec3 uLightDir;  // direction to the light (sunlight from the surface)
  uniform vec3 uCameraPos;
  uniform float uPhong;    // level 4: ambient + diffuse + specular

  uniform float uFogDensity; // 0 = no fog
  uniform vec3 uFogColor;

  void main() {
    vec3 base = vColor * uTint;

    if (uNoLight > 0.5) {
      gl_FragColor = vec4(base, 1.0);
      return;
    }

    vec3 n = normalize(vNormal);
    vec3 l = normalize(uLightDir);
    float diffuse = max(dot(n, l), 0.0);
    vec3 color;

    if (uPhong > 0.5) {
      // reflection of the light direction around the normal: r = 2(n.l)n - l
      vec3 r = 2.0 * dot(n, l) * n - l;
      vec3 v = normalize(uCameraPos - vWorldPos);
      float spec = 0.0;
      if (diffuse > 0.0) {
        spec = pow(max(dot(r, v), 0.0), 20.0);
      }
      color = 0.25 * base + 0.75 * diffuse * base + 0.45 * spec * vec3(1.0, 1.0, 1.0);
    } else {
      // simple lighting: some ambient so the shadow sides are not black
      color = base * (0.3 + 0.7 * diffuse);
    }

    if (uFogDensity > 0.0) {
      // the farther away, the more we mix in the fog color
      float d = length(vWorldPos - uCameraPos);
      float f = exp(-uFogDensity * d);
      color = mix(uFogColor, color, f);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
gl.useProgram(program);

// ---------------------------------------------------------------
// 2. buffers and attribute layout
// ---------------------------------------------------------------
const aPosition = gl.getAttribLocation(program, 'aPosition');
const aNormal = gl.getAttribLocation(program, 'aNormal');
const aColor = gl.getAttribLocation(program, 'aColor');
gl.enableVertexAttribArray(aPosition);
gl.enableVertexAttribArray(aNormal);
gl.enableVertexAttribArray(aColor);

// every vertex is 9 floats: position, normal, color (4 bytes each)
const STRIDE = FLOATS_PER_VERTEX * 4;

// bind a buffer and point the attributes at it before drawing from it
function useBuffer(b) {
  gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, STRIDE, 0);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, STRIDE, 3 * 4);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, STRIDE, 6 * 4);
}

const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uTint = gl.getUniformLocation(program, 'uTint');
const uNoLight = gl.getUniformLocation(program, 'uNoLight');
const uLightDir = gl.getUniformLocation(program, 'uLightDir');
const uCameraPos = gl.getUniformLocation(program, 'uCameraPos');
const uPhong = gl.getUniformLocation(program, 'uPhong');
const uFogDensity = gl.getUniformLocation(program, 'uFogDensity');
const uFogColor = gl.getUniformLocation(program, 'uFogColor');

const unitCube = makeUnitCube(gl);

// same cube but the bottom corners are darker, so the sides fade
const shadedData = new Float32Array(VERTS_PER_CUBE * FLOATS_PER_VERTEX);
writeCube(shadedData, 0, identity(), function (corner) {
  if (corner[1] > 0) return [1, 1, 1];
  return [0.3, 0.3, 0.3];
});
const shadedCube = makeBuffer(gl, shadedData);

// skybox: one huge cube around the camera, light on top and almost black at the bottom
const skyboxData = new Float32Array(VERTS_PER_CUBE * FLOATS_PER_VERTEX);
writeCube(skyboxData, 0, identity(), function (corner) {
  if (corner[1] > 0) return [0.12, 0.4, 0.55];
  return [0.0, 0.02, 0.06];
});
const skybox = makeBuffer(gl, skyboxData);

// the level 0 cube: 2 x 2 x 2, each corner gets a color from its position
// (x -> red, y -> green, z -> blue) so we can see the interpolation
const level0Data = new Float32Array(VERTS_PER_CUBE * FLOATS_PER_VERTEX);
writeCube(level0Data, 0, scaling(2, 2, 2), function (corner) {
  return [corner[0] + 0.5, corner[1] + 0.5, corner[2] + 0.5];
});
const level0Cube = makeBuffer(gl, level0Data);

// ---------------------------------------------------------------
// 3. levels
// ---------------------------------------------------------------
let level = '0';
let floor = null;          // the floor when all cubes are in one buffer
let gridCubes = [];        // level 1: list of cubes drawn one at a time with uModel
let gridShaded = false;    // level 1c and 1d: darker bottom corners
let randomList = null;     // so the random heights stay the same until the grid changes
let heightPixels = null;   // pixel data from heightmap.png
let colorPixels = null;    // pixel data from colormap.png

const LEVEL_TITLES = {
  '0': 'Level 0: one cube',
  '1a': 'Level 1a: grid of cubes (translation)',
  '1b': 'Level 1b: heights (scaling)',
  '1c': 'Level 1c: vertex colors',
  '1d': 'Level 1d: camera path',
  '2': 'Level 2: landscape from images',
  '3': 'Level 3: the sky (the water above)',
  '4': 'Level 4: light and atmosphere',
};

const LEVEL_TEXT = {
  '0': 'A single 2 x 2 x 2 cube. This cube is the only model in the whole project. Each corner gets a color (x is red, y is green, z is blue) and the rasterizer interpolates between them. Drag to look around.',
  '1a': 'Cubes placed in a grid on the x-z plane by translating each one to its spot. Each cube is its own draw call with its own model matrix. Try the grid sizes and watch the frame rate.',
  '1b': 'Each cube is scaled in y. Pick random heights or my own formula (sine wave hills with a trench winding through the middle).',
  '1c': 'Colors come from height: deep blue low, gray rock in the middle, sand up high. The top corners get the color and the bottom corners are darker, so the rasterizer interpolates a fade down each side.',
  '1d': 'The camera moves in a circle around the center and always looks at the middle of the floor with lookAt. Drag to move it yourself, scroll to zoom.',
  '2': 'Height comes from a grayscale height map and color comes from a color image (both 512 x 512). The grid is smaller than the image, so each cube averages all the pixels in the block under it instead of taking one sample, which helps with aliasing. Gray 0 to 255 becomes a height from 0.3 to 9.3. The bigger grids need a stronger computer.',
  '3': 'My sky is the water above the seafloor. The submarine, fish and jellyfish are all cubes that are scaled, rotated and translated. The submarine loops on 5 cubic Bezier pieces joined end to end, and the fish and jellyfish each follow one cubic, going to the end and then coming back.',
  '4': 'Phong lighting (ambient + diffuse + specular), fog that gets thicker with distance, and a skybox made from one big cube. Try riding along with the submarine.',
};

// builds the floor for the current level
function rebuildFloor() {
  gridCubes = [];
  // free the old floor first
  if (floor) {
    gl.deleteBuffer(floor.buffer);
    floor = null;
  }
  if (level === '0') return;

  if (level === '2' || level === '3' || level === '4') {
    if (!heightPixels || !colorPixels) return;
    const n = Number(document.getElementById('resolution').value);
    floor = buildTerrain(gl, n, heightsFromImage(heightPixels, n), colorsFromImage(colorPixels, n));
    return;
  }

  const n = Number(document.getElementById('grid-size').value);
  let heights;
  if (level === '1a') {
    heights = [];
    for (let i = 0; i < n * n; i++) heights.push(0.5);
  } else if (level === '1b' && document.getElementById('height-mode').value === 'random') {
    if (!randomList || randomList.length !== n * n) randomList = randomHeights(n);
    heights = randomList;
  } else {
    heights = waveHeights(n);
  }

  // 1a and 1b: one plain color with a small gap so you can see each cube
  // 1c and 1d: colors from height and darker bottom corners
  const simple = level === '1a' || level === '1b';
  let colors = [];
  for (let i = 0; i < n * n; i++) {
    if (simple) colors.push([0.35, 0.55, 0.65]);
    else colors.push(heightToColor(heights[i]));
  }
  const gap = simple ? 0.85 : 1;

  // keep a list of cubes, and every frame each one gets its
  // own model matrix (scale, then translate) sent to the vertex shader
  const w = WORLD_SIZE / n;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const i = row * n + col;
      gridCubes.push({
        x: -WORLD_SIZE / 2 + (col + 0.5) * w,
        z: -WORLD_SIZE / 2 + (row + 0.5) * w,
        width: w * gap,
        height: heights[i],
        color: colors[i],
      });
    }
  }
  gridShaded = !simple;
}

// shows or hides one group of controls in the side panel
function show(id, visible) {
  document.getElementById(id).style.display = visible ? 'block' : 'none';
}

function setLevel(lvl) {
  level = lvl;

  // highlight the tab we are on
  const tabs = document.getElementById('tabs').children;
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].className = (tabs[i].id === 'tab-' + lvl) ? 'on' : '';
  }
  document.getElementById('level-title').textContent = LEVEL_TITLES[lvl];
  document.getElementById('level-text').textContent = LEVEL_TEXT[lvl];

  const isLevel1 = lvl === '1a' || lvl === '1b' || lvl === '1c' || lvl === '1d';
  const usesImages = lvl === '2' || lvl === '3' || lvl === '4';
  show('grid-controls', isLevel1);
  show('height-controls', lvl === '1b');
  show('res-controls', usesImages);
  show('sky-controls', lvl === '3' || lvl === '4');
  show('fx-controls', lvl === '4');
  show('orbit-controls', lvl !== '0');

  // starting camera for each level
  if (lvl === '0') {
    camera.radius = 8; camera.height = 4; camera.target = [0, 0, 0]; camera.autoOrbit = false;
  } else if (lvl === '3' || lvl === '4') {
    camera.radius = 46; camera.height = 22; camera.target = [0, 6, 0]; camera.autoOrbit = true;
  } else {
    camera.radius = 44; camera.height = 30; camera.target = [0, 0, 0];
    camera.autoOrbit = (lvl === '1d' || lvl === '2');
  }
  camera.angle = 0.8;
  document.getElementById('orbit').checked = camera.autoOrbit;
  if (lvl !== '3' && lvl !== '4') document.getElementById('ride').checked = false;

  rebuildFloor();
}

// when a control changes we rebuild the floor
document.getElementById('grid-size').onchange = rebuildFloor;
document.getElementById('height-mode').onchange = function () {
  randomList = null; // new random heights each time you pick random
  rebuildFloor();
};
document.getElementById('resolution').onchange = rebuildFloor;
document.getElementById('paths').onchange = function () {
  sky.showPaths = document.getElementById('paths').checked;
};
document.getElementById('orbit').onchange = function () {
  camera.autoOrbit = document.getElementById('orbit').checked;
};

// load the two images for level 2. getImageData only works when the page
// comes from a server (GitHub pages or a local server), not from file://
function loadImage(src, done) {
  const img = new Image();
  img.onload = function () {
    try {
      done(readPixels(img));
    } catch (e) {
      document.getElementById('error').textContent = 'Could not read the image pixels. Open the page from a server, for example run "python3 -m http.server" in this folder and go to localhost:8000.';
    }
    if (heightPixels && colorPixels) rebuildFloor();
  };
  img.onerror = function () {
    document.getElementById('error').textContent = 'Could not load ' + src;
  };
  img.src = src;
}
loadImage('images/heightmap.png', function (p) { heightPixels = p; });
loadImage('images/colormap.png', function (p) { colorPixels = p; });

// ---------------------------------------------------------------
// 4. camera
// ---------------------------------------------------------------
// the camera sits on a circle around the target:
//   eye = (radius * cos(angle), height, radius * sin(angle))
// when autoOrbit is on we add a little to the angle every frame.
const camera = {
  angle: 0.8,
  height: 4,
  radius: 8,
  target: [0, 0, 0],
  autoOrbit: false,
};

let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('mousedown', function (e) {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('mouseup', function () {
  dragging = false;
});
window.addEventListener('mousemove', function (e) {
  if (!dragging) return;
  camera.angle += (e.clientX - lastX) * 0.01;
  camera.height -= (e.clientY - lastY) * 0.1;
  if (camera.height < 1) camera.height = 1;
  if (camera.height > 80) camera.height = 80;
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener('wheel', function (e) {
  e.preventDefault(); // stop the page from scrolling
  if (e.deltaY > 0) camera.radius *= 1.1;
  else camera.radius *= 0.9;
  if (camera.radius < 4) camera.radius = 4;
  if (camera.radius > 90) camera.radius = 90;
});

function getEyeAndTarget() {
  if (document.getElementById('ride').checked) {
    // behind and a bit above the submarine, looking a little ahead of it
    const back = scaleVec(sky.subDir, -22);
    return {
      eye: add(add(sky.subPos, back), [0, 8, 0]),
      target: add(sky.subPos, scaleVec(sky.subDir, 10)),
    };
  }
  return {
    eye: [
      camera.target[0] + camera.radius * Math.cos(camera.angle),
      camera.height,
      camera.target[2] + camera.radius * Math.sin(camera.angle),
    ],
    target: camera.target,
  };
}

// ---------------------------------------------------------------
// 5. draw loop
// ---------------------------------------------------------------
gl.enable(gl.DEPTH_TEST);

const fpsText = document.getElementById('fps');
let frames = 0;
let fpsTimer = 0;
let lastTime = 0;

function render(ms) {
  const time = ms / 1000;
  const dt = Math.min(0.1, time - lastTime);
  lastTime = time;

  // fps counter, updated twice a second
  frames++;
  fpsTimer += dt;
  if (fpsTimer > 0.5) {
    let cubes = 1;
    if (floor) cubes = floor.count / VERTS_PER_CUBE;
    else if (gridCubes.length > 0) cubes = gridCubes.length;
    fpsText.textContent = Math.round(frames / fpsTimer) + ' fps, ' + cubes + ' floor cubes';
    frames = 0;
    fpsTimer = 0;
  }

  if (camera.autoOrbit && !dragging) camera.angle += dt * 0.15;

  // only resize the canvas when the window size changed
  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.02, 0.05, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const isLevel4 = level === '4';

  // the sky objects need to move before we set the camera,
  // because the ride along camera follows the submarine
  let skyParts = [];
  if (level === '3' || level === '4') skyParts = getSkyParts(time);

  const cam = getEyeAndTarget();
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 800));
  gl.uniformMatrix4fv(uView, false, lookAt(cam.eye, cam.target, [0, 1, 0]));
  gl.uniform3fv(uCameraPos, cam.eye);
  gl.uniform3fv(uLightDir, normalize([0.4, 1.0, 0.3]));

  // level 4 switches
  const phongOn = isLevel4 && document.getElementById('phong').checked;
  const fogOn = isLevel4 && document.getElementById('fog').checked;
  const skyboxOn = isLevel4 && document.getElementById('skybox').checked;
  gl.uniform1f(uPhong, phongOn ? 1 : 0);
  gl.uniform1f(uFogDensity, fogOn ? 0.016 : 0);
  gl.uniform3fv(uFogColor, [0.03, 0.14, 0.22]);

  // skybox first, centered on the camera. we turn off depth writing so
  // it never hides anything drawn after it.
  if (skyboxOn) {
    useBuffer(skybox);
    gl.depthMask(false);
    gl.uniform1f(uNoLight, 1);
    gl.uniform3fv(uTint, [1, 1, 1]);
    gl.uniformMatrix4fv(uModel, false, multiply(translation(cam.eye[0], cam.eye[1], cam.eye[2]), scaling(400, 400, 400)));
    gl.drawArrays(gl.TRIANGLES, 0, skybox.count);
    gl.depthMask(true);
  }

  gl.uniform1f(uNoLight, 0);
  gl.uniform3fv(uTint, [1, 1, 1]);
  gl.uniformMatrix4fv(uModel, false, identity());

  if (level === '0') {
    useBuffer(level0Cube);
    gl.drawArrays(gl.TRIANGLES, 0, level0Cube.count);
  } else if (gridCubes.length > 0) {
    // one draw call per cube, same as the class cube-grid example.
    // the example cube goes from 0 to 1 in y so it keeps translation y at 0.
    // our cube is centered on 0, so we move it up by half its height instead.
    if (gridShaded) useBuffer(shadedCube);
    else useBuffer(unitCube);
    for (let i = 0; i < gridCubes.length; i++) {
      const c = gridCubes[i];
      const model = multiply(translation(c.x, c.height / 2, c.z), scaling(c.width, c.height, c.width));
      gl.uniformMatrix4fv(uModel, false, model);
      gl.uniform3fv(uTint, c.color);
      gl.drawArrays(gl.TRIANGLES, 0, unitCube.count);
    }
    gl.uniform3fv(uTint, [1, 1, 1]);
  } else if (floor) {
    // the whole floor in one draw call
    useBuffer(floor);
    gl.drawArrays(gl.TRIANGLES, 0, floor.count);
  }

  // the sky objects: same unit cube, a different model matrix and color each time
  if (skyParts.length > 0) {
    useBuffer(unitCube);
    for (let i = 0; i < skyParts.length; i++) {
      // windows and the headlight glow, so they skip the lighting
      gl.uniform1f(uNoLight, skyParts[i].glow ? 1 : 0);
      gl.uniformMatrix4fv(uModel, false, skyParts[i].model);
      gl.uniform3fv(uTint, skyParts[i].color);
      gl.drawArrays(gl.TRIANGLES, 0, unitCube.count);
    }
  }

  requestAnimationFrame(render);
}

setLevel('0');
requestAnimationFrame(render);

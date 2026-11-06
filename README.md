# The Abyss: Deep-Sea Descent II

Project 2 (Cube World) for Computer Graphics I at the University of Cincinnati.
By Pratham Prabhu.

A 3D underwater world in WebGL made only out of cubes. It continues my Project 1 (Deep-Sea Descent).
The seafloor is built from a height map and a color image, and a submarine, fish and jellyfish move
through the water on Bezier curves.

**Live app:** https://pratham-2097.github.io/The-Abyss-Deep-Sea-Descent-II-/

## Levels

Each level has its own tab at the top of the page.

- **Level 0:** a single 2 x 2 x 2 cube
- **Level 1a:** a grid of cubes on the x-z plane (translation)
- **Level 1b:** cube heights from random numbers or my hills + trench formula (scaling)
- **Level 1c:** vertex colors based on height, interpolated down the sides of each cube
- **Level 1d:** camera that circles the center and looks at it (lookAt)
- **Level 2:** heights and colors sampled from `images/heightmap.png` and `images/colormap.png`, with resolutions from 25 x 25 up to 200 x 200
- **Level 3:** submarine, fish and jellyfish made of scaled, rotated and translated cubes, moving on cubic Bezier curves (De Casteljau)
- **Level 4:** Phong lighting, fog, a cube skybox, and a ride along camera that follows the submarine

Controls: drag to move the camera, scroll to zoom.

## Running it locally

The images are read with `getImageData`, which browsers block when the page is opened as a file.
Run a small server in this folder:

```
python3 -m http.server
```

and open http://localhost:8000.

## Files

- `index.html`, `style.css`: the page
- `js/matrix.js`: matrix and vector helpers (translation, scaling, rotation, perspective, lookAt)
- `js/cube.js`: the one cube model and the buffer helpers
- `js/terrain.js`: building the seafloor (Levels 1 and 2)
- `js/bezier.js`: Bezier curves with De Casteljau's algorithm
- `js/sky.js`: the objects in the water (Level 3)
- `js/main.js`: shaders, levels, camera and the draw loop
- `images/make_images.py`: the script I used to make the height map and color image



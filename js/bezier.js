// bezier.js
// bezier curves for the paths of the objects in the water (level 3).
//
// cubic bezier = 4 control points p0, p1, p2, p3. the curve starts at p0
// (t = 0) and ends at p3 (t = 1). p1 and p2 only pull the curve.
//
// de casteljau's algorithm. the class subdivision tool does this with a while
// loop and calls the helper lerp. we wrote it as a recursive function instead:
//   base case: one point left, return it
//   recursive case: blend each pair of neighbors, call again with the shorter list

// the point a fraction t of the way from a to b
function pointBetween(a, b, t) {
  return [
    (1 - t) * a[0] + t * b[0],
    (1 - t) * a[1] + t * b[1],
    (1 - t) * a[2] + t * b[2],
  ];
}

function deCasteljau(points, t) {
  if (points.length === 1) {
    return points[0];
  }
  const next = [];
  for (let i = 0; i < points.length - 1; i++) {
    next.push(pointBetween(points[i], points[i + 1], t));
  }
  return deCasteljau(next, t);
}

// direction of the curve at t, we just look a tiny step ahead
function bezierDirection(points, t) {
  const a = deCasteljau(points, Math.max(0, t - 0.005));
  const b = deCasteljau(points, Math.min(1, t + 0.005));
  return normalize(subtract(b, a));
}

// a long path made of cubic pieces joined end to end (the last point of one
// piece is the first point of the next). u goes from 0 to 1 over the whole path.
function pathPoint(pieces, u) {
  const scaled = u * pieces.length;
  let i = Math.floor(scaled);
  if (i >= pieces.length) i = pieces.length - 1;
  return deCasteljau(pieces[i], scaled - i);
}

function pathDirection(pieces, u) {
  const scaled = u * pieces.length;
  let i = Math.floor(scaled);
  if (i >= pieces.length) i = pieces.length - 1;
  return bezierDirection(pieces[i], scaled - i);
}

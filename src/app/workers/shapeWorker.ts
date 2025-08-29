// Web Worker for shape creation
self.onmessage = (e: MessageEvent) => {
  const { mask } = e.data;
  
  const width = mask.width;
  const height = mask.height;
  const data = mask.data;

  // Configuration parameters
  const ALPHA_THRESHOLD = 128;
  const SOLID_ALPHA_THRESHOLD = 96; // More lenient to close anti-aliased gaps
  const TARGET_RES = 1024; // Higher target for quality
  const ANGLE_THRESHOLD = 0.05;
  const DISTANCE_THRESHOLD = 2;
  const MIN_SHAPE_SIZE = 5;
  const MAX_NEIGHBOR_DISTANCE = 3;
  const SMOOTHING_FACTOR = 0.05;
  const MAX_TURN_ANGLE = Math.PI * 0.9; // Allow sharper turns (162 degrees)
  const MIN_DISTANCE = 1; // Minimum distance between points

  // Find ROI (bounding box of solid pixels) in the original image
  let roiMinX = width, roiMinY = height, roiMaxX = -1, roiMaxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx + 3] > SOLID_ALPHA_THRESHOLD) {
        if (x < roiMinX) roiMinX = x;
        if (x > roiMaxX) roiMaxX = x;
        if (y < roiMinY) roiMinY = y;
        if (y > roiMaxY) roiMaxY = y;
      }
    }
  }
  if (roiMaxX === -1) {
    self.postMessage({ shapes: [] });
    return;
  }
  // Add a small padding
  const pad = 2;
  roiMinX = Math.max(0, roiMinX - pad);
  roiMinY = Math.max(0, roiMinY - pad);
  roiMaxX = Math.min(width - 1, roiMaxX + pad);
  roiMaxY = Math.min(height - 1, roiMaxY + pad);
  const roiW = roiMaxX - roiMinX + 1;
  const roiH = roiMaxY - roiMinY + 1;

  // Downscale ROI to a manageable resolution
  const maxDim = Math.max(roiW, roiH);
  const reduceFactor = Math.max(1, Math.ceil(maxDim / TARGET_RES));
  const rw = Math.max(2, Math.floor(roiW / reduceFactor));
  const rh = Math.max(2, Math.floor(roiH / reduceFactor));

  // Build integral image over ROI for fast area sampling
  const integral = new Uint32Array((roiW + 1) * (roiH + 1));
  for (let y = 1; y <= roiH; y++) {
    let rowSum = 0;
    for (let x = 1; x <= roiW; x++) {
      const srcX = roiMinX + (x - 1);
      const srcY = roiMinY + (y - 1);
      const idx = (srcY * width + srcX) * 4;
      const val = data[idx + 3] > SOLID_ALPHA_THRESHOLD ? 1 : 0;
      rowSum += val;
      integral[y * (roiW + 1) + x] = integral[(y - 1) * (roiW + 1) + x] + rowSum;
    }
  }

  function rectSum(x0: number, y0: number, x1: number, y1: number): number {
    // rectangle [x0,x1) x [y0,y1) in ROI coordinates
    return (
      integral[y1 * (roiW + 1) + x1] -
      integral[y0 * (roiW + 1) + x1] -
      integral[y1 * (roiW + 1) + x0] +
      integral[y0 * (roiW + 1) + x0]
    );
  }

  // Build reduced binary mask by area coverage (box filter)
  const closedMask = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    const y0 = Math.min(roiH, y * reduceFactor);
    const y1 = Math.min(roiH, (y + 1) * reduceFactor);
    for (let x = 0; x < rw; x++) {
      const x0 = Math.min(roiW, x * reduceFactor);
      const x1 = Math.min(roiW, (x + 1) * reduceFactor);
      const sum = rectSum(x0, y0, x1, y1);
      const area = (x1 - x0) * (y1 - y0) || 1;
      const ratio = sum / area;
      closedMask[y * rw + x] = ratio >= 0.5 ? 1 : 0;
    }
  }

  function isPixelSolid(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return closedMask[y * width + x] === 1;
  }

  function isOutlinePixel(x: number, y: number): boolean {
    if (!isPixelSolid(x, y)) return false;
    
    // Check in 8 directions for better outline detection
    let transparentNeighbors = 0;
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (!isPixelSolid(x + dx, y + dy)) {
          transparentNeighbors++;
        }
      }
    }
    
    // Require at least 2 transparent neighbors
    return transparentNeighbors >= 2;
  }

  function isPixelTransparent(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const index = (y * width + x) * 4;
    return data[index + 3] <= ALPHA_THRESHOLD;
  }

  function floodFill(startX: number, startY: number, shapeId: number, shapes: Map<string, number>): number {
    const queue: [number, number][] = [[startX, startY]];
    let size = 0;
    
    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      const key = `${x},${y}`;
      
      if (shapes.has(key)) continue;
      if (!isPixelSolid(x, y)) continue;
      
      shapes.set(key, shapeId);
      size++;
      
      // Add neighbors to queue (8-directional)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            queue.push([nx, ny]);
          }
        }
      }
    }
    
    return size;
  }

  function findNextOutlinePoint(current: { x: number; y: number }, outlinePoints: Set<string>, lastDirection?: { dx: number; dy: number }): { x: number; y: number } | null {
    const candidates: { point: { x: number; y: number }, dist: number, angle: number }[] = [];
    
    // Look for candidates within MAX_NEIGHBOR_DISTANCE
    for (const key of outlinePoints) {
      const [x, y] = key.split(',').map(Number);
      const dx = x - current.x;
      const dy = y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Skip points that are too close
      if (dist < MIN_DISTANCE) continue;
      
      if (dist <= MAX_NEIGHBOR_DISTANCE) {
        let angle = 0;
        if (lastDirection) {
          const dot = dx * lastDirection.dx + dy * lastDirection.dy;
          const mag1 = Math.sqrt(dx * dx + dy * dy);
          const mag2 = Math.sqrt(lastDirection.dx * lastDirection.dx + lastDirection.dy * lastDirection.dy);
          angle = Math.acos(dot / (mag1 * mag2));
          
          // Only skip points that would create extremely sharp turns
          if (angle > MAX_TURN_ANGLE) continue;
        }
        candidates.push({ point: { x, y }, dist, angle });
      }
    }
    
    if (candidates.length === 0) {
      // If no close neighbors, fall back to nearest point but with more lenient angle check
      let minDist = Infinity;
      let nearest = null;
      
      for (const key of outlinePoints) {
        const [x, y] = key.split(',').map(Number);
        const dx = x - current.x;
        const dy = y - current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Skip points that are too close
        if (dist < MIN_DISTANCE) continue;
        
        // Only consider points within a reasonable distance
        if (dist > MAX_NEIGHBOR_DISTANCE * 2) continue;
        
        if (lastDirection) {
          const dot = dx * lastDirection.dx + dy * lastDirection.dy;
          const mag1 = Math.sqrt(dx * dx + dy * dy);
          const mag2 = Math.sqrt(lastDirection.dx * lastDirection.dx + lastDirection.dy * lastDirection.dy);
          const angle = Math.acos(dot / (mag1 * mag2));
          
          // Only skip points that would create extremely sharp turns
          if (angle > MAX_TURN_ANGLE) continue;
        }
        
        if (dist < minDist) {
          minDist = dist;
          nearest = { x, y };
        }
      }
      
      return nearest;
    }
    
    // Among close candidates, prefer the one that maintains the current direction
    // and is closest to the current point
    candidates.sort((a, b) => {
      // First prioritize points that maintain direction
      if (Math.abs(a.angle - b.angle) > 0.5) {
        return a.angle - b.angle;
      }
      // Then prefer closer points
      return a.dist - b.dist;
    });
    
    return candidates[0].point;
  }

  function normalizePoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    return points.map(p => ({
      x: p.x / width,
      y: 1 - (p.y / height) // Flip y-coordinate
    }));
  }

  function polygonArea(points: { x: number; y: number }[]): number {
    // Signed area (positive for CCW in screen coords used here)
    let area = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      area += (points[j].x * points[i].y - points[i].x * points[j].y);
    }
    return area / 2;
  }

  function smoothPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length <= 3) return points;
    
    const smoothed: { x: number; y: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      
      smoothed.push({
        x: curr.x + SMOOTHING_FACTOR * ((prev.x + next.x) / 2 - curr.x),
        y: curr.y + SMOOTHING_FACTOR * ((prev.y + next.y) / 2 - curr.y)
      });
    }
    return smoothed;
  }

  function simplifyPoints(points: { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length <= 3) return points;
    
    const result: { x: number; y: number }[] = [points[0]];
    let lastPoint = points[0];
    let lastAngle = 0;
    
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      
      const angle1 = Math.atan2(current.y - lastPoint.y, current.x - lastPoint.x);
      const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
      const angleDiff = Math.abs(angle1 - angle2);
      
      const distance = Math.sqrt(
        Math.pow(current.x - lastPoint.x, 2) + 
        Math.pow(current.y - lastPoint.y, 2)
      );
      
      // Keep point if it represents a significant change in direction or distance
      if (angleDiff > ANGLE_THRESHOLD || 
          Math.abs(angle1 - lastAngle) > ANGLE_THRESHOLD || 
          distance > DISTANCE_THRESHOLD) {
        result.push(current);
        lastPoint = current;
        lastAngle = angle1;
      }
    }
    
    result.push(points[points.length - 1]);
    return result;
  }

  function simplifyRDP(points: { x: number; y: number }[], epsilon: number = 0.75): { x: number; y: number }[] {
    if (points.length <= 3) return points;
    const closed = points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y;
    const work = closed ? points.slice(0, -1) : points.slice();

    function perpendicularDistance(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      return Math.hypot(p.x - projX, p.y - projY);
    }

    function rdp(pts: { x: number; y: number }[], start: number, end: number, eps: number, out: number[]) {
      let maxDist = 0;
      let index = -1;
      for (let i = start + 1; i < end; i++) {
        const d = perpendicularDistance(pts[i], pts[start], pts[end]);
        if (d > maxDist) { maxDist = d; index = i; }
      }
      if (maxDist > eps && index !== -1) {
        rdp(pts, start, index, eps, out);
        out.push(index);
        rdp(pts, index, end, eps, out);
      }
    }

    const outIdx: number[] = [0];
    rdp(work, 0, work.length - 1, epsilon, outIdx);
    outIdx.push(work.length - 1);
    outIdx.sort((a, b) => a - b);
    const simplified = outIdx.map(i => work[i]);
    if (closed) simplified.push(simplified[0]);
    return simplified;
  }

  function findShapes(): { x: number; y: number }[][] {
    // First, find all separate shapes using flood fill
    const shapeMap = new Map<string, number>();
    const shapeSizes = new Map<number, number>();
    let nextShapeId = 1;

    // Find all shapes using flood fill
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        if (shapeMap.has(key)) continue;
        
        if (isPixelSolid(x, y)) {
          const size = floodFill(x, y, nextShapeId, shapeMap);
          if (size >= MIN_SHAPE_SIZE) {
            shapeSizes.set(nextShapeId, size);
            nextShapeId++;
          }
        }
      }
    }

    const shapes: { x: number; y: number }[][] = [];

    // Process each shape separately
    for (const shapeId of shapeSizes.keys()) {
      // Find outline pixels for this shape
      const outlinePoints = new Set<string>();
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const key = `${x},${y}`;
          if (shapeMap.get(key) === shapeId && isOutlinePixel(x, y)) {
            outlinePoints.add(key);
          }
        }
      }

      // Convert outline points to a continuous path
      const path: { x: number; y: number }[] = [];
      let currentPoint = Array.from(outlinePoints)
        .map(key => {
          const [x, y] = key.split(',').map(Number);
          return { x, y };
        })
        .reduce((a, b) => a.x < b.x ? a : b); // Start with leftmost point

      let lastDirection = { dx: 0, dy: 0 };
      while (outlinePoints.size > 0) {
        const key = `${currentPoint.x},${currentPoint.y}`;
        path.push(currentPoint);
        outlinePoints.delete(key);

        const next = findNextOutlinePoint(currentPoint, outlinePoints, lastDirection);
        if (!next) break;
        
        lastDirection = {
          dx: next.x - currentPoint.x,
          dy: next.y - currentPoint.y
        };
        currentPoint = next;
      }

      if (path.length >= 3) {
        // Close the shape by adding the first point again
        if (path.length > 0) {
          path.push(path[0]);
        }
        
        // Apply smoothing and simplification
        const smoothed = smoothPoints(path);
        const simplified = simplifyPoints(smoothed);
        const normalized = normalizePoints(simplified);
        shapes.push(normalized);
      }
    }

    return shapes;
  }

  // Background flood fill to identify holes (transparent regions not touching image border)
  function floodFillBackground(startX: number, startY: number, bgId: number, bgMap: Map<string, number>): { size: number; touchesBorder: boolean; pixels: [number, number][] } {
    const queue: [number, number][] = [[startX, startY]];
    let size = 0;
    let touchesBorder = false;
    const pixels: [number, number][] = [];

    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      const key = `${x},${y}`;
      if (bgMap.has(key)) continue;
      if (!isPixelTransparent(x, y)) continue;
      bgMap.set(key, bgId);
      size++;
      pixels.push([x, y]);
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        touchesBorder = true;
      }
      // 4-neighborhood to avoid diagonal leaks
      const neighbors: [number, number][] = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          queue.push([nx, ny]);
        }
      }
    }

    return { size, touchesBorder, pixels };
  }

  function isOutlinePixelBackgroundForId(x: number, y: number, bgId: number, bgMap: Map<string, number>): boolean {
    const key = `${x},${y}`;
    if (bgMap.get(key) !== bgId) return false;
    // neighbors containing a solid pixel mark boundary between bg and fg
    if (isPixelSolid(x - 1, y)) return true;
    if (isPixelSolid(x + 1, y)) return true;
    if (isPixelSolid(x, y - 1)) return true;
    if (isPixelSolid(x, y + 1)) return true;
    return false;
  }

  function buildPathFromOutlineSet(outlinePoints: Set<string>): { x: number; y: number }[] {
    if (outlinePoints.size === 0) return [];
    const path: { x: number; y: number }[] = [];
    let currentPoint = Array.from(outlinePoints)
      .map(key => {
        const [x, y] = key.split(',').map(Number);
        return { x, y };
      })
      .reduce((a, b) => (a.x < b.x ? a : b));

    let lastDirection = { dx: 0, dy: 0 };
    while (outlinePoints.size > 0) {
      const key = `${currentPoint.x},${currentPoint.y}`;
      path.push(currentPoint);
      outlinePoints.delete(key);
      const next = findNextOutlinePoint(currentPoint, outlinePoints, lastDirection);
      if (!next) break;
      lastDirection = { dx: next.x - currentPoint.x, dy: next.y - currentPoint.y };
      currentPoint = next;
    }
    if (path.length > 0) path.push(path[0]);
    return path;
  }

  // Marching Squares implementation to robustly extract contours and holes
  function marchingSquaresContours(): { x: number; y: number }[][] {
    const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = [];

    function v(x: number, y: number): number {
      if (x < 0 || y < 0 || x >= rw || y >= rh) return 0;
      return closedMask[y * rw + x];
    }

    function midpoints(x: number, y: number) {
      return {
        left: { x, y: y + 0.5 },
        right: { x: x + 1, y: y + 0.5 },
        top: { x: x + 0.5, y },
        bottom: { x: x + 0.5, y: y + 1 },
      };
    }

    for (let y = 0; y < rh - 1; y++) {
      for (let x = 0; x < rw - 1; x++) {
        const tl = v(x, y);
        const tr = v(x + 1, y);
        const br = v(x + 1, y + 1);
        const bl = v(x, y + 1);
        const idx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const m = midpoints(x, y);
        switch (idx) {
          case 1: segments.push({ a: m.bottom, b: m.left }); break;
          case 2: segments.push({ a: m.right, b: m.bottom }); break;
          case 3: segments.push({ a: m.right, b: m.left }); break;
          case 4: segments.push({ a: m.top, b: m.right }); break;
          case 5: segments.push({ a: m.top, b: m.left }); segments.push({ a: m.right, b: m.bottom }); break;
          case 6: segments.push({ a: m.top, b: m.bottom }); break;
          case 7: segments.push({ a: m.left, b: m.top }); break;
          case 8: segments.push({ a: m.left, b: m.top }); break;
          case 9: segments.push({ a: m.top, b: m.bottom }); break;
          case 10: segments.push({ a: m.top, b: m.right }); segments.push({ a: m.left, b: m.bottom }); break;
          case 11: segments.push({ a: m.right, b: m.top }); break;
          case 12: segments.push({ a: m.left, b: m.right }); break;
          case 13: segments.push({ a: m.bottom, b: m.right }); break;
          case 14: segments.push({ a: m.left, b: m.bottom }); break;
        }
      }
    }

    // Build polylines from segments
    const key = (p: { x: number; y: number }) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    const adj = new Map<string, { x: number; y: number }[]>();
    for (const s of segments) {
      const ka = key(s.a), kb = key(s.b);
      if (!adj.has(ka)) adj.set(ka, []);
      if (!adj.has(kb)) adj.set(kb, []);
      adj.get(ka)!.push(s.b);
      adj.get(kb)!.push(s.a);
    }

    const paths: { x: number; y: number }[][] = [];
    const visited = new Set<string>();

    for (const [startKey] of adj) {
      if (visited.has(startKey)) continue;
      const neighbors = adj.get(startKey)!;
      if (neighbors.length === 0) continue;

      // Walk the loop
      const start = { x: parseFloat(startKey.split(',')[0]), y: parseFloat(startKey.split(',')[1]) };
      let current = start;
      let prevKey = '';
      const path: { x: number; y: number }[] = [];
      while (true) {
        path.push(current);
        const ck = key(current);
        visited.add(ck);
        const nbs = adj.get(ck) || [];
        let next: { x: number; y: number } | null = null;
        for (const nb of nbs) {
          const nk = key(nb);
          if (nk !== prevKey) { next = nb; break; }
        }
        if (!next) break;
        prevKey = ck;
        current = next;
        if (key(current) === key(start)) {
          path.push(start);
          break;
        }
      }

      if (path.length >= 4) paths.push(path);
    }

    return paths;
  }

  function centroid(points: { x: number; y: number }[]): { x: number; y: number } {
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    return { x: cx / points.length, y: cy / points.length };
  }

  function bbox(points: { x: number; y: number }[]) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  function findInteriorPoint(poly: { x: number; y: number }[]): { x: number; y: number } | null {
    const b = bbox(poly);
    const steps = 5;
    for (let iy = 0; iy <= steps; iy++) {
      for (let ix = 0; ix <= steps; ix++) {
        const px = b.minX + (ix / steps) * (b.maxX - b.minX);
        const py = b.minY + (iy / steps) * (b.maxY - b.minY);
        const p = { x: px, y: py };
        if (pointInPolygon(p, poly)) return p;
      }
    }
    // Fallback to centroid
    const c = centroid(poly);
    if (pointInPolygon(c, poly)) return c;
    return null;
  }

  function pointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || 1e-6) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function interiorMaskRatio(poly: { x: number; y: number }[]): number {
    const b = bbox(poly);
    const widthBox = Math.max(1, Math.floor(b.maxX - b.minX));
    const heightBox = Math.max(1, Math.floor(b.maxY - b.minY));
    const stepsX = Math.min(10, widthBox);
    const stepsY = Math.min(10, heightBox);
    let insideCount = 0;
    let solidCount = 0;
    for (let iy = 0; iy <= stepsY; iy++) {
      for (let ix = 0; ix <= stepsX; ix++) {
        const px = b.minX + (ix / (stepsX || 1)) * (b.maxX - b.minX);
        const py = b.minY + (iy / (stepsY || 1)) * (b.maxY - b.minY);
        const p = { x: px, y: py };
        if (pointInPolygon(p, poly)) {
          insideCount++;
          const sx = Math.min(Math.max(Math.floor(px), 0), rw - 1);
          const sy = Math.min(Math.max(Math.floor(py), 0), rh - 1);
          if (closedMask[sy * rw + sx] === 1) solidCount++;
        }
      }
    }
    if (insideCount === 0) return 0;
    return solidCount / insideCount;
  }

  function extractShapesMarchingSquares(): { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[] {
    const paths = marchingSquaresContours();
    const outers: { path: { x: number; y: number }[] }[] = [];
    const holes: { path: { x: number; y: number }[] }[] = [];

    for (const path of paths) {
      const ratio = interiorMaskRatio(path);
      if (ratio >= 0.5) {
        outers.push({ path });
      } else {
        holes.push({ path });
      }
    }

    // Assign holes to containing outer
    const result: { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[] = [];
    for (const outer of outers) {
      result.push({ outer: outer.path, holes: [] });
    }
    for (const h of holes) {
      const c = centroid(h.path);
      let assigned = false;
      for (const r of result) {
        if (pointInPolygon(c, r.outer)) {
          r.holes.push(h.path);
          assigned = true;
          break;
        }
      }
      // If not assigned, ignore (likely outside main shapes)
    }

    // Smooth/simplify, scale to original resolution, normalize; enforce orientations
    const finalResult: { outer: { x: number; y: number }[]; holes: { x: number; y: number }[][] }[] = [];
    for (const r of result) {
      // Filter very small loops
      const areaR = Math.abs(polygonArea(r.outer));
      const areaNorm = (areaR * reduceFactor * reduceFactor) / (width * height);
      if (areaNorm < 0.00005) { continue; }

      const scaledOuter = r.outer.map(p => ({ x: roiMinX + p.x * reduceFactor, y: roiMinY + p.y * reduceFactor }));
      const smO = smoothPoints(scaledOuter);
      const siO = simplifyRDP(smO);
      const no = normalizePoints(siO);
      const outerArea = polygonArea(no);
      const outer = outerArea < 0 ? no.slice().reverse() : no;

      const hh: { x: number; y: number }[][] = [];
      for (const h of r.holes) {
        const scaledHole = h.map(p => ({ x: roiMinX + p.x * reduceFactor, y: roiMinY + p.y * reduceFactor }));
        const smH = smoothPoints(scaledHole);
        const siH = simplifyRDP(smH);
        const nh = normalizePoints(siH);
        let hole = nh;
        const holeArea = polygonArea(nh);
        const needReverse = (outerArea >= 0 && holeArea >= 0) || (outerArea < 0 && holeArea < 0);
        if (needReverse) hole = nh.slice().reverse();
        hh.push(hole);
      }
      finalResult.push({ outer, holes: hh });
    }

    return finalResult;
  }

  const shapesWithHoles = extractShapesMarchingSquares();
  self.postMessage({ shapes: shapesWithHoles });
};

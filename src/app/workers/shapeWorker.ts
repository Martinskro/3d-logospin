// Web Worker for shape creation
self.onmessage = (e: MessageEvent) => {
  const { mask } = e.data;
  
  const width = mask.width;
  const height = mask.height;
  const data = mask.data;

  // Configuration parameters
  const ALPHA_THRESHOLD = 128;
  const ANGLE_THRESHOLD = 0.05;
  const DISTANCE_THRESHOLD = 2;
  const MIN_SHAPE_SIZE = 5;
  const MAX_NEIGHBOR_DISTANCE = 3;
  const SMOOTHING_FACTOR = 0.3;
  const MAX_TURN_ANGLE = Math.PI * 0.9; // Allow sharper turns (162 degrees)
  const MIN_DISTANCE = 1; // Minimum distance between points

  function isPixelSolid(x: number, y: number): boolean {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const index = (y * width + x) * 4;
    return data[index + 3] > ALPHA_THRESHOLD;
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

  const shapes = findShapes();
  self.postMessage({ shapes });
}; 
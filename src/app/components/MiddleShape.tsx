import { useEffect, useState, useMemo } from 'react';
import { Shape, Vector2, ExtrudeGeometry } from 'three';
import { createShapeFromMask } from '../utils/shapeCreator';

interface MiddleShapeProps {
  mask?: ImageData;
  color?: string;
  depth?: number;
}

export function MiddleShape({ mask, color = '#ffffff', depth = 0.5 }: MiddleShapeProps) {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    if (mask) {
      createShapeFromMask(mask).then(result => {
        if (result.shapes && result.shapes.length > 0) {
          // Filter and validate shapes
          const validShapes = result.shapes
            .filter(points => {
              // Ensure we have at least 3 points to form a valid shape
              if (points.length < 3) return false;
              
              // Check if the shape is too small (likely noise)
              const bounds = points.reduce((acc, p) => ({
                minX: Math.min(acc.minX, p.x),
                maxX: Math.max(acc.maxX, p.x),
                minY: Math.min(acc.minY, p.y),
                maxY: Math.max(acc.maxY, p.y)
              }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

              const width = bounds.maxX - bounds.minX;
              const height = bounds.maxY - bounds.minY;
              
              // Filter out shapes that are too small (less than 1% of the image size)
              return width > 0.02 && height > 0.02;
            })
            .map(points => {
              const shape = new Shape();
              shape.setFromPoints(points.map(p => new Vector2(p.x, p.y)));
              shape.closePath();
              return shape;
            });

          setShapes(validShapes);
        } else {
          setShapes([]);
        }
      });
    } else {
      setShapes([]);
    }
  }, [mask]);

  const extrudeSettings = useMemo(() => ({
    depth: depth,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 12
  }), [depth]);

  return (
    <group position={[0, 0, -depth/2]}>
      {shapes.length > 0 ? (
        shapes.map((shape, index) => (
          <mesh key={index} position={[0, 0, 0]}>
            <extrudeGeometry args={[shape, extrudeSettings]} />
            <meshPhongMaterial 
              color={color}
              transparent={false}
              side={0}
              depthWrite={true}
              depthTest={true}
              shininess={30}
            />
          </mesh>
        ))
      ) : (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 2, depth]} />
          <meshPhongMaterial 
            color={color}
            transparent={false}
            side={0}
            depthWrite={true}
            depthTest={true}
            shininess={30}
          />
        </mesh>
      )}
    </group>
  );
} 
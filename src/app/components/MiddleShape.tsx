import { useEffect, useState, useMemo } from 'react';
import { Shape, Vector2, Path } from 'three';
import { createShapeFromMask } from '../utils/shapeCreator';

interface MiddleShapeProps {
  mask?: ImageData;
  color?: string;
  depth?: number;
  width?: number;
  height?: number;
}

export function MiddleShape({ mask, color = '#ffffff', depth = 0.5, width = 2, height = 2 }: MiddleShapeProps) {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    if (mask) {
      createShapeFromMask(mask).then(result => {
        if (result.shapes && result.shapes.length > 0) {
          const built: Shape[] = [];
          for (const sh of result.shapes) {
            const outer = sh.outer;
            if (!outer || outer.length < 3) continue;

            // Bounds check on outer
            const bounds = outer.reduce((acc, p) => ({
              minX: Math.min(acc.minX, p.x),
              maxX: Math.max(acc.maxX, p.x),
              minY: Math.min(acc.minY, p.y),
              maxY: Math.max(acc.maxY, p.y)
            }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
            const shapeWidth = bounds.maxX - bounds.minX;
            const shapeHeight = bounds.maxY - bounds.minY;
            if (shapeWidth <= 0.02 || shapeHeight <= 0.02) continue; // filter noise

            const shape = new Shape();
            const outerScaled = outer.map(p => new Vector2(
              (p.x * 2 - 1) * (width / 2),
              (p.y * 2 - 1) * (height / 2)
            ));
            shape.setFromPoints(outerScaled);
            shape.closePath();

            if (sh.holes && sh.holes.length) {
              for (const hole of sh.holes) {
                if (!hole || hole.length < 3) continue;
                const holeScaled = hole.map(p => new Vector2(
                  (p.x * 2 - 1) * (width / 2),
                  (p.y * 2 - 1) * (height / 2)
                ));
                const holePath = new Path();
                holePath.setFromPoints(holeScaled);
                holePath.closePath();
                shape.holes.push(holePath);
              }
            }

            built.push(shape);
          }
          setShapes(built);
        } else {
          setShapes([]);
        }
      });
    } else {
      setShapes([]);
    }
  }, [mask, width, height]);

  const extrudeSettings = useMemo(() => ({
    depth: depth,
    bevelEnabled: false,
    bevelThickness: 0,
    bevelSize: 0,
    bevelOffset: 0,
    bevelSegments: 0,
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
          <boxGeometry args={[width, height, depth]} />
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

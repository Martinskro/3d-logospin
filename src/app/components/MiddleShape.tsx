import { useEffect, useState } from 'react';
import { Shape, Vector2 } from 'three';
import { createShapeFromMask } from '../utils/shapeCreator';

interface MiddleShapeProps {
  mask?: ImageData;
  color?: string;
}

export function MiddleShape({ mask, color = '#ffffff' }: MiddleShapeProps) {
  const [shapes, setShapes] = useState<Shape[]>([]);

  useEffect(() => {
    if (mask) {
      console.log('Creating shapes from mask:', {
        width: mask.width,
        height: mask.height,
        dataLength: mask.data.length
      });

      createShapeFromMask(mask).then(result => {
        if (result.shapes && result.shapes.length > 0) {
          const newShapes = result.shapes.map(points => {
            const shape = new Shape();
            shape.setFromPoints(points.map(p => new Vector2(p.x, p.y)));
            shape.closePath();
            return shape;
          });
          console.log('Created shapes:', newShapes.length);
          setShapes(newShapes);
        } else {
          console.log('No shapes created');
          setShapes([]);
        }
      });
    } else {
      console.log('No mask provided');
      setShapes([]);
    }
  }, [mask]);

  return (
    <group position={[0, 0, 0]}>
      {shapes.length > 0 ? (
        shapes.map((shape, index) => (
          <mesh key={index} position={[0, 0, 0]}>
            <shapeGeometry args={[shape]} />
            <meshBasicMaterial 
              color={color}
              transparent={false}
              side={2}
              depthWrite={true}
              depthTest={true}
            />
          </mesh>
        ))
      ) : (
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[2, 2]} />
          <meshBasicMaterial 
            color={color}
            transparent={false}
            side={2}
            depthWrite={true}
            depthTest={true}
          />
        </mesh>
      )}
    </group>
  );
} 
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import { Mesh, Color } from 'three';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

interface LogoProps {
  speed: number;
  material: string;
  scale: number;
}

function Logo({ speed, material, scale }: LogoProps) {
  const meshRef = useRef<Mesh>(null);
  const [rotationSpeed, setRotationSpeed] = useState(0.01);

  // Update rotation speed based on speed prop
  useEffect(() => {
    setRotationSpeed(speed / 2500); // Convert slider value (0-100) to reasonable rotation speed
  }, [speed]);

  // Update scale when it changes
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.scale.set(scale, scale, scale);
    }
  }, [scale]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed;
    }
  });

  // Define material properties based on material type
  const getMaterialProps = () => {
    switch (material) {
      case 'glossy':
        return {
          metalness: 0.1,
          roughness: 0.1,
          color: '#0054ff'
        };
      case 'matte':
        return {
          metalness: 0.1,
          roughness: 0.8,
          color: '#0054ff'
        };
      case 'metallic':
        return {
          metalness: 0.9,
          roughness: 0.2,
          color: '#0054ff'
        };
      default:
        return {
          metalness: 0.5,
          roughness: 0.2,
          color: '#0054ff'
        };
    }
  };

  const materialProps = getMaterialProps();

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 0.2]} />
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

interface LogoSceneProps {
  animationSpeed: number;
  material: string;
  backgroundColor: string;
  canvasWidth: number;
  canvasHeight: number;
  logoScale: number;
}

export default function LogoScene({
  animationSpeed,
  material,
  backgroundColor,
  canvasWidth,
  canvasHeight,
  logoScale
}: LogoSceneProps) {
  return (
    <Canvas 
      camera={{ position: [0, 0, 5], fov: 50 }}
      style={{ 
        width: '100%', 
        height: '100%',
        background: backgroundColor 
      }}
      gl={{ preserveDrawingBuffer: true }}
      dpr={[1, 2]}
    >
      <PerspectiveCamera 
        makeDefault 
        position={[0, 0, 5]}
        fov={50}
        near={0.1}
        far={1000}
      />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Logo 
        speed={animationSpeed}
        material={material}
        scale={logoScale}
      />
      <OrbitControls 
        enableZoom={false}
        enablePan={false}
        enableRotate={true}
        rotateSpeed={animationSpeed / 100}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
} 
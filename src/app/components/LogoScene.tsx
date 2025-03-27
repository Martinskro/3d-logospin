'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import { Mesh, TextureLoader, Group } from 'three';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';

interface LogoProps {
  imageUrl: string;
  speed: number;
  scale: number;
  depth: number;
}

function Logo({ imageUrl, speed, scale, depth }: LogoProps) {
  const groupRef = useRef<Group>(null);
  const [rotationSpeed, setRotationSpeed] = useState(0.01);
  const texture = useLoader(TextureLoader, imageUrl);

  // Update rotation speed based on speed prop
  useEffect(() => {
    setRotationSpeed(speed / 2500);
  }, [speed]);

  // Update scale when it changes
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.scale.set(scale, scale, scale);
    }
  }, [scale]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeed;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Front face */}
      <mesh position={[0, 0, depth / 2]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial 
          map={texture}
          transparent={true}
          opacity={1}
          side={2}
        />
      </mesh>
      {/* Back face */}
      <mesh position={[0, 0, -depth / 2]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial 
          map={texture}
          transparent={true}
          opacity={1}
          side={2}
        />
      </mesh>
    </group>
  );
}

interface LogoSceneProps {
  imageUrl: string;
  animationSpeed: number;
  backgroundColor: string;
  canvasWidth: number;
  canvasHeight: number;
  logoScale: number;
  depth: number;
}

export default function LogoScene({
  imageUrl,
  animationSpeed,
  backgroundColor,
  canvasWidth,
  canvasHeight,
  logoScale,
  depth
}: LogoSceneProps) {
  return (
    <Canvas 
      camera={{ position: [0, 0, 5], fov: 75 }}
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
        fov={75}
        near={0.1}
        far={1000}
      />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Logo 
        imageUrl={imageUrl}
        speed={animationSpeed}
        scale={logoScale}
        depth={depth}
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
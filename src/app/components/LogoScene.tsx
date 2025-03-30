'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { useRef, useState, useEffect } from 'react';
import { Mesh, TextureLoader, Group, WebGLRenderer, Scene, PerspectiveCamera as ThreePerspectiveCamera } from 'three';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { MiddleShape } from './MiddleShape';

interface LogoProps {
  imageUrl: string;
  speed: number;
  scale: number;
  depth: number;
  color?: string;
  mask?: ImageData;
}

function Logo({ imageUrl, speed, scale, depth, color, mask }: LogoProps) {
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
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Front face */}
      <mesh position={[0, 0, depth / 2 + 0.01]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial 
          map={texture}
          transparent={true}
          opacity={1}
          side={0}
          alphaTest={0.5}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      {/* Back face */}
      <mesh position={[0, 0, -depth / 2 - 0.01]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial 
          map={texture}
          transparent={true}
          opacity={1}
          side={1}
          alphaTest={0.5}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      {/* Middle connection */}
      <MiddleShape mask={mask} color={color} depth={depth} />
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
  color?: string;
  mask?: ImageData;
  onCanvasRef?: (canvas: HTMLCanvasElement) => void;
  isDownloading?: boolean;
}

export default function LogoScene({
  imageUrl,
  animationSpeed,
  backgroundColor,
  canvasWidth,
  canvasHeight,
  logoScale,
  depth,
  color,
  mask,
  onCanvasRef,
  isDownloading = false
}: LogoSceneProps) {
  const glRef = useRef<WebGLRenderer | null>(null);
  const groupRef = useRef<Group>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ThreePerspectiveCamera | null>(null);

  // Update background color when it changes
  useEffect(() => {
    if (glRef.current) {
      if (backgroundColor === 'transparent') {
        glRef.current.setClearColor(0x000000, 0); // Transparent black
      } else {
        glRef.current.setClearColor(backgroundColor);
      }
    }
  }, [backgroundColor]);

  // Reset rotation when starting a new recording
  useEffect(() => {
    if (groupRef.current && glRef.current && sceneRef.current && cameraRef.current) {
      groupRef.current.rotation.y = 0;
      // Force a re-render to ensure the rotation is applied
      glRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [isDownloading]);

  return (
    <Canvas 
      camera={{ position: [0, 0, 5], fov: 75 }}
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: backgroundColor === 'transparent' ? 'transparent' : backgroundColor,
        backgroundImage: backgroundColor === 'transparent' ? 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)' : 'none',
        backgroundSize: backgroundColor === 'transparent' ? '20px 20px' : 'auto',
        backgroundPosition: backgroundColor === 'transparent' ? '0 0, 0 10px, 10px -10px, -10px 0px' : '0 0'
      }}
      gl={{ 
        preserveDrawingBuffer: true, 
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      }}
      dpr={[1, 2]}
      onCreated={({ gl, scene, camera }) => {
        if (onCanvasRef) {
          onCanvasRef(gl.domElement);
        }
        glRef.current = gl;
        sceneRef.current = scene;
        cameraRef.current = camera as ThreePerspectiveCamera;
        // Set initial clear color
        if (backgroundColor === 'transparent') {
          gl.setClearColor(0x000000, 0); // Transparent black
        } else {
          gl.setClearColor(backgroundColor);
        }
      }}
    >
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <primitive object={new Group()} ref={groupRef}>
        <Logo 
          imageUrl={imageUrl}
          speed={animationSpeed}
          scale={logoScale}
          depth={depth}
          color={color}
          mask={mask}
        />
      </primitive>
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
} 
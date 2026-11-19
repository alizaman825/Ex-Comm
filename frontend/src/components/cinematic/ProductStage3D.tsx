"use client";

/**
 * The real three.js/R3F mount for a product image. Used ONLY where it is worth the cost: the single
 * hero image on the product detail page (ProductView). Dynamically imported with `ssr: false` and
 * mounted lazily (IntersectionObserver) by ProductVisual, which also owns the plain-<img> fallback
 * for reduced motion / no WebGL / low-end devices. Never imported by grid cards (ProductCard), so a
 * listing of dozens of products never runs more than zero WebGL contexts at once.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

interface Props {
  src: string;
  active: boolean;
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** The product photo as a two-layer card: a soft frosted backing plate, and the photo on a slightly
 * raised plane in front of it, so the stack reads as having real depth rather than a flat sticker. */
function Card({ src, pointerRef }: { src: string; pointerRef: RefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const rawTexture = useLoader(THREE.TextureLoader, src);
  // Clone rather than mutate the texture useLoader returns: colorSpace/anisotropy need setting once,
  // but the hook's own return value must stay untouched.
  const texture = useMemo(() => {
    const t = rawTexture.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [rawTexture]);
  useEffect(() => () => texture.dispose(), [texture]);

  const aspect = (texture.image?.width || 1) / (texture.image?.height || 1);
  const h = 3.1;
  const w = Math.min(h * aspect, 4.6);
  const wClamped = Math.max(w, h * 0.55);

  const current = useRef({ rx: 0, ry: 0 });

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const pointer = pointerRef.current;
    const targetRy = pointer.x * 0.5;
    const targetRx = -pointer.y * 0.35;
    current.current.rx += (targetRx - current.current.rx) * 0.08;
    current.current.ry += (targetRy - current.current.ry) * 0.08;
    g.rotation.x = current.current.rx + Math.sin(t * 0.5) * 0.02;
    g.rotation.y = current.current.ry + Math.sin(t * 0.35) * 0.03;
    g.position.y = Math.sin(t * 0.7) * 0.06;
  });

  return (
    <group ref={group}>
      {/* backing plate: frosted glass card, set back slightly for parallax depth */}
      <mesh position={[0, 0, -0.18]}>
        <planeGeometry args={[wClamped * 1.18, h * 1.18]} />
        <meshPhysicalMaterial color="#ffffff" transparent opacity={0.08} roughness={0.9} metalness={0} transmission={0.4} thickness={0.3} />
      </mesh>
      {/* the photo itself, raised in front, alpha-tested so the frame reads as the product's own silhouette */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[wClamped, h]} />
        <meshStandardMaterial map={texture} transparent alphaTest={0.02} roughness={0.35} metalness={0.05} envMapIntensity={0.9} />
      </mesh>
      {/* a faint rim light catcher behind the photo plane */}
      <mesh position={[0, 0, -0.05]} scale={[1.03, 1.03, 1]}>
        <planeGeometry args={[wClamped, h]} />
        <meshBasicMaterial color="#ffd9a8" transparent opacity={0.12} map={texture} alphaMap={texture} />
      </mesh>
    </group>
  );
}

function Scene({ src, active }: Props) {
  const pointer = useRef({ x: 0, y: 0 });
  const { size } = useThree();
  useEffect(() => {
    function onMove(e: PointerEvent) {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  // re-read size so the plane keeps a sensible scale across canvas resizes (noop use to satisfy lint)
  void size;
  return (
    <>
      <Environment />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <pointLight position={[-4, 2, 3]} intensity={10} color="#ffcf9e" />
      <pointLight position={[3, -2, -2]} intensity={6} color="#9ea8ff" />
      <Card src={src} pointerRef={pointer} />
      {!active && null}
    </>
  );
}

export default function ProductStage3D({ src, active }: Props) {
  const [error, setError] = useState(false);
  if (error) return null;
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 6.2], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onError={() => setError(true)}
      aria-hidden
    >
      <Scene src={src} active={active} />
    </Canvas>
  );
}

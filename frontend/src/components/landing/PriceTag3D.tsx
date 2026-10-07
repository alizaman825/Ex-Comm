"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { heroProgress } from "@/lib/motion";
import { formatPrice } from "@/lib/format";

interface Props {
  high: number;
  low: number;
  /** pause rendering while the hero is off screen */
  active: boolean;
}

/** Tag outline with a punched hole near the top. Units are scene units; the tag is about 2.2 x 3.2. */
function tagGeometry() {
  const w = 2.2;
  const h = 3.2;
  const r = 0.4;
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const hole = new THREE.Path();
  hole.absarc(0, h / 2 - 0.38, 0.17, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 8, curveSegments: 28 });
  g.translate(0, 0, -0.07);
  return g;
}

/** The face of the tag: label, the animated price and a down arrow, drawn on a canvas texture. */
function useFaceTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 704;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
    const state = { last: "" };
    const draw = (price: number) => {
      const text = formatPrice(Math.round(price / 10) * 10);
      if (text === state.last) return;
      state.last = text;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#17140F";
      ctx.textAlign = "center";
      ctx.font = `800 40px ${family}`;
      ctx.fillText("LOWEST PRICE", 256, 210);
      const [rs, ...num] = text.split(" ");
      ctx.font = `800 62px ${family}`;
      ctx.fillStyle = "#0B8A55";
      ctx.fillText(rs, 256, 330);
      ctx.fillStyle = "#17140F";
      let size = 112;
      ctx.font = `800 ${size}px ${family}`;
      while (ctx.measureText(num.join(" ")).width > 420 && size > 50) {
        size -= 4;
        ctx.font = `800 ${size}px ${family}`;
      }
      ctx.fillText(num.join(" "), 256, 450);
      ctx.fillStyle = "#0FA968";
      ctx.beginPath();
      ctx.moveTo(206, 520);
      ctx.lineTo(306, 520);
      ctx.lineTo(256, 580);
      ctx.closePath();
      ctx.fill();
      tex.needsUpdate = true;
    };
    return { tex, draw };
  }, []);
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
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

function Tag({ high, low }: { high: number; low: number }) {
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => tagGeometry(), []);
  const face = useFaceTexture();
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => face.tex.dispose(), [face]);

  useFrame(({ clock }) => {
    const p = heroProgress.value;
    const eased = 1 - Math.pow(1 - p, 2);
    face.draw(high - (high - low) * eased);
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.y = Math.sin(t * 0.6) * 0.45 + p * Math.PI * 2;
    g.rotation.x = -0.08 + Math.sin(t * 0.45) * 0.05 + p * 0.25;
    g.rotation.z = 0.1 - p * 0.2;
    g.position.y = Math.sin(t * 0.8) * 0.07;
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial color="#FFD84D" roughness={0.28} metalness={0.05} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={1.1} />
      </mesh>
      <mesh position={[0, 0.4, 0.152]}>
        <planeGeometry args={[1.9, 2.6]} />
        <meshBasicMaterial map={face.tex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.4, -0.152]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.9, 2.6]} />
        <meshBasicMaterial map={face.tex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.035, 16, 48]} />
        <meshPhysicalMaterial color="#17140F" roughness={0.3} clearcoat={1} />
      </mesh>
    </group>
  );
}

export default function PriceTag3D({ high, low, active }: Props) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 7.2], fov: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <Environment />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={12} color="#ffe9b0" />
      <Tag high={high} low={low} />
    </Canvas>
  );
}

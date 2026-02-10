"use client";

import React, {
  Suspense,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls, useTexture, Html } from "@react-three/drei";
import * as THREE from "three";
import type { MemberLocation } from "@/lib/member-locations";

const CAMERA_POS = new THREE.Vector3();

const SHARED_SPHERE_EARTH = new THREE.SphereGeometry(1, 48, 48);
const SHARED_SPHERE_MARKER_OUTER = new THREE.SphereGeometry(0.022, 8, 8);
const SHARED_SPHERE_MARKER_INNER = new THREE.SphereGeometry(0.012, 8, 8);
const DUMMY_OBJECT = new THREE.Object3D();

function latLonToPosition(
  latDeg: number,
  lonDeg: number,
  radius: number = 1
): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = -radius * Math.cos(lat) * Math.sin(lon);
  return [x, y, z];
}

class GlobeErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const STAR_COLORS = [
  [1.0, 0.98, 1.0],
  [0.9, 0.95, 1.0],
  [0.95, 0.97, 1.0],
  [1.0, 1.0, 0.9],
  [1.0, 0.95, 0.8],
  [1.0, 0.9, 0.7],
  [1.0, 0.85, 0.75],
  [1.0, 0.8, 0.8],
  [0.95, 0.85, 0.9],
] as const;

function Starfield() {
  const count = 5000;
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      let r: number, theta: number, phi: number;
      if (u < 0.35) {
        r = 72 + Math.random() * 55;
        theta = Math.random() * Math.PI * 2;
        phi = Math.PI * 0.4 + Math.random() * Math.PI * 0.5;
      } else if (u < 0.85) {
        r = 70 + Math.random() * 60;
        theta = Math.random() * Math.PI * 2;
        phi = Math.acos(2 * Math.random() - 1);
      } else {
        r = 75 + Math.random() * 55;
        theta = Math.random() * Math.PI * 2;
        phi =
          Math.random() < 0.5
            ? Math.acos(2 * Math.random() * 0.4 - 0.4)
            : Math.acos(1 - 2 * Math.random() * 0.4);
      }

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const colorIdx = Math.floor(Math.random() * STAR_COLORS.length);
      const [cr, cg, cb] = STAR_COLORS[colorIdx];
      const brightness = 0.7 + Math.random() * 0.35;
      col[i * 3] = cr * brightness;
      col[i * 3 + 1] = cg * brightness;
      col[i * 3 + 2] = cb * brightness;
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.08,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    []
  );

  return <points geometry={geometry} material={material} />;
}

function EarthFallback() {
  return (
    <mesh geometry={SHARED_SPHERE_EARTH}>
      <meshBasicMaterial color="#1a2a4e" />
    </mesh>
  );
}

function Earth() {
  const texture = useTexture("/textures/earth.jpg");
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 2;

  return (
    <mesh geometry={SHARED_SPHERE_EARTH}>
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

function MemberMarker({
  member,
  position,
  visible,
  onClick,
}: {
  member: MemberLocation;
  position: [number, number, number];
  visible: boolean;
  onClick: (member: MemberLocation) => void;
}) {
  if (!visible) return null;

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onClick(member);
    },
    [member, onClick]
  );

  const onPointerOver = useCallback(() => {
    document.body.style.cursor = "pointer";
  }, []);
  const onPointerOut = useCallback(() => {
    document.body.style.cursor = "default";
  }, []);

  return (
    <group
      position={position}
      onClick={handleClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <mesh geometry={SHARED_SPHERE_MARKER_OUTER}>
        <meshBasicMaterial
          color="#8e51ff"
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={SHARED_SPHERE_MARKER_INNER}>
        <meshBasicMaterial color="#ddbbff" />
      </mesh>
      <Html
        position={[0, 0.06, 0]}
        center
        distanceFactor={5}
        occlude={false}
        zIndexRange={[100, 0]}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          fontSize: "6px",
          color: "#fff",
          textShadow: "0 0 1px #000, 0 1px 3px #000",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <span className="rounded-md border border-violet-500/40 bg-black/80 px-2 py-1">
          {member.pseudo}
          {member.ville ? ` — ${member.ville}` : ""}
        </span>
      </Html>
    </group>
  );
}

function PixelRatioCap() {
  const { gl } = useThree();
  useEffect(() => {
    if (typeof window !== "undefined") {
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }, [gl]);
  return null;
}

function GlobeScene({
  members,
  onMemberClick,
}: {
  members: MemberLocation[];
  onMemberClick: (member: MemberLocation) => void;
}) {
  const { camera } = useThree();
  const positions = useMemo(
    () =>
      members.map((m) =>
        latLonToPosition(m.latitude, m.longitude, 1)
      ) as [number, number, number][],
    [members]
  );
  const [visible, setVisible] = useState<boolean[]>(() =>
    positions.map(() => true)
  );
  const prevRef = useRef<boolean[]>(positions.map(() => true));

  useFrame(() => {
    camera.getWorldPosition(CAMERA_POS);
    let changed = false;
    const next = positions.map((pos, i) => {
      const dot =
        pos[0] * CAMERA_POS.x + pos[1] * CAMERA_POS.y + pos[2] * CAMERA_POS.z;
      const v = dot > 0.08;
      if (v !== prevRef.current[i]) changed = true;
      return v;
    });
    prevRef.current = next;
    if (changed) setVisible(next);
  });

  return (
    <>
      <PixelRatioCap />
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 60, 140]} />
      <Starfield />
      <ambientLight intensity={0.5} />
      <directionalLight position={[8, 6, 5]} intensity={2} />
      <directionalLight position={[-4, -2, -3]} intensity={0.25} />
      <directionalLight position={[0, 0, 10]} intensity={0.5} />
      {members.map((member, i) => (
        <MemberMarker
          key={member.id ?? `${member.pseudo}-${member.ville}-${i}`}
          member={member}
          position={positions[i]}
          visible={visible[i]}
          onClick={onMemberClick}
        />
      ))}
      <GlobeErrorBoundary
        fallback={<EarthFallback />}
      >
        <Earth />
      </GlobeErrorBoundary>
      <OrbitControls
        enableZoom
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        autoRotate
        autoRotateSpeed={0.2}
      />
    </>
  );
}

export interface GlobeViewProps {
  members: MemberLocation[];
  className?: string;
  onMemberClick?: (member: MemberLocation) => void;
}

export function GlobeView({
  members,
  className = "",
  onMemberClick = () => {},
}: GlobeViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center bg-black ${className}`}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full bg-black ${className}`}>
      <Canvas
        className="h-full w-full bg-black"
        style={{ background: "#000" }}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "default",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 1);
          gl.debug.checkShaderErrors = false;
          gl.capabilities.maxTextureSize = Math.min(
            gl.capabilities.maxTextureSize,
            8192
          );
          const canvas = gl.domElement;
          canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
        }}
      >
        <Suspense
          fallback={
            <mesh>
              <sphereGeometry args={[1, 16, 16]} />
              <meshBasicMaterial color="#1a1a2e" wireframe />
            </mesh>
          }
        >
          <GlobeScene members={members} onMemberClick={onMemberClick} />
        </Suspense>
      </Canvas>
    </div>
  );
}

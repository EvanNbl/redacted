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

class GlobeErrorBoundary extends React.Component<{
  children: React.ReactNode;
  fallback: React.ReactNode;
}> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ── Starfield ───────────────────────────────────────────── */

const STAR_COLORS = [
  [1.0, 0.98, 1.0], [0.9, 0.95, 1.0], [0.95, 0.97, 1.0],
  [1.0, 1.0, 0.9], [1.0, 0.95, 0.8], [1.0, 0.9, 0.7],
] as const;

function Starfield() {
  const count = 4000;
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 70 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      const colorIdx = Math.floor(Math.random() * STAR_COLORS.length);
      const [cr, cg, cb] = STAR_COLORS[colorIdx];
      const b = 0.7 + Math.random() * 0.35;
      col[i * 3] = cr * b;
      col[i * 3 + 1] = cg * b;
      col[i * 3 + 2] = cb * b;
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

/* ── Earth ───────────────────────────────────────────────── */

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

/* ── Marker ──────────────────────────────────────────────── */

/** Single member marker on the globe. Label only on hover to avoid overlap. */
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
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const targetScale = useRef(1.0);

  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      onClick(member);
    },
    [member, onClick]
  );

  const onPointerOver = useCallback(() => {
    setHovered(true);
    targetScale.current = 1.3;
    document.body.style.cursor = "pointer";
  }, []);
  const onPointerOut = useCallback(() => {
    setHovered(false);
    targetScale.current = 1.0;
    document.body.style.cursor = "default";
  }, []);

  // Smooth scale animation
  useFrame(() => {
    if (groupRef.current) {
      const currentScale = groupRef.current.scale.x;
      const diff = targetScale.current - currentScale;
      if (Math.abs(diff) > 0.01) {
        groupRef.current.scale.setScalar(
          currentScale + diff * 0.15 // Smooth interpolation
        );
      } else {
        groupRef.current.scale.setScalar(targetScale.current);
      }
    }
  });

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={handleClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Outer glow shadow - matches box-shadow from flat map */}
      <mesh>
        <sphereGeometry args={[0.008, 16, 16]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>
      {/* Outer ring - matches the 2px border from flat map */}
      <mesh>
        <sphereGeometry args={[0.0065, 16, 16]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.25}
          depthWrite={false}
        />
      </mesh>
      {/* Main dot with gradient effect - inner part (darker purple) */}
      <mesh>
        <sphereGeometry args={[0.005, 16, 16]} />
        <meshBasicMaterial color="#6d28d9" />
      </mesh>
      {/* Middle gradient layer */}
      <mesh>
        <sphereGeometry args={[0.0045, 16, 16]} />
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Inner highlight - matches radial gradient highlight */}
      <mesh>
        <sphereGeometry args={[0.003, 16, 16]} />
        <meshBasicMaterial color="#c4b5fd" />
      </mesh>
      {/* Nom affiché en permanence */}
      <Html
        position={[0, 0.02, 0]}
        center
        distanceFactor={2.5}
        occlude={false}
        zIndexRange={[100, 0]}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <div className="text-[5px] font-medium text-white">
          {member.pseudo}
        </div>
      </Html>
    </group>
  );
}

/* ── Scene ───────────────────────────────────────────────── */

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
  onMapClick,
  focusMemberId,
}: {
  members: MemberLocation[];
  onMemberClick: (member: MemberLocation) => void;
  onMapClick?: () => void;
  focusMemberId?: string | null;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const prevFocusMemberIdRef = useRef<string | null | undefined>(null);
  const animationTargetRef = useRef<{
    cameraPos: THREE.Vector3;
    target: THREE.Vector3;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    progress: number;
  } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
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

    // Animate camera to focus target
    if (animationTargetRef.current && controlsRef.current) {
      const anim = animationTargetRef.current;
      anim.progress += 0.05;
      
      if (anim.progress >= 1) {
        camera.position.copy(anim.cameraPos);
        controlsRef.current.target.copy(anim.target);
        controlsRef.current.update();
        animationTargetRef.current = null;
        setIsAnimating(false);
      } else {
        camera.position.lerpVectors(anim.startPos, anim.cameraPos, anim.progress);
        controlsRef.current.target.lerpVectors(anim.startTarget, anim.target, anim.progress);
        controlsRef.current.update();
      }
    }
  });

  // Click on the globe (earth mesh) itself → close panel
  const handleEarthClick = useCallback(() => {
    onMapClick?.();
  }, [onMapClick]);

  // Focus on specific member when focusMemberId changes
  useEffect(() => {
    if (!controlsRef.current) return;

    // Si focusMemberId n'a pas changé, ne rien faire
    if (focusMemberId === prevFocusMemberIdRef.current) {
      return;
    }

    // Si focusMemberId devient null, remettre à la position par défaut
    if (!focusMemberId) {
      const defaultCameraPos = new THREE.Vector3(0, 0, 5);
      const defaultTarget = new THREE.Vector3(0, 0, 0);
      
      setIsAnimating(true);
      animationTargetRef.current = {
        cameraPos: defaultCameraPos,
        target: defaultTarget,
        startPos: camera.position.clone(),
        startTarget: controlsRef.current.target.clone(),
        progress: 0,
      };
      prevFocusMemberIdRef.current = focusMemberId;
      return;
    }

    // Sinon, focus sur le membre sélectionné
    const member = members.find((m) => m.id === focusMemberId);
    if (member && controlsRef.current) {
      // Position du membre sur la sphère (rayon 1)
      const [x, y, z] = latLonToPosition(member.latitude, member.longitude, 1);
      const target = new THREE.Vector3(x, y, z);
      
      // Calculer la position de la caméra pour regarder le point
      // On veut que la caméra soit à une distance confortable et regarde le point
      const direction = target.clone().normalize();
      const distance = 2.5;
      const cameraPos = direction.multiplyScalar(distance);
      
      // Démarrer l'animation
      setIsAnimating(true);
      animationTargetRef.current = {
        cameraPos,
        target,
        startPos: camera.position.clone(),
        startTarget: controlsRef.current.target.clone(),
        progress: 0,
      };
    }
    prevFocusMemberIdRef.current = focusMemberId;
  }, [focusMemberId, members, camera]);

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

      {/* Clickable earth sphere */}
      <GlobeErrorBoundary fallback={<EarthFallback />}>
        <group onClick={handleEarthClick}>
          <Earth />
        </group>
      </GlobeErrorBoundary>

      <OrbitControls
        ref={controlsRef}
        enableZoom
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        autoRotate={!isAnimating}
        autoRotateSpeed={0.2}
      />
    </>
  );
}

/* ── Export ───────────────────────────────────────────────── */

export interface GlobeViewProps {
  members: MemberLocation[];
  className?: string;
  onMemberClick?: (member: MemberLocation) => void;
  onMapClick?: () => void;
  focusMemberId?: string | null;
}

export function GlobeView({
  members,
  className = "",
  onMemberClick = () => {},
  onMapClick,
  focusMemberId,
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
          canvas.addEventListener("webglcontextlost", (e) =>
            e.preventDefault()
          );
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
          <GlobeScene
            members={members}
            onMemberClick={onMemberClick}
            onMapClick={onMapClick}
            focusMemberId={focusMemberId}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

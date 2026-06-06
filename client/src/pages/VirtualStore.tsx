import { Suspense, useRef, useMemo, useState } from "react";
import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { useLocation } from "wouter";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { parseCategories } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────
const CASE_W = 1.5;
const CASE_H = 1.7;
const CASE_D = 0.7;
const CASE_GAP = 0.15;
const COL_STEP = CASE_W + CASE_GAP;
const ROW_Y = [0.95, 2.75];          // 2 rows per wall
const WALL_X = 3.3;                  // half corridor width
const CORRIDOR_H = 4.8;
const LIGHT_STEP = 3.5;

// ─── Category colours ────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  "香港硬幣": "#f59e0b", "中國硬幣": "#ef4444", "外國硬幣": "#3b82f6",
  "紀念幣": "#8b5cf6", "銀幣": "#94a3b8", "金幣": "#eab308",
  "紙幣": "#10b981", "古錢": "#f97316",
};
function catColor(c: string) { return CAT_COLORS[c.trim()] ?? "#94a3b8"; }

// ─── Distribute merchants into left/right walls ───────────────
function distributeMerchants(merchants: any[]) {
  // Each column holds 4 slots: leftLow, leftHigh, rightLow, rightHigh
  const cols: Array<[any?, any?, any?, any?]> = [];
  let i = 0;
  while (i < merchants.length) {
    cols.push([merchants[i], merchants[i + 1], merchants[i + 2], merchants[i + 3]]);
    i += 4;
  }
  return cols;
}

// ─── Floor ────────────────────────────────────────────────────
function Floor({ length }: { length: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -length / 2]} receiveShadow>
      <planeGeometry args={[WALL_X * 2 + 2, length + 4]} />
      <meshStandardMaterial color="#1a1108" roughness={0.3} metalness={0.4} />
    </mesh>
  );
}

// ─── Ceiling ─────────────────────────────────────────────────
function Ceiling({ length }: { length: number }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CORRIDOR_H, -length / 2]}>
      <planeGeometry args={[WALL_X * 2 + 2, length + 4]} />
      <meshStandardMaterial color="#0f0b06" roughness={1} />
    </mesh>
  );
}

// ─── Side wall ───────────────────────────────────────────────
function SideWall({ x, length }: { x: number; length: number }) {
  return (
    <mesh position={[x, CORRIDOR_H / 2, -length / 2]}>
      <boxGeometry args={[0.12, CORRIDOR_H, length + 4]} />
      <meshStandardMaterial color="#1a1108" roughness={0.9} />
    </mesh>
  );
}

// ─── Back wall ────────────────────────────────────────────────
function BackWall({ z }: { z: number }) {
  return (
    <mesh position={[0, CORRIDOR_H / 2, z]}>
      <boxGeometry args={[WALL_X * 2 + 2, CORRIDOR_H, 0.12]} />
      <meshStandardMaterial color="#120d06" roughness={0.95} />
    </mesh>
  );
}

// ─── Ceiling strip lights ─────────────────────────────────────
function CeilingLights({ length }: { length: number }) {
  const lights: React.ReactElement[] = [];
  const numLights = Math.ceil(length / LIGHT_STEP) + 1;
  for (let i = 0; i < numLights; i++) {
    const z = -(i * LIGHT_STEP + 1);
    lights.push(
      <group key={i} position={[0, CORRIDOR_H - 0.05, z]}>
        {/* Light strip mesh */}
        <mesh>
          <boxGeometry args={[WALL_X * 1.2, 0.05, 0.6]} />
          <meshStandardMaterial color="#fffde7" emissive="#fffde7" emissiveIntensity={1.8} />
        </mesh>
        {/* Actual point light */}
        <pointLight
          color="#fff5d6"
          intensity={18}
          distance={8}
          decay={2}
          position={[0, -0.1, 0]}
        />
      </group>
    );
  }
  return <>{lights}</>;
}

// ─── Shelf board behind a row of cases ───────────────────────
function ShelfBoard({ y, colCount, side }: { y: number; colCount: number; side: number }) {
  const width = colCount * COL_STEP + 0.2;
  const xOff = side === -1 ? -WALL_X + width / 2 - 0.1 : WALL_X - width / 2 + 0.1;
  return (
    <group>
      {/* Back panel */}
      <mesh position={[xOff, y, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[width, CASE_H + 0.06, 0.08]} />
        <meshStandardMaterial color="#2a1a0e" roughness={0.8} />
      </mesh>
      {/* Bottom shelf board */}
      <mesh position={[xOff, y - CASE_H / 2 - 0.03, 0.38]}>
        <boxGeometry args={[width, 0.06, 0.84]} />
        <meshStandardMaterial color="#3d2410" roughness={0.7} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ─── Merchant card (rendered as HTML in 3D space) ─────────────
function MerchantCard({
  merchant,
  onClick,
  hovered,
}: {
  merchant: any;
  onClick: () => void;
  hovered: boolean;
}) {
  const cats = useMemo(() => parseCategories(merchant.categories ?? "").slice(0, 2), [merchant.categories]);
  const initials = (merchant.merchantName ?? "?").slice(0, 2);
  const cc = catColor(cats[0] ?? "");

  return (
    <Html
      transform
      occlude={false}
      scale={0.115}
      position={[0, 0, 0.32]}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          width: 110,
          padding: "8px 6px 6px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
          background: hovered ? "rgba(255,240,180,0.12)" : "rgba(0,0,0,0)",
          transition: "background 0.2s",
          borderRadius: 6,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onClick}
      >
        {/* Icon */}
        <div style={{
          width: 52, height: 52,
          borderRadius: 10,
          overflow: "hidden",
          border: `2px solid ${cc}88`,
          boxShadow: hovered ? `0 0 10px ${cc}88` : `0 2px 6px rgba(0,0,0,0.6)`,
          background: "#111",
          flexShrink: 0,
          transition: "box-shadow 0.2s",
        }}>
          {merchant.merchantIcon ? (
            <img src={merchant.merchantIcon} alt={merchant.merchantName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${cc}44, ${cc}22)`,
              fontSize: 20, fontWeight: 700, color: cc,
            }}>{initials}</div>
          )}
        </div>
        {/* Name */}
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: hovered ? "#fff" : "rgba(255,255,255,0.88)",
          textAlign: "center",
          lineHeight: 1.35,
          maxWidth: 100,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          transition: "color 0.2s",
        }}>{merchant.merchantName}</div>
        {/* Categories */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center" }}>
          {cats.map((c: string) => (
            <span key={c} style={{
              fontSize: 8.5, fontWeight: 600,
              color: catColor(c),
              background: `${catColor(c)}22`,
              border: `1px solid ${catColor(c)}55`,
              borderRadius: 4, padding: "1px 4px",
              whiteSpace: "nowrap",
            }}>{c}</span>
          ))}
        </div>
        {/* Enter hint */}
        {hovered && (
          <div style={{
            fontSize: 9, color: "rgba(255,220,80,0.9)",
            fontWeight: 600, marginTop: 2,
            letterSpacing: "0.04em",
          }}>點擊進入 →</div>
        )}
      </div>
    </Html>
  );
}

// ─── Single glass display case ────────────────────────────────
function DisplayCase({
  position,
  merchant,
  navigate,
  index,
}: {
  position: [number, number, number];
  merchant: any;
  navigate: (path: string) => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshPhysicalMaterial;
      const target = hovered ? 0.28 : 0.12;
      mat.opacity += (target - mat.opacity) * 0.12;
    }
    if (frameRef.current) {
      const mat = frameRef.current.material as THREE.MeshStandardMaterial;
      const targetEmit = hovered ? 0.6 : 0;
      mat.emissiveIntensity += (targetEmit - mat.emissiveIntensity) * 0.1;
    }
  });

  const cats = useMemo(() => parseCategories(merchant.categories ?? ""), [merchant.categories]);
  const cc = catColor(cats[0] ?? "");

  return (
    <group
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
      onClick={(e) => { e.stopPropagation(); navigate(`/merchants/${merchant.userId}`); }}
    >
      {/* Glass front panel */}
      <mesh ref={meshRef} position={[0, 0, CASE_D / 2 - 0.01]}>
        <boxGeometry args={[CASE_W - 0.06, CASE_H - 0.06, 0.04]} />
        <meshPhysicalMaterial
          color={hovered ? "#fffde7" : "#e0f0ff"}
          transparent
          opacity={0.12}
          roughness={0}
          metalness={0}
          transmission={0.92}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Aluminium frame */}
      {/* Top bar */}
      <mesh ref={frameRef} position={[0, CASE_H / 2, 0]}>
        <boxGeometry args={[CASE_W, 0.04, CASE_D]} />
        <meshStandardMaterial
          color="#7a6050"
          roughness={0.4}
          metalness={0.7}
          emissive={new THREE.Color(cc)}
          emissiveIntensity={0}
        />
      </mesh>
      {/* Bottom bar */}
      <mesh position={[0, -CASE_H / 2, 0]}>
        <boxGeometry args={[CASE_W, 0.04, CASE_D]} />
        <meshStandardMaterial color="#7a6050" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Left bar */}
      <mesh position={[-CASE_W / 2, 0, 0]}>
        <boxGeometry args={[0.04, CASE_H, CASE_D]} />
        <meshStandardMaterial color="#7a6050" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Right bar */}
      <mesh position={[CASE_W / 2, 0, 0]}>
        <boxGeometry args={[0.04, CASE_H, CASE_D]} />
        <meshStandardMaterial color="#7a6050" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Internal shelf divider */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[CASE_W - 0.1, 0.03, CASE_D - 0.1]} />
        <meshStandardMaterial color="#4a3020" roughness={0.7} />
      </mesh>

      {/* Cell number plate */}
      <Html transform occlude={false} scale={0.08} position={[-CASE_W / 2 + 0.18, CASE_H / 2 - 0.08, CASE_D / 2 + 0.02]}>
        <div style={{
          background: "#f5c842",
          color: "#1a1108",
          fontWeight: 700,
          fontSize: 11,
          padding: "1px 5px",
          borderRadius: 3,
          fontFamily: "monospace",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}>
          #{String(index + 1).padStart(2, "0")}
        </div>
      </Html>

      {/* Merchant content */}
      <MerchantCard merchant={merchant} onClick={() => navigate(`/merchants/${merchant.userId}`)} hovered={hovered} />
    </group>
  );
}

// ─── Full store scene ─────────────────────────────────────────
function StoreScene({ merchants, navigate }: { merchants: any[]; navigate: (p: string) => void }) {
  const cols = useMemo(() => distributeMerchants(merchants), [merchants]);
  const storeLen = Math.max(8, cols.length * COL_STEP + 3);
  const backZ = -(storeLen + 1.5);

  const controlsRef = useRef<any>(null);

  return (
    <>
      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 1.7, storeLen * 0.3]} fov={70} near={0.1} far={100} />

      {/* Controls */}
      <OrbitControls
        ref={controlsRef}
        target={[0, 1.7, -(storeLen * 0.3)]}
        minDistance={1.5}
        maxDistance={storeLen * 0.7}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI * 0.72}
        enablePan={true}
        panSpeed={0.6}
        rotateSpeed={0.55}
        zoomSpeed={0.8}
        enableDamping
        dampingFactor={0.08}
      />

      {/* Ambient & directional */}
      <ambientLight color="#3a2510" intensity={1.5} />
      <directionalLight color="#fff8e7" intensity={1.2} position={[0, 8, 4]} />

      {/* Environment */}
      <Floor length={storeLen} />
      <Ceiling length={storeLen} />
      <SideWall x={-(WALL_X + 0.45)} length={storeLen} />
      <SideWall x={WALL_X + 0.45} length={storeLen} />
      <BackWall z={backZ} />
      <CeilingLights length={storeLen} />

      {/* Entrance arch */}
      <mesh position={[0, CORRIDOR_H / 2, 1.5]}>
        <boxGeometry args={[WALL_X * 2 + 2, CORRIDOR_H, 0.1]} />
        <meshStandardMaterial color="#2a1a0e" roughness={0.9} />
      </mesh>
      {/* Entrance opening cut - just omit center, make two pillars */}
      {[-WALL_X - 0.15, WALL_X + 0.15].map((px, i) => (
        <mesh key={i} position={[px * 0.5 + (i === 0 ? -(WALL_X * 0.5 + 0.5) : WALL_X * 0.5 + 0.5), CORRIDOR_H / 2, 1.5]}>
          <boxGeometry args={[0.35, CORRIDOR_H, 0.25]} />
          <meshStandardMaterial color="#3d2410" roughness={0.7} metalness={0.15} />
        </mesh>
      ))}

      {/* Store sign */}
      <Html transform occlude={false} scale={0.22} position={[0, CORRIDOR_H - 0.3, 1.4]}>
        <div style={{
          background: "linear-gradient(135deg, #b8860b, #8b6914, #d4a017)",
          color: "#fff8e0",
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: "0.08em",
          padding: "6px 18px",
          borderRadius: 6,
          border: "1px solid rgba(255,220,80,0.4)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
          textShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}>
          大BB錢幣格仔鋪
        </div>
      </Html>

      {/* Cases */}
      {cols.map((col, colIdx) => {
        const zPos = -(colIdx * COL_STEP + 2.2);
        return (
          <group key={colIdx}>
            {/* Shelf boards */}
            {ROW_Y.map((ry) => (
              <group key={ry}>
                {col[0] || col[1] ? <ShelfBoard y={ry} colCount={1} side={-1} /> : null}
                {col[2] || col[3] ? <ShelfBoard y={ry} colCount={1} side={1} /> : null}
              </group>
            ))}

            {/* Left wall, low row */}
            {col[0] && (
              <DisplayCase
                position={[-WALL_X + CASE_D / 2 + 0.06, ROW_Y[0], zPos]}
                merchant={col[0]}
                navigate={navigate}
                index={colIdx * 4 + 0}
              />
            )}
            {/* Left wall, high row */}
            {col[1] && (
              <DisplayCase
                position={[-WALL_X + CASE_D / 2 + 0.06, ROW_Y[1], zPos]}
                merchant={col[1]}
                navigate={navigate}
                index={colIdx * 4 + 1}
              />
            )}
            {/* Right wall, low row — flip Z-facing */}
            {col[2] && (
              <group position={[WALL_X - CASE_D / 2 - 0.06, ROW_Y[0], zPos]} rotation={[0, Math.PI, 0]}>
                <DisplayCase
                  position={[0, 0, 0]}
                  merchant={col[2]}
                  navigate={navigate}
                  index={colIdx * 4 + 2}
                />
              </group>
            )}
            {/* Right wall, high row */}
            {col[3] && (
              <group position={[WALL_X - CASE_D / 2 - 0.06, ROW_Y[1], zPos]} rotation={[0, Math.PI, 0]}>
                <DisplayCase
                  position={[0, 0, 0]}
                  merchant={col[3]}
                  navigate={navigate}
                  index={colIdx * 4 + 3}
                />
              </group>
            )}
          </group>
        );
      })}

      {/* End-of-corridor display board */}
      <Html transform occlude={false} scale={0.18} position={[0, 1.8, backZ + 0.25]}>
        <div style={{
          padding: "10px 16px",
          background: "rgba(0,0,0,0.7)",
          border: "1px solid rgba(255,200,80,0.25)",
          borderRadius: 8,
          color: "rgba(255,220,100,0.6)",
          fontSize: 11,
          textAlign: "center",
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: 1.6,
        }}>
          共 {merchants.length} 個格主<br />
          <span style={{ fontSize: 9, opacity: 0.7 }}>拖動視角探索 / 點擊格仔進入</span>
        </div>
      </Html>
    </>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────
function LoadingScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.7, 4]} fov={70} />
      <ambientLight intensity={0.5} />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 20]} />
        <meshStandardMaterial color="#1a1108" />
      </mesh>
      <Html center>
        <div style={{
          color: "rgba(255,220,80,0.8)",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span style={{
            display: "inline-block",
            width: 20, height: 20,
            border: "2px solid rgba(255,200,80,0.3)",
            borderTopColor: "#f59e0b",
            borderRadius: "50%",
            animation: "vspin 0.8s linear infinite",
          }} />
          載入格仔鋪...
        </div>
      </Html>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────
export default function VirtualStore() {
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();
  const [, navigate] = useLocation();
  const [key, setKey] = useState(0);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#0d0705", overflow: "hidden" }}>
      <Header />

      {/* Top bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px 6px",
        background: "rgba(0,0,0,0.6)",
        borderBottom: "1px solid rgba(255,200,80,0.1)",
        flexShrink: 0,
        zIndex: 10,
      }}>
        <button
          onClick={() => navigate("/merchants")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            color: "rgba(255,255,255,0.55)", fontSize: 12,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <ChevronLeft style={{ width: 14, height: 14 }} />
          返回商戶列表
        </button>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: "rgba(255,220,80,0.9)",
          letterSpacing: "0.05em",
        }}>
          🏪 虛擬格仔鋪
        </div>
        <button
          onClick={() => setKey(k => k + 1)}
          title="重設視角"
          style={{
            display: "flex", alignItems: "center", gap: 4,
            color: "rgba(255,255,255,0.4)", fontSize: 11,
            background: "none", border: "none", cursor: "pointer", padding: "4px 6px",
          }}
        >
          <RotateCcw style={{ width: 13, height: 13 }} />
          重設
        </button>
      </div>

      {/* Instruction hint */}
      <div style={{
        position: "absolute",
        bottom: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,200,80,0.2)",
        borderRadius: 20,
        padding: "5px 14px",
        fontSize: 11,
        color: "rgba(255,220,100,0.7)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}>
        拖動旋轉視角 · 捏合縮放 · 點格仔進入商戶
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <Canvas
          key={key}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false }}
          style={{ width: "100%", height: "100%" }}
          onCreated={({ gl }) => {
            gl.setClearColor(new THREE.Color("#0d0705"));
          }}
        >
          <Suspense fallback={<LoadingScene />}>
            {!isLoading && merchants.length > 0 ? (
              <StoreScene merchants={merchants} navigate={navigate} />
            ) : (
              <LoadingScene />
            )}
          </Suspense>
        </Canvas>
      </div>

      <style>{`
        @keyframes vspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

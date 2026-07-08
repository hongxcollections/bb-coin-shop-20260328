import React, { Suspense, useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, ArrowLeft, LogOut } from "lucide-react";
import { parseCategories } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
type SceneView =
  | { mode: "corridor"; slot: number }
  | { mode: "entering"; merchant: any }
  | { mode: "shop"; merchant: any };

// ─── Constants ────────────────────────────────────────────────
const CORRIDOR_W = 3.4;   // half-width of corridor
const SHOP_SLOT_Z = 7;    // spacing between shop slots
const CORRIDOR_H = 4.2;

// Category → display colour + emoji
const CAT_INFO: Record<string, { color: string; emoji: string }> = {
  "香港硬幣": { color: "#f59e0b", emoji: "🪙" },
  "中國硬幣": { color: "#ef4444", emoji: "🪙" },
  "外國硬幣": { color: "#3b82f6", emoji: "🌍" },
  "紀念幣":   { color: "#8b5cf6", emoji: "🏅" },
  "銀幣":     { color: "#94a3b8", emoji: "⚪" },
  "金幣":     { color: "#eab308", emoji: "🥇" },
  "紙幣":     { color: "#10b981", emoji: "💵" },
  "古錢":     { color: "#f97316", emoji: "⚱️" },
  "CardZx":  { color: "#e11d48", emoji: "🃏" },
};
function catInfo(c: string) { return CAT_INFO[c.trim()] ?? { color: "#94a3b8", emoji: "💎" }; }

// ─── Animated entry arrow ─────────────────────────────────────
function EntryArrow({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2.2) * 0.12;
  });
  return (
    <group ref={ref} position={position}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.18, 0.38, 8]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// ─── Floor tile pattern ───────────────────────────────────────
function CorridorFloor({ length }: { length: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -(length / 2 - SHOP_SLOT_Z * 0.5)]}>
      <planeGeometry args={[CORRIDOR_W * 2, length + 6]} />
      <meshStandardMaterial color="#ddd5c5" roughness={0.18} metalness={0.22} />
    </mesh>
  );
}

// ─── Corridor ceiling ─────────────────────────────────────────
function CorridorCeiling({ length }: { length: number }) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CORRIDOR_H, -(length / 2 - SHOP_SLOT_Z * 0.5)]}>
        <planeGeometry args={[CORRIDOR_W * 2 + 6, length + 6]} />
        <meshStandardMaterial color="#f5f0e8" roughness={1} />
      </mesh>
      {/* Track lights */}
      {Array.from({ length: Math.ceil(length / 3.5) }).map((_, i) => {
        const z = -(i * 3.5 + 0.5);
        return (
          <group key={i} position={[0, CORRIDOR_H - 0.08, z]}>
            <mesh>
              <boxGeometry args={[5, 0.06, 0.3]} />
              <meshStandardMaterial color="#fffde4" emissive="#fffde4" emissiveIntensity={1.5} />
            </mesh>
            <pointLight color="#fff8e0" intensity={12} distance={7} decay={2} position={[0, -0.1, 0]} />
          </group>
        );
      })}
    </>
  );
}

// ─── Shop front (storefront in corridor wall) ─────────────────
function ShopFront({
  merchant,
  side,
  zPos,
  onEnter,
}: {
  merchant: any;
  side: -1 | 1;    // -1 = left wall, +1 = right wall
  zPos: number;
  onEnter: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cats = useMemo(() => parseCategories(merchant.categories ?? "").slice(0, 3), [merchant.categories]);
  const firstCat = catInfo(cats[0] ?? "");
  const shopColor = firstCat.color;
  const SHOP_W = 5.2;
  const doorW = 1.8;
  const doorH = 2.8;
  const xPos = side * (CORRIDOR_W + SHOP_W / 2 - 0.3);

  return (
    <group position={[xPos, 0, zPos]}>
      {/* Back wall of storefront (facade) */}
      <mesh position={[0, CORRIDOR_H / 2, 0]}>
        <boxGeometry args={[SHOP_W, CORRIDOR_H, 0.12]} />
        <meshStandardMaterial color="#e8dfd0" roughness={0.9} />
      </mesh>

      {/* Sign fascia (above door) */}
      <mesh position={[0, doorH + 0.55, 0.08]}>
        <boxGeometry args={[SHOP_W - 0.1, 1.05, 0.1]} />
        <meshStandardMaterial color={shopColor} roughness={0.4} metalness={0.3}
          emissive={new THREE.Color(shopColor)} emissiveIntensity={0.35} />
      </mesh>

      {/* Shop name on sign */}
      <Html transform occlude={false} scale={0.095}
        position={[0, doorH + 0.52, 0.2]}>
        <div style={{
          width: 460, textAlign: "center",
          color: "#fff", fontWeight: 800, fontSize: 22,
          textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          letterSpacing: "0.06em",
          pointerEvents: "none", userSelect: "none",
        }}>
          {merchant.merchantName}
        </div>
      </Html>

      {/* Glass side panels (flanking door) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (doorW / 2 + (SHOP_W - doorW) / 4), doorH / 2, 0.06]}>
          <boxGeometry args={[(SHOP_W - doorW) / 2 - 0.1, doorH, 0.04]} />
          <meshPhysicalMaterial color="#d0e8f0" transparent opacity={0.35}
            roughness={0} transmission={0.7} thickness={0.2} />
        </mesh>
      ))}

      {/* Door frame */}
      {/* Top bar */}
      <mesh position={[0, doorH + 0.06, 0.07]}>
        <boxGeometry args={[doorW + 0.18, 0.12, 0.14]} />
        <meshStandardMaterial color="#4a3020" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Side bars */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (doorW / 2 + 0.06), doorH / 2, 0.07]}>
          <boxGeometry args={[0.12, doorH + 0.12, 0.14]} />
          <meshStandardMaterial color="#4a3020" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Glass door (interactive) */}
      <mesh
        position={[0, doorH / 2, 0.1]}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = "default"; }}
        onClick={(e) => { e.stopPropagation(); onEnter(); }}
      >
        <boxGeometry args={[doorW - 0.04, doorH - 0.04, 0.04]} />
        <meshPhysicalMaterial
          color={hovered ? "#a0d8ef" : "#c8e8f8"}
          transparent opacity={hovered ? 0.55 : 0.35}
          roughness={0} transmission={0.85} thickness={0.3}
        />
      </mesh>

      {/* Arrow indicator above door */}
      <EntryArrow position={[0, doorH + 1.15, 0.15]} />

      {/* "進入" text */}
      <Html transform occlude={false} scale={0.07} position={[0, doorH / 2 - 0.35, 0.2]}>
        <div style={{
          textAlign: "center", color: hovered ? "#f59e0b" : "rgba(80,60,40,0.7)",
          fontWeight: 700, fontSize: 18, letterSpacing: "0.1em",
          pointerEvents: "none", userSelect: "none",
          transition: "color 0.2s",
          textShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}>
          {hovered ? "點擊進入" : "歡迎光臨"}
        </div>
      </Html>

      {/* Category tags in glass panel */}
      <Html transform occlude={false} scale={0.07} position={[side * -1.4, doorH / 2, 0.15]}>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, pointerEvents: "none", userSelect: "none" }}>
          {cats.map((c: string) => {
            const ci = catInfo(c);
            return (
              <div key={c} style={{
                background: `${ci.color}dd`,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                padding: "3px 8px",
                borderRadius: 6,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}>{ci.emoji} {c}</div>
            );
          })}
        </div>
      </Html>

      {/* Merchant icon in window display */}
      {merchant.merchantIcon && (
        <Html transform occlude={false} scale={0.09} position={[side * 1.35, 0.9, 0.15]}>
          <img src={merchant.merchantIcon} alt=""
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover",
              border: "2px solid rgba(255,255,255,0.8)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              pointerEvents: "none", userSelect: "none",
            }} />
        </Html>
      )}
    </group>
  );
}

// ─── Staff figure (inside shop) ───────────────────────────────
function StaffFigure({ position, emoji = "👩‍💼", name = "歡迎光臨！" }: { position: [number, number, number]; emoji?: string; name?: string }) {
  return (
    <Html transform occlude={false} scale={0.13} position={position} style={{ pointerEvents: "none" }}>
      <div style={{ textAlign: "center", userSelect: "none" }}>
        <div style={{
          fontSize: 64, lineHeight: 1, marginBottom: 2,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
        }}>{emoji}</div>
        <div style={{
          background: "rgba(255,255,255,0.92)",
          border: "1.5px solid rgba(200,180,150,0.6)",
          borderRadius: 10,
          padding: "4px 10px",
          fontSize: 12, fontWeight: 600,
          color: "#3a2810",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
        }}>{name}</div>
      </div>
    </Html>
  );
}

// ─── Product display on shop back wall ────────────────────────
function ProductWall({ merchant }: { merchant: any }) {
  const cats = useMemo(() => parseCategories(merchant.categories ?? ""), [merchant.categories]);
  // Product tiles – based on categories + generic items
  const tiles = useMemo(() => {
    const base = [
      ...cats.map((c: string) => ({ label: c, ...catInfo(c) })),
      { label: "評級幣", color: "#6366f1", emoji: "🏆" },
      { label: "精選收藏", color: "#06b6d4", emoji: "💎" },
      { label: "套幣", color: "#84cc16", emoji: "📦" },
      { label: "限量版", color: "#ec4899", emoji: "⭐" },
    ].slice(0, 8);
    return base;
  }, [cats]);

  return (
    <Html transform occlude={false} scale={0.155} position={[0, 2.1, 0]} style={{ pointerEvents: "none" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        width: 360,
      }}>
        {tiles.map((t, i) => (
          <div key={i} style={{
            background: `linear-gradient(135deg, ${t.color}dd, ${t.color}88)`,
            borderRadius: 10,
            padding: "10px 6px 8px",
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <div style={{ fontSize: 24, lineHeight: 1, marginBottom: 4 }}>{t.emoji}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.4)", lineHeight: 1.3 }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>
    </Html>
  );
}

// ─── Shop Interior Scene ──────────────────────────────────────
function ShopInteriorScene({ merchant }: { merchant: any }) {
  const cats = useMemo(() => parseCategories(merchant.categories ?? ""), [merchant.categories]);
  const accentColor = catInfo(cats[0] ?? "").color;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.8, 4.5]} fov={65} near={0.1} far={60} />
      <OrbitControls
        target={[0, 1.5, 0]}
        minDistance={2} maxDistance={6}
        minPolarAngle={0.25} maxPolarAngle={Math.PI * 0.68}
        enablePan={false}
        rotateSpeed={0.45}
        enableDamping dampingFactor={0.08}
      />

      {/* Lighting */}
      <ambientLight color="#fff8f0" intensity={2.2} />
      <pointLight color="#fff5e0" intensity={20} distance={12} decay={2} position={[0, 4.5, 0]} />
      <pointLight color={accentColor} intensity={8} distance={6} decay={2} position={[0, 3, -3]} />

      {/* Floor — warm wood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c49a6c" roughness={0.5} metalness={0.05} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 2.5, -4.8]}>
        <boxGeometry args={[10, 5.5, 0.12]} />
        <meshStandardMaterial color="#f5ede0" roughness={0.95} />
      </mesh>

      {/* Side walls */}
      {[-4.8, 4.8].map((x, i) => (
        <mesh key={i} position={[x, 2.5, -2]}>
          <boxGeometry args={[0.12, 5.5, 9.6]} />
          <meshStandardMaterial color="#eee4d4" roughness={0.95} />
        </mesh>
      ))}

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5, -2]}>
        <planeGeometry args={[10, 9.6]} />
        <meshStandardMaterial color="#fffdf8" roughness={1} />
      </mesh>

      {/* Accent wall border along top */}
      <mesh position={[0, 4.85, -4.75]}>
        <boxGeometry args={[10, 0.22, 0.12]} />
        <meshStandardMaterial color={accentColor} roughness={0.4} metalness={0.3}
          emissive={new THREE.Color(accentColor)} emissiveIntensity={0.5} />
      </mesh>

      {/* Counter */}
      {/* Main counter body */}
      <mesh position={[0, 0.6, 1.2]}>
        <boxGeometry args={[6, 1.2, 1.0]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Counter top surface */}
      <mesh position={[0, 1.22, 1.2]}>
        <boxGeometry args={[6.08, 0.06, 1.08]} />
        <meshStandardMaterial color="#3d2a12" roughness={0.25} metalness={0.2} />
      </mesh>
      {/* Glass panel on counter */}
      <mesh position={[0, 1.55, 0.75]}>
        <boxGeometry args={[5.8, 0.65, 0.04]} />
        <meshPhysicalMaterial color="#a8d8f0" transparent opacity={0.3}
          roughness={0} transmission={0.8} thickness={0.1} />
      </mesh>

      {/* Display shelf unit on back wall */}
      {/* 2 horizontal shelves */}
      {[1.6, 3.0].map((sy, i) => (
        <mesh key={i} position={[0, sy, -4.6]}>
          <boxGeometry args={[9.2, 0.06, 0.42]} />
          <meshStandardMaterial color="#8b6540" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}
      {/* Shelf side supports */}
      {[-4.5, -1.5, 1.5, 4.5].map((sx, i) => (
        <mesh key={i} position={[sx, 2.3, -4.65]}>
          <boxGeometry args={[0.06, 1.55, 0.38]} />
          <meshStandardMaterial color="#6b4e2e" roughness={0.5} />
        </mesh>
      ))}

      {/* Products on back wall shelves */}
      <ProductWall merchant={merchant} />

      {/* Staff figures */}
      <StaffFigure position={[-1.5, 1.25, 0.65]} emoji="👩‍💼" name="歡迎光臨！" />
      <StaffFigure position={[1.5, 1.25, 0.65]} emoji="🧑‍💼" name="有什麼需要？" />

      {/* Shop name banner */}
      <Html transform occlude={false} scale={0.14} position={[0, 4.0, -4.65]}>
        <div style={{
          textAlign: "center",
          color: "#2a1a08",
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: "0.08em",
          padding: "6px 20px",
          background: "rgba(255,248,235,0.9)",
          borderRadius: 8,
          border: `2px solid ${accentColor}88`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}>
          {merchant.merchantName}
        </div>
      </Html>
    </>
  );
}

// ─── Corridor Scene ───────────────────────────────────────────
function CorridorScene({
  merchants,
  slot,
  targetSlot,
  onEnterShop,
}: {
  merchants: any[];
  slot: number;
  targetSlot: number;
  onEnterShop: (m: any) => void;
}) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const targetZ = useRef(0);
  const currentZ = useRef(0);

  useEffect(() => {
    targetZ.current = -(targetSlot * SHOP_SLOT_Z * 0.5);
  }, [targetSlot]);

  useFrame(() => {
    if (camRef.current) {
      const tz = -(targetSlot * SHOP_SLOT_Z * 0.5);
      currentZ.current += (tz - currentZ.current) * 0.07;
      camRef.current.position.z = currentZ.current + 2.5;
    }
  });

  // Distribute merchants: left/right alternating, every SHOP_SLOT_Z units
  const slots = useMemo(() => {
    const result: Array<{ left?: any; right?: any; z: number }> = [];
    for (let i = 0; i < Math.ceil(merchants.length / 2); i++) {
      result.push({
        left:  merchants[i * 2],
        right: merchants[i * 2 + 1],
        z: -(i * SHOP_SLOT_Z),
      });
    }
    return result;
  }, [merchants]);

  const totalLen = slots.length * SHOP_SLOT_Z + SHOP_SLOT_Z;

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault position={[0, 1.8, 2.5]} fov={68} near={0.1} far={80} />

      {/* Only allow Y rotation, no pan */}
      <OrbitControls
        target={[0, 1.8, currentZ.current]}
        minDistance={0.5} maxDistance={0.5}
        minPolarAngle={Math.PI * 0.36} maxPolarAngle={Math.PI * 0.62}
        enablePan={false} enableZoom={false}
        rotateSpeed={0.4}
        enableDamping dampingFactor={0.1}
      />

      {/* Lighting */}
      <ambientLight color="#fff5e0" intensity={1.8} />
      <directionalLight color="#ffffff" intensity={1.5} position={[0, 8, 5]} />

      {/* Environment */}
      <CorridorFloor length={totalLen} />
      <CorridorCeiling length={totalLen} />

      {/* Side corridor walls (above shop fronts) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (CORRIDOR_W + 4.5), CORRIDOR_H * 0.75, -(totalLen / 2 - SHOP_SLOT_Z * 0.5)]}>
          <boxGeometry args={[0.12, CORRIDOR_H * 0.5, totalLen + 6]} />
          <meshStandardMaterial color="#e8e0d0" roughness={0.9} />
        </mesh>
      ))}

      {/* Shop fronts */}
      {slots.map((s, i) => (
        <React.Fragment key={i}>
          {s.left && (
            <ShopFront merchant={s.left} side={-1} zPos={s.z} onEnter={() => onEnterShop(s.left)} />
          )}
          {s.right && (
            <ShopFront merchant={s.right} side={1} zPos={s.z} onEnter={() => onEnterShop(s.right)} />
          )}
        </React.Fragment>
      ))}

      {/* Entrance arch */}
      <mesh position={[0, CORRIDOR_H / 2, 4]}>
        <boxGeometry args={[CORRIDOR_W * 2 + 0.2, CORRIDOR_H + 0.2, 0.25]} />
        <meshStandardMaterial color="#c8b89a" roughness={0.7} />
      </mesh>
      <mesh position={[0, CORRIDOR_H / 2, 4]}>
        <boxGeometry args={[CORRIDOR_W * 1.45, CORRIDOR_H - 0.25, 0.3]} />
        <meshStandardMaterial color="#0d0a06" />
      </mesh>
      {/* Welcome sign */}
      <Html transform occlude={false} scale={0.12} position={[0, CORRIDOR_H - 0.2, 4.18]}>
        <div style={{
          color: "#f5c842", fontWeight: 800, fontSize: 18,
          letterSpacing: "0.1em", textShadow: "0 0 8px rgba(245,200,66,0.8)",
          pointerEvents: "none", userSelect: "none", whiteSpace: "nowrap",
        }}>大BB 虛擬商店場景</div>
      </Html>
    </>
  );
}

// ─── Loading placeholder scene ────────────────────────────────
function LoadingScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.8, 4]} fov={68} />
      <ambientLight intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 20]} />
        <meshStandardMaterial color="#ddd5c5" />
      </mesh>
      <Html center>
        <div style={{ color: "#8b6540", fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
          <span style={{
            display: "inline-block", width: 20, height: 20,
            border: "2px solid rgba(139,101,64,0.3)",
            borderTopColor: "#8b6540", borderRadius: "50%",
            animation: "vspin 0.8s linear infinite",
          }} />
          載入商場場景...
        </div>
      </Html>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────
export default function VirtualStore() {
  const { data: merchants = [], isLoading } = trpc.merchants.listApprovedMerchants.useQuery();
  const [, navigate] = useLocation();
  const [view, setView] = useState<SceneView>({ mode: "corridor", slot: 0 });
  const [targetSlot, setTargetSlot] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const totalSlots = Math.ceil(merchants.length / 2);

  function enterShop(merchant: any) {
    setTransitioning(true);
    setTimeout(() => {
      setView({ mode: "shop", merchant });
      setTransitioning(false);
    }, 300);
  }

  function exitShop() {
    setTransitioning(true);
    setTimeout(() => {
      setView({ mode: "corridor", slot: targetSlot });
      setTransitioning(false);
    }, 300);
  }

  function prevSlot() {
    if (targetSlot > 0) setTargetSlot(s => s - 1);
  }

  function nextSlot() {
    if (targetSlot < totalSlots - 1) setTargetSlot(s => s + 1);
  }

  const isShop = view.mode === "shop";
  const merchant = isShop ? (view as any).merchant : null;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column",
      background: "#0a0806", overflow: "hidden" }}>
      <Header />

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "7px 14px 6px",
        background: "rgba(0,0,0,0.55)",
        borderBottom: "1px solid rgba(200,170,100,0.2)",
        flexShrink: 0, zIndex: 10,
      }}>
        <button
          onClick={isShop ? exitShop : () => navigate("/merchants")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            color: "rgba(255,255,255,0.6)", fontSize: 12,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          {isShop ? <LogOut style={{ width: 14, height: 14 }} /> : <ChevronLeft style={{ width: 14, height: 14 }} />}
          {isShop ? "返回走廊" : "返回商戶列表"}
        </button>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: "rgba(245,200,80,0.95)",
          letterSpacing: "0.05em",
        }}>
          {isShop ? `🏪 ${merchant?.merchantName}` : "🛍️ 虛擬商店場景"}
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Fade overlay during transition */}
      {transitioning && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.85)",
          transition: "opacity 0.3s",
        }} />
      )}

      {/* 3D Canvas */}
      <div style={{ flex: 1, position: "relative" }}>
        <Canvas
          key={view.mode}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false }}
          style={{ width: "100%", height: "100%" }}
          onCreated={({ gl }) => gl.setClearColor(new THREE.Color(isShop ? "#f5ede0" : "#c8baa0"))}
        >
          <Suspense fallback={<LoadingScene />}>
            {isShop ? (
              <ShopInteriorScene merchant={merchant} />
            ) : !isLoading && merchants.length > 0 ? (
              <CorridorScene
                merchants={merchants}
                slot={targetSlot}
                targetSlot={targetSlot}
                onEnterShop={enterShop}
              />
            ) : (
              <LoadingScene />
            )}
          </Suspense>
        </Canvas>

        {/* Corridor navigation arrows */}
        {!isShop && (
          <>
            {targetSlot > 0 && (
              <button
                onClick={prevSlot}
                style={{
                  position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                  zIndex: 20, background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(255,200,80,0.35)",
                  borderRadius: "50%", width: 42, height: 42,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#f5c842",
                }}
              >
                <ChevronLeft style={{ width: 22, height: 22 }} />
              </button>
            )}
            {targetSlot < totalSlots - 1 && (
              <button
                onClick={nextSlot}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  zIndex: 20, background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(255,200,80,0.35)",
                  borderRadius: "50%", width: 42, height: 42,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#f5c842",
                }}
              >
                <ChevronRight style={{ width: 22, height: 22 }} />
              </button>
            )}
            {/* Slot indicator */}
            {totalSlots > 1 && (
              <div style={{
                position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)",
                zIndex: 20, display: "flex", gap: 5,
              }}>
                {Array.from({ length: totalSlots }).map((_, i) => (
                  <div key={i} onClick={() => setTargetSlot(i)}
                    style={{
                      width: i === targetSlot ? 20 : 6, height: 6,
                      borderRadius: 3, cursor: "pointer",
                      background: i === targetSlot ? "#f5c842" : "rgba(255,255,255,0.35)",
                      transition: "all 0.3s",
                    }} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Enter shop button in shop view */}
        {isShop && (
          <button
            onClick={() => navigate(`/merchants/${merchant?.userId}`)}
            style={{
              position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
              zIndex: 20,
              background: "linear-gradient(135deg, #d97706, #92400e)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              padding: "12px 28px", borderRadius: 24,
              border: "none", cursor: "pointer",
              boxShadow: "0 4px 20px rgba(217,119,6,0.5)",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            進入 {merchant?.merchantName} 商戶主頁 →
          </button>
        )}

        {/* Hint text */}
        <div style={{
          position: "absolute", bottom: isShop ? 128 : 78, left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,200,80,0.2)",
          borderRadius: 16, padding: "4px 12px",
          fontSize: 10, color: "rgba(255,220,100,0.65)",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          {isShop ? "拖動旋轉環視店舖" : "拖動環視 · 左右箭頭移動 · 點門口進入"}
        </div>
      </div>

      <style>{`
        @keyframes vspin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

import { useState, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Loader2, X, Images, Store } from "lucide-react";

interface GalleryItem {
  id: number; galleryId: number; merchantId: number; itemName: string;
  itemNumber: string | null; price: string; currency: string; imageUrl: string;
  status: string; sortOrder: number;
}

interface PublicGalleryData {
  gallery: {
    id: number; merchantId: number; merchantName: string; title: string;
    description: string | null; coverImageUrl: string | null; columnsPerRow: number;
    status: string;
  };
  items: GalleryItem[];
}

export default function PublicGallery() {
  const params = useParams<{ id: string }>();
  const galleryId = parseInt(params.id ?? '', 10);

  const [colsOverride, setColsOverride] = useState<number | null>(null);
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const galleryQ = trpc.productGalleries.getPublic.useQuery(
    { id: galleryId },
    { enabled: !isNaN(galleryId) && galleryId > 0, refetchOnWindowFocus: false }
  );

  const data = galleryQ.data as PublicGalleryData | null | undefined;
  const gallery = data?.gallery;
  const allItems = (data?.items ?? []) as GalleryItem[];
  const items = allItems.filter(i => i.status !== 'hidden');
  const displayCols = colsOverride ?? 3;

  const activeCount = items.filter(i => i.status === 'active').length;
  const soldCount = items.filter(i => i.status === 'sold').length;

  // ── Lightbox helpers ──
  function openLightbox(item: GalleryItem) {
    setLightboxItem(item);
    setLbZoom(1); setLbPanX(0); setLbPanY(0);
  }
  function lbPinchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function lbTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchStartDist.current = lbPinchDist(e.touches);
      pinchStartZoom.current = lbZoom;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTime.current < 280) { setLbZoom(1); setLbPanX(0); setLbPanY(0); }
      lastTapTime.current = now;
      panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartOffset.current = { x: lbPanX, y: lbPanY };
    }
  }
  function lbTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (lbPinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z);
    } else if (e.touches.length === 1 && lbZoom > 1) {
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  // ── Lightbox overlay ──
  if (lightboxItem) {
    const p = parseFloat(lightboxItem.price);
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'rgba(0,0,0,0.96)' }}
        onClick={() => { if (lbZoom <= 1) setLightboxItem(null); }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex-1 min-w-0 pr-2">
            {lightboxItem.itemNumber && (
              <p className="text-[10px] text-amber-400/80 font-mono mb-0.5">#{lightboxItem.itemNumber}</p>
            )}
            <p className="text-sm font-semibold text-white truncate">{lightboxItem.itemName || ''}</p>
            {p > 0 && (
              <p className="text-sm font-bold mt-0.5" style={{ color: '#FFB347' }}>
                HK${p.toLocaleString('en-HK')}
              </p>
            )}
          </div>
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            onClick={() => setLightboxItem(null)}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Image area */}
        <div className="flex-1 flex items-center justify-center overflow-hidden px-2">
          <img
            src={lightboxItem.imageUrl}
            className="max-w-full max-h-full object-contain rounded-xl select-none"
            style={{
              transform: `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`,
              transformOrigin: 'center center',
              touchAction: 'none',
              cursor: lbZoom > 1 ? 'grab' : 'default',
            }}
            onClick={e => e.stopPropagation()}
            onTouchStart={lbTouchStart}
            onTouchMove={lbTouchMove}
            alt=""
            draggable={false}
          />
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 pt-2 pb-5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {lbZoom > 1 ? (
            <button
              className="text-white/60 text-xs px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={() => { setLbZoom(1); setLbPanX(0); setLbPanY(0); }}
            >
              重設縮放
            </button>
          ) : (
            <p className="text-[11px] text-white/30">捏合手勢可放大</p>
          )}
          {lightboxItem.status === 'sold' && (
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#DC2626', color: '#fff' }}>
              已售出
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: '#ECECEC' }}>
      <Header />

      {galleryQ.isLoading ? (
        <div className="flex justify-center items-center py-28">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#FF8C00' }} />
        </div>
      ) : !gallery ? (
        <div className="text-center py-24 px-4">
          <Images className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1D5DB' }} />
          <p className="font-semibold" style={{ color: '#6B7280' }}>圖片集不存在或未公開</p>
          <a href="/" className="text-sm mt-4 inline-block" style={{ color: '#FF6B00' }}>返回首頁</a>
        </div>
      ) : (
        <>
          {/* ── Hero Banner ── */}
          <div className="mx-3 mt-3 mb-3 rounded-2xl overflow-hidden shadow-lg" style={{
            background: 'linear-gradient(145deg, #0D1B2A 0%, #1B263B 40%, #1F3A5F 100%)',
          }}>
            {/* Decorative circles */}
            <div className="relative px-4 pt-4 pb-4 overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10" style={{ background: '#FFB347' }} />
              <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full opacity-8" style={{ background: '#4A90D9' }} />

              {/* Merchant badge */}
              <div className="flex items-center gap-1.5 mb-2">
                <Store className="w-3 h-3 flex-shrink-0" style={{ color: '#FFB347' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#FFB347' }}>{gallery.merchantName}</span>
              </div>

              {/* Title */}
              <h1 className="text-[17px] font-bold leading-snug mb-1.5 relative z-10" style={{ color: '#FFFFFF' }}>
                {gallery.title}
              </h1>

              {/* Description */}
              {gallery.description && (
                <p className="text-[11px] leading-relaxed mb-2.5 relative z-10 whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {gallery.description}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-2 flex-wrap relative z-10">
                {activeCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{
                    background: 'rgba(34,197,94,0.2)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.25)'
                  }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ADE80' }} />
                    {activeCount} 件在售
                  </span>
                )}
                {soldCount > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{
                    background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)'
                  }}>
                    {soldCount} 件已售
                  </span>
                )}
                {activeCount === 0 && soldCount === 0 && (
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>暫無商品</span>
                )}

                {/* Column toggle 1–10 */}
                <div className="w-full mt-2 flex items-center gap-1">
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>列數</span>
                  <div className="flex gap-1 flex-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        onClick={() => setColsOverride(n)}
                        className="flex-1 py-1 rounded-md font-bold transition-all"
                        style={displayCols === n ? {
                          background: 'linear-gradient(135deg, #FF8C00, #FF6B00)',
                          color: '#fff',
                          fontSize: '10px',
                        } : {
                          background: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.45)',
                          fontSize: '10px',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Grid ── */}
          {items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Images className="w-10 h-10 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>暫無商品</p>
            </div>
          ) : (
            <div
              className="px-3"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
                gap: displayCols >= 8 ? '2px' : '5px',
              }}
            >
              {items.map(item => {
                const price = parseFloat(item.price);
                const isSold = item.status === 'sold';
                // >= 7 cols: image-only compact mode (no text strip)
                const isCompact = displayCols >= 7;
                // ribbon size scales with cols
                const ribbonSize = displayCols >= 5 ? 36 : 46;

                return (
                  <div
                    key={item.id}
                    onClick={() => openLightbox(item)}
                    className="cursor-pointer overflow-hidden"
                    style={{
                      borderRadius: isCompact ? '4px' : '10px',
                      background: '#fff',
                      boxShadow: isCompact ? 'none' : '0 1px 6px rgba(0,0,0,0.10)',
                    }}
                  >
                    {/* ── Image ── */}
                    <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
                      <img
                        src={item.imageUrl}
                        alt={item.itemName || '商品'}
                        className="w-full h-full object-cover"
                        style={{ filter: isSold ? 'grayscale(50%) brightness(0.88)' : 'none' }}
                        loading="lazy"
                      />

                      {/* Sold ribbon (top-right corner triangle) */}
                      {isSold && (
                        isCompact ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="font-bold text-white rounded" style={{
                              fontSize: '5px', padding: '1px 2px', background: 'rgba(185,28,28,0.85)',
                            }}>已售</span>
                          </div>
                        ) : (
                          <>
                            <div className="absolute" style={{
                              top: 0, right: 0, width: 0, height: 0,
                              borderStyle: 'solid',
                              borderWidth: `0 ${ribbonSize}px ${ribbonSize}px 0`,
                              borderColor: `transparent #DC2626 transparent transparent`,
                            }} />
                            <div className="absolute font-bold text-white" style={{
                              top: displayCols >= 5 ? '3px' : '5px',
                              right: displayCols >= 5 ? '1px' : '2px',
                              fontSize: displayCols >= 5 ? '6px' : '7px',
                              transform: 'rotate(45deg)',
                            }}>已售</div>
                          </>
                        )
                      )}
                    </div>

                    {/* ── Info strip (below image, no overlay) ── */}
                    {!isCompact && (
                      <div style={{
                        padding: displayCols >= 4 ? '3px 5px 4px' : '4px 6px 5px',
                        borderTop: '1px solid #F0F0F0',
                      }}>
                        {item.itemNumber && (
                          <p className="font-mono truncate leading-none mb-0.5" style={{
                            fontSize: displayCols >= 4 ? '7px' : '8px', color: '#9CA3AF',
                          }}>#{item.itemNumber}</p>
                        )}
                        {item.itemName && (
                          <p className="font-semibold truncate leading-tight" style={{
                            fontSize: displayCols >= 4 ? '8px' : '10px', color: '#1F2937',
                          }}>{item.itemName}</p>
                        )}
                        <p className="font-bold leading-none mt-0.5" style={{
                          fontSize: displayCols >= 4 ? '8px' : '10px',
                          color: isSold ? '#9CA3AF' : '#FF6B00',
                        }}>
                          {isSold ? '已售出' : price > 0 ? `HK$${price.toLocaleString('en-HK')}` : '面議'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}

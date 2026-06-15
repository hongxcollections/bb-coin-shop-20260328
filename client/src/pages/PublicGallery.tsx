import { useState, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Loader2, X, Images } from "lucide-react";

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

  const [colsOverride, setColsOverride] = useState<5 | 10 | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
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
  const displayCols = colsOverride ?? gallery?.columnsPerRow ?? 5;

  const activeCount = items.filter(i => i.status === 'active').length;
  const soldCount = items.filter(i => i.status === 'sold').length;

  // ── Lightbox helpers ──
  function openLightbox(src: string) {
    setLightboxSrc(src);
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

  // ── Lightbox ──
  if (lightboxSrc) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center"
        onClick={() => { if (lbZoom <= 1) setLightboxSrc(null); }}
      >
        <button
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
          onClick={() => setLightboxSrc(null)}
        >
          <X className="w-5 h-5 text-white" />
        </button>
        {lbZoom > 1 && (
          <button
            className="absolute top-4 left-4 text-white/70 text-xs px-3 py-1.5 rounded-xl bg-black/50"
            onClick={() => { setLbZoom(1); setLbPanX(0); setLbPanY(0); }}
          >
            重設縮放
          </button>
        )}
        <img
          src={lightboxSrc}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
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
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F5' }}>
      <Header />

      {galleryQ.isLoading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
        </div>
      ) : !gallery ? (
        <div className="text-center py-24 px-4">
          <Images className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">圖片集不存在或未公開</p>
          <a href="/" className="text-orange-500 text-sm mt-4 inline-block">返回首頁</a>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-3 pt-4 pb-20">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-lg font-bold text-gray-900">{gallery.title}</h1>
            {gallery.description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-line">{gallery.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <p className="text-xs text-gray-400">
                {gallery.merchantName}
                {activeCount > 0 && ` · ${activeCount} 件在售`}
                {soldCount > 0 && ` · ${soldCount} 件已售`}
              </p>
              {/* Column toggle */}
              <div className="ml-auto flex gap-1">
                {([5, 10] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setColsOverride(n)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      displayCols === n
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'border-gray-300 text-gray-500 bg-white'
                    }`}
                  >
                    {n}列
                  </button>
                ))}
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16">
              <Images className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">暫無商品</p>
            </div>
          ) : (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${displayCols}, 1fr)`,
                gap: displayCols >= 10 ? '2px' : '4px',
              }}
            >
              {items.map(item => {
                const price = parseFloat(item.price);
                return (
                  <div
                    key={item.id}
                    className="bg-white overflow-hidden"
                    style={{ borderRadius: displayCols >= 10 ? '4px' : '8px' }}
                  >
                    {/* Image */}
                    <div className="relative">
                      <img
                        src={item.imageUrl}
                        alt={item.itemName || '商品'}
                        className="w-full aspect-square object-cover cursor-pointer"
                        onClick={() => openLightbox(item.imageUrl)}
                        loading="lazy"
                      />
                      {item.status === 'sold' && (
                        <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                          <span
                            className="text-white font-bold bg-black/60 rounded-full"
                            style={{
                              fontSize: displayCols >= 10 ? '6px' : '10px',
                              padding: displayCols >= 10 ? '1px 3px' : '2px 6px',
                            }}
                          >
                            已售
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Item info — only shown at 5 cols or fewer */}
                    {displayCols <= 5 && (
                      <div className="px-1.5 py-1.5 space-y-0.5">
                        {item.itemNumber && (
                          <p className="text-[9px] text-gray-400 truncate leading-none">{item.itemNumber}</p>
                        )}
                        <p className="text-[10px] font-semibold text-gray-800 truncate leading-tight">
                          {item.itemName || '—'}
                        </p>
                        <p className="text-[10px] font-bold leading-none" style={{ color: '#FF6B00' }}>
                          {price > 0 ? `HK$${price.toLocaleString('en-HK')}` : '面議'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

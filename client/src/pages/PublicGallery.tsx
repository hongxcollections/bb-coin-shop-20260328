import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Loader2, X, Images, Store, ShoppingCart, MessageCircle, CheckCircle2, LayoutGrid, LayoutList } from "lucide-react";
import { toast } from "sonner";
import { GalleryItemShareMenu } from "@/components/ShareMenu";

interface GalleryItemImage {
  id: number; imageUrl: string;
}

interface GalleryItem {
  id: number; galleryId: number; merchantId: number; itemName: string;
  itemNumber: string | null; price: string; currency: string; imageUrl: string;
  status: string; sortOrder: number;
  images?: GalleryItemImage[];
}

interface PublicGalleryData {
  gallery: {
    id: number; merchantId: number; merchantName: string; title: string;
    description: string | null; coverImageUrl: string | null; columnsPerRow: number;
    status: string;
  };
  items: GalleryItem[];
}

// ── Per-item swipeable image carousel ──
function ItemCarousel({
  images, primaryUrl, isSold, onClick,
}: {
  images: GalleryItemImage[];
  primaryUrl: string;
  isSold: boolean;
  onClick: (url: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const touchStartX = useRef(0);
  const allUrls = images.length > 0 ? images.map(i => i.imageUrl) : (primaryUrl ? [primaryUrl] : []);
  const currentUrl = allUrls[idx] ?? allUrls[0] ?? '';

  if (!currentUrl) return null;

  return (
    <div
      className="w-full h-full relative"
      onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        const diff = touchStartX.current - e.changedTouches[0].clientX;
        if (diff > 40 && idx < allUrls.length - 1) setIdx(i => i + 1);
        else if (diff < -40 && idx > 0) setIdx(i => i - 1);
      }}
      onClick={() => onClick(currentUrl)}
    >
      <img
        src={currentUrl}
        alt="商品"
        className="w-full h-full object-cover"
        style={{ filter: isSold ? 'grayscale(50%) brightness(0.88)' : 'none' }}
        loading="lazy"
      />
      {allUrls.length > 1 && (
        <div className="absolute flex gap-0.5 pointer-events-none" style={{ bottom: 22, left: 0, right: 0, justifyContent: 'center' }}>
          {allUrls.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === idx ? 12 : 5, height: 4, borderRadius: 2,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'width 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Buy confirmation bottom sheet ──
function BuySheet({
  item, onClose, onSuccess,
}: {
  item: GalleryItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const price = parseFloat(item.price);

  const buyM = trpc.productGalleries.buyItem.useMutation({
    onSuccess: () => { setDone(true); onSuccess(); },
    onError: (e) => { toast.error(e.message); setSubmitting(false); },
  });

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <ShoppingCart className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">請先登入</p>
          <p className="text-sm text-gray-500 mb-4">登入後才可落單購買</p>
          <button
            onClick={() => { onClose(); navigate(`/login?from=${encodeURIComponent(window.location.pathname)}`); }}
            className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-xl"
          >前往登入</button>
          <button onClick={onClose} className="w-full mt-2 text-sm text-gray-400 py-2">取消</button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-500" />
          </div>
          <h2 className="font-bold text-gray-800 text-lg mb-1">落單成功！</h2>
          <p className="text-sm text-gray-500 mb-2">已成功落單，商戶已收到通知</p>
          <div className="bg-amber-50 rounded-xl px-3 py-2.5 mb-4 flex gap-3 text-left">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
              />
            )}
            <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
              <p className="text-sm font-medium text-gray-800 leading-snug">{item.itemName || `圖集商品 #${item.id}`}</p>
              {item.itemNumber && <p className="text-xs text-gray-400">編號：{item.itemNumber}</p>}
              {price > 0 && <p className="text-amber-600 font-bold text-sm">HK${price.toLocaleString('en-HK')}</p>}
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-6">請等候商戶確認成交，確認後我們會通知你。</p>
          <button onClick={onClose} className="w-full bg-amber-500 text-white font-semibold py-2.5 rounded-xl">完成</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="font-bold text-gray-800 text-base">確認落單</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded-full text-gray-400 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-amber-50 rounded-xl p-3 flex gap-3">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
            />
          )}
          <div className="flex-1 min-w-0 space-y-0.5 flex flex-col justify-center">
            <p className="font-semibold text-gray-800 text-sm leading-snug">{item.itemName || `圖集商品 #${item.id}`}</p>
            {item.itemNumber && <p className="text-xs text-gray-400">編號：{item.itemNumber}</p>}
            <p className="text-amber-600 font-bold">{price > 0 ? `HK$${price.toLocaleString('en-HK')}` : '面議'}</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">備注（選填）</label>
          <textarea
            className="w-full border border-gray-200 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            rows={2} maxLength={200} placeholder="如有特別要求請在此說明…"
            value={note} onChange={e => setNote(e.target.value)}
          />
        </div>

        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5">落單後商戶會聯絡你確認成交。</p>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium">取消</button>
          <button
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              buyM.mutate({ itemId: item.id, buyerNote: note || undefined });
            }}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            {submitting ? '處理中…' : '確認落單'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sold notice bottom sheet ──
function SoldSheet({ item, merchantId, onClose }: { item: GalleryItem; merchantId: number; onClose: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const openChat = trpc.chat.openRoomByMerchant.useMutation({
    onSuccess: ({ roomId }) => { onClose(); navigate(`/chat/${roomId}`); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        {item.imageUrl ? (
          <div className="relative w-20 h-20 mx-auto mb-3">
            <img
              src={item.imageUrl}
              alt={item.itemName || ''}
              className="w-20 h-20 rounded-full object-cover border-2 border-red-100"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
              <span className="text-white text-xs font-bold">售</span>
            </div>
          </div>
        ) : (
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🏷️</span>
          </div>
        )}
        <h2 className="font-bold text-gray-800 mb-1">此貨品已售出</h2>
        {item.itemName && <p className="text-sm text-gray-500 mb-1">{item.itemName}</p>}
        <p className="text-sm text-gray-400 mb-5">詳情可以聯繫商戶查詢</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">關閉</button>
          {user ? (
            <button
              onClick={() => openChat.mutate({ merchantId: merchantId, productTitle: item.itemName || '圖集商品' })}
              disabled={openChat.isPending}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {openChat.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
              聯繫商戶
            </button>
          ) : (
            <button
              onClick={() => { onClose(); navigate(`/login?from=${encodeURIComponent(window.location.pathname)}`); }}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
            >登入後聯繫</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicGallery() {
  const params = useParams<{ id: string }>();
  const galleryId = parseInt(params.id ?? '', 10);

  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);
  const [lbImgIdx, setLbImgIdx] = useState(0);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const lbScrollRef = useRef<HTMLDivElement>(null);
  const lbVScrollRef = useRef<HTMLDivElement>(null);
  const lbZoomRef = useRef(1);
  const lastOpenedItemId = useRef<number | null>(null);
  const [lbVZoomIdx, setLbVZoomIdx] = useState(-1);
  const lbVZoomIdxRef = useRef(-1);

  const [buyingItem, setBuyingItem] = useState<GalleryItem | null>(null);
  const [soldItem, setSoldItem] = useState<GalleryItem | null>(null);
  const [lbMode, setLbMode] = useState<'h' | 'v'>('v');

  const galleryQ = trpc.productGalleries.getPublic.useQuery(
    { id: galleryId },
    { enabled: !isNaN(galleryId) && galleryId > 0, refetchOnWindowFocus: false }
  );

  const data = galleryQ.data as PublicGalleryData | null | undefined;
  const gallery = data?.gallery;
  const allItems = (data?.items ?? []) as GalleryItem[];
  const [localSold, setLocalSold] = useState<Set<number>>(new Set());
  const items = allItems.filter(i => i.status !== 'hidden');
  const displayCols = gallery?.columnsPerRow ?? 3;

  const activeCount = items.filter(i => i.status === 'active' && !localSold.has(i.id)).length;
  const soldCount = items.filter(i => i.status === 'sold' || localSold.has(i.id)).length;

  // ── Deep-link: ?item={id} auto-opens lightbox ──
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (deepLinkHandled.current || items.length === 0) return;
    const itemId = parseInt(new URLSearchParams(window.location.search).get('item') ?? '', 10);
    if (!isNaN(itemId) && itemId > 0) {
      const target = items.find(i => i.id === itemId);
      if (target) {
        deepLinkHandled.current = true;
        openLightbox(target);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ── Lightbox helpers ──
  function openLightbox(item: GalleryItem) {
    const imgs = item.images ?? [];
    const startIdx = imgs.findIndex(i => i.imageUrl === item.imageUrl);
    const idx = startIdx >= 0 ? startIdx : 0;
    lastOpenedItemId.current = item.id;
    setLightboxItem(item);
    setLbImgIdx(idx);
    setLbZoom(1); lbZoomRef.current = 1;
    setLbPanX(0); setLbPanY(0);
    setLbMode('v');
    setLbVZoomIdx(-1); lbVZoomIdxRef.current = -1;
    // scroll strip to correct index after render
    setTimeout(() => {
      if (lbScrollRef.current) {
        lbScrollRef.current.scrollLeft = idx * lbScrollRef.current.clientWidth;
      }
    }, 20);
  }

  // keep zoom ref in sync so native touch handlers can read it without stale closure
  useEffect(() => { lbZoomRef.current = lbZoom; }, [lbZoom]);

  // scroll back to the opened item after lightbox closes
  useEffect(() => {
    if (!lightboxItem && lastOpenedItemId.current !== null) {
      const id = lastOpenedItemId.current;
      setTimeout(() => {
        document.getElementById(`lb-item-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }, 60);
    }
  }, [lightboxItem]);

  // native touchstart with passive:false on vertical scroll container — pinch zoom
  useEffect(() => {
    const el = lbVScrollRef.current;
    if (!el || !lightboxItem || lbMode !== 'v') return;
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        // detect which image is under midpoint
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const imgs = el!.querySelectorAll('img');
        let found = 0;
        imgs.forEach((img, i) => {
          const r = img.getBoundingClientRect();
          if (my >= r.top && my <= r.bottom) found = i;
        });
        lbVZoomIdxRef.current = found;
        setLbVZoomIdx(found);
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartZoom.current = lbZoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280 && lbZoomRef.current > 1) {
          setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0);
        }
        lastTapTime.current = now;
        if (lbZoomRef.current > 1) {
          panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          panStartOffset.current = { x: lbPanX, y: lbPanY };
        }
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => el.removeEventListener('touchstart', onTouchStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxItem, lbMode, lbPanX, lbPanY]);

  function lbVTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (lbPinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z); lbZoomRef.current = z;
    } else if (e.touches.length === 1 && lbZoomRef.current > 1) {
      e.preventDefault();
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  // native touchstart with passive:false on scroll strip — needed for pinch preventDefault
  useEffect(() => {
    const el = lbScrollRef.current;
    if (!el || !lightboxItem) return;
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartZoom.current = lbZoomRef.current;
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime.current < 280) {
          setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0);
        }
        lastTapTime.current = now;
        panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStartOffset.current = { x: lbPanX, y: lbPanY };
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    return () => el.removeEventListener('touchstart', onTouchStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxItem, lbPanX, lbPanY]);

  function lbPinchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function lbTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (lbPinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z); lbZoomRef.current = z;
    } else if (e.touches.length === 1 && lbZoomRef.current > 1) {
      e.preventDefault();
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  // ── Lightbox overlay ──
  if (lightboxItem) {
    const p = parseFloat(lightboxItem.price);
    const isItemSold = lightboxItem.status === 'sold' || localSold.has(lightboxItem.id);
    const lbImgs = lightboxItem.images && lightboxItem.images.length > 0
      ? lightboxItem.images
      : (lightboxItem.imageUrl ? [{ id: 0, imageUrl: lightboxItem.imageUrl }] : []);
    // append clone of first image for loop-back effect
    const loopImgs = lbImgs.length > 1 ? [...lbImgs, lbImgs[0]] : lbImgs;
    const dotIdx = lbImgIdx % lbImgs.length;
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: 'rgba(0,0,0,0.97)',
          paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Top bar: info + mode toggle + 關閉 */}
        <div className="flex items-start justify-between px-3 pt-3 pb-2 flex-shrink-0 gap-2">
          <div className="flex-1 min-w-0">
            {lightboxItem.itemNumber && (
              <p className="text-[10px] text-amber-400/80 font-mono mb-0.5">#{lightboxItem.itemNumber}</p>
            )}
            <p className="text-sm font-semibold text-white leading-snug">{lightboxItem.itemName || ''}</p>
            {p > 0 && (
              <p className="text-sm font-bold mt-0.5" style={{ color: '#FFB347' }}>HK${p.toLocaleString('en-HK')}</p>
            )}
          </div>
          {/* mode toggle — only show when multiple images */}
          {lbImgs.length > 1 && (
            <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.2)', alignSelf: 'flex-start', marginTop: 2 }}>
              <button
                onClick={() => { setLbMode('h'); setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0); setLbVZoomIdx(-1); lbVZoomIdxRef.current = -1; }}
                style={{
                  padding: '5px 8px',
                  background: lbMode === 'h' ? 'rgba(255,255,255,0.25)' : 'transparent',
                  color: '#fff', display: 'flex', alignItems: 'center',
                }}
                title="橫向瀏覽"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setLbMode('v'); setLbZoom(1); lbZoomRef.current = 1; setLbPanX(0); setLbPanY(0); setLbVZoomIdx(-1); lbVZoomIdxRef.current = -1; }}
                style={{
                  padding: '5px 8px',
                  background: lbMode === 'v' ? 'rgba(255,255,255,0.25)' : 'transparent',
                  color: '#fff', display: 'flex', alignItems: 'center',
                }}
                title="直立式瀏覽"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            className="px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', alignSelf: 'flex-start', marginTop: 2 }}
            onClick={() => setLightboxItem(null)}
          >
            關閉
          </button>
        </div>

        {/* Image area — horizontal (scroll-snap) or vertical (full-width stack) */}
        <div className="flex-1 relative overflow-hidden">

          {lbMode === 'v' ? (
            /* ── Vertical mode: all images stacked, pinch-to-zoom per image ── */
            <div
              ref={lbVScrollRef}
              className="h-full"
              style={{
                overflowY: lbZoom > 1 ? 'hidden' : 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'none',
              } as React.CSSProperties}
              onTouchMove={lbVTouchMove}
            >
              {lbImgs.map((img, i) => (
                <div
                  key={img.id + '-' + i}
                  className="flex items-center justify-center"
                  style={{ padding: '3px 3px', minHeight: '30vh' }}
                >
                  <img
                    src={img.imageUrl}
                    className="select-none"
                    style={{
                      width: '100%',
                      objectFit: 'contain',
                      borderRadius: 14,
                      display: 'block',
                      transform: lbVZoomIdx === i
                        ? `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`
                        : 'none',
                      transformOrigin: 'center center',
                      pointerEvents: 'none',
                    }}
                    alt=""
                    draggable={false}
                    loading="lazy"
                  />
                </div>
              ))}
              {/* bottom spacer so last image isn't flush against bottom bar */}
              <div style={{ height: 12 }} />
            </div>
          ) : (
            /* ── Horizontal mode: scroll-snap strip, loop, pinch zoom ── */
            <>
              <div
                ref={lbScrollRef}
                className="flex h-full"
                style={{
                  overflowX: lbZoom > 1 ? 'hidden' : 'auto',
                  overflowY: 'hidden',
                  scrollSnapType: 'x mandatory',
                  scrollBehavior: 'auto',
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
                } as React.CSSProperties}
                onScroll={() => {
                  if (!lbScrollRef.current || lbZoomRef.current > 1) return;
                  const w = lbScrollRef.current.clientWidth;
                  const scrollLeft = lbScrollRef.current.scrollLeft;
                  const remainder = scrollLeft % w;
                  if (remainder > 2 && remainder < w - 2) return;
                  const idx = Math.round(scrollLeft / w);
                  if (lbImgs.length > 1 && idx === lbImgs.length) {
                    lbScrollRef.current.scrollLeft = 0;
                    setLbImgIdx(0);
                    setLbZoom(1); lbZoomRef.current = 1;
                    setLbPanX(0); setLbPanY(0);
                    return;
                  }
                  if (idx !== lbImgIdx) {
                    setLbImgIdx(idx);
                    setLbZoom(1); lbZoomRef.current = 1;
                    setLbPanX(0); setLbPanY(0);
                  }
                }}
                onTouchMove={lbTouchMove}
              >
                {loopImgs.map((img, i) => (
                  <div
                    key={img.id + '-' + i}
                    className="flex-shrink-0 h-full flex items-center justify-center"
                    style={{ width: '100%', scrollSnapAlign: 'start', padding: '0 3px' }}
                  >
                    <img
                      src={img.imageUrl}
                      className="select-none"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: 14,
                        display: 'block',
                        transform: i === lbImgIdx
                          ? `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`
                          : 'none',
                        transformOrigin: 'center center',
                        pointerEvents: 'none',
                      }}
                      alt=""
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {/* Dots indicator */}
              {lbImgs.length > 1 && (
                <div
                  className="absolute flex gap-1.5 pointer-events-none"
                  style={{ bottom: 6, left: 0, right: 0, justifyContent: 'center' }}
                >
                  {lbImgs.map((_, i) => (
                    <div key={i} style={{
                      width: i === dotIdx ? 14 : 6,
                      height: 6,
                      borderRadius: 3,
                      background: i === dotIdx ? '#fff' : 'rgba(255,255,255,0.35)',
                      transition: 'width 0.2s',
                    }} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom bar: hint/reset + sold/buy */}
        <div className="flex items-center justify-between px-4 pt-2 pb-3 flex-shrink-0">
          {lbZoom > 1 ? (
            <button
              className="text-white/60 text-xs px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={() => {
                setLbZoom(1); lbZoomRef.current = 1;
                setLbPanX(0); setLbPanY(0);
              }}
            >重設縮放</button>
          ) : (
            <p className="text-[11px] text-white/30">
              {lbImgs.length > 1 ? '左右滑動切換' : '兩指放大'}
            </p>
          )}
          <div className="flex items-center gap-2">
            {isItemSold ? (
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#DC2626', color: '#fff' }}>已售出</span>
            ) : (
              <button
                onClick={() => { setLightboxItem(null); setBuyingItem(lightboxItem); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24', color: '#fff' }}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                立即落單
              </button>
            )}
            <GalleryItemShareMenu
              galleryId={lightboxItem.galleryId}
              itemId={lightboxItem.id}
              itemName={lightboxItem.itemName}
              itemNumber={lightboxItem.itemNumber}
              price={lightboxItem.price}
              variant="light"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: '#ECECEC' }}>
      <Header />

      {/* Sheets */}
      {buyingItem && (
        <BuySheet
          item={buyingItem}
          onClose={() => setBuyingItem(null)}
          onSuccess={() => {
            setLocalSold(s => new Set([...s, buyingItem.id]));
            setBuyingItem(null);
          }}
        />
      )}
      {soldItem && gallery && (
        <SoldSheet item={soldItem} merchantId={gallery.merchantId} onClose={() => setSoldItem(null)} />
      )}

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
            <div className="relative px-4 pt-4 pb-4 overflow-hidden">
              <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10" style={{ background: '#FFB347' }} />
              <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full opacity-10" style={{ background: '#4A90D9' }} />

              <div className="flex items-center gap-1.5 mb-2">
                <Store className="w-3 h-3 flex-shrink-0" style={{ color: '#FFB347' }} />
                <span className="text-[11px] font-semibold" style={{ color: '#FFB347' }}>{gallery.merchantName}</span>
              </div>

              <h1 className="text-[17px] font-bold leading-snug mb-1.5 relative z-10" style={{ color: '#FFFFFF' }}>
                {gallery.title}
              </h1>

              {gallery.description && (
                <p className="text-[11px] leading-relaxed mb-2.5 relative z-10 whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {gallery.description}
                </p>
              )}

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
              </div>
            </div>
          </div>

          {/* ── Grid ── */}
          {/* Items always sized at 3-column width; extra columns overflow horizontally */}
          {items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Images className="w-10 h-10 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>暫無商品</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${displayCols}, calc((100vw - 24px) / 3))`,
                  gap: `${displayCols >= 8 ? 2 : 5}px`,
                  paddingLeft: 12,
                  paddingRight: 12,
                  width: 'max-content',
                  minWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
              {items.map(item => {
                const price = parseFloat(item.price);
                const isSold = item.status === 'sold' || localSold.has(item.id);
                // Always render at 3-column visual size regardless of displayCols
                const ribbonSize = 46;

                return (
                  <div
                    key={item.id}
                    id={`lb-item-${item.id}`}
                    className="overflow-hidden"
                    style={{
                      borderRadius: '10px',
                      background: '#fff',
                      boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
                    }}
                  >
                    {/* ── Image carousel (swipe for multi-image) ── */}
                    <div
                      className="relative w-full"
                      style={{ aspectRatio: '1/1' }}
                    >
                      <ItemCarousel
                        images={item.images ?? []}
                        primaryUrl={item.imageUrl}
                        isSold={isSold}
                        onClick={(url) => openLightbox({ ...item, imageUrl: url })}
                      />

                      {/* Bottom-left info overlay (name + price) */}
                      {(item.itemNumber || item.itemName || price > 0) && (
                        <div
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
                            padding: '18px 6px 5px 6px',
                          }}
                        >
                          {item.itemNumber && (
                            <p className="font-mono leading-none mb-0.5" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)' }}>
                              #{item.itemNumber}
                            </p>
                          )}
                          {item.itemName && (
                            <p className="font-semibold text-white leading-tight truncate" style={{ fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                              {item.itemName}
                            </p>
                          )}
                          {price > 0 && (
                            <p className="font-bold leading-none mt-0.5" style={{ fontSize: '10px', color: '#FFD580' }}>
                              HK${price.toLocaleString('en-HK')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Sold ribbon */}
                      {isSold && (
                        <>
                          <div className="absolute" style={{
                            top: 0, right: 0, width: 0, height: 0,
                            borderStyle: 'solid',
                            borderWidth: `0 ${ribbonSize}px ${ribbonSize}px 0`,
                            borderColor: `transparent #DC2626 transparent transparent`,
                          }} />
                          <div className="absolute font-bold text-white" style={{
                            top: '5px', right: '2px', fontSize: '7px',
                            transform: 'rotate(45deg)',
                          }}>已售</div>
                        </>
                      )}
                    </div>

                    {/* ── Buy button strip (always shown at 3-col size) ── */}
                    {isSold ? (
                      <button
                        onClick={() => setSoldItem(item)}
                        className="w-full flex items-center justify-center gap-1 py-1.5"
                        style={{
                          background: '#F3F4F6',
                          fontSize: '11px',
                          color: '#9CA3AF',
                          fontWeight: 600,
                        }}
                      >
                        <span>已售出 · 聯繫商戶</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setBuyingItem(item)}
                        className="w-full flex items-center justify-center gap-1 py-1.5"
                        style={{
                          backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)',
                          backgroundColor: '#FBBF24',
                          fontSize: '11px',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        <ShoppingCart style={{ width: '11px', height: '11px' }} />
                        <span>立即落單</span>
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}

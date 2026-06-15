import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Loader2, X, Images, Store, ShoppingCart, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
          {item.itemName && (
            <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-4 text-left">
              <p className="text-sm font-medium text-gray-800">{item.itemName}</p>
              {price > 0 && <p className="text-amber-600 font-bold text-sm mt-0.5">HK${price.toLocaleString('en-HK')}</p>}
            </div>
          )}
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

        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-gray-800 text-sm">{item.itemName || `圖集商品 #${item.id}`}</p>
          {item.itemNumber && <p className="text-xs text-gray-400">編號：{item.itemNumber}</p>}
          <p className="text-amber-600 font-bold">{price > 0 ? `HK$${price.toLocaleString('en-HK')}` : '面議'}</p>
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
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🏷️</span>
        </div>
        <h2 className="font-bold text-gray-800 mb-1">此貨品已售出</h2>
        {item.itemName && <p className="text-sm text-gray-500 mb-1">{item.itemName}</p>}
        <p className="text-sm text-gray-400 mb-5">詳情可以聯繫商戶查詢</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">關閉</button>
          {user ? (
            <button
              onClick={() => openChat.mutate({ merchantUserId: merchantId, contextType: 'product', contextId: item.id, contextTitle: item.itemName || '圖集商品' })}
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
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  const [buyingItem, setBuyingItem] = useState<GalleryItem | null>(null);
  const [soldItem, setSoldItem] = useState<GalleryItem | null>(null);

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
    const isItemSold = lightboxItem.status === 'sold' || localSold.has(lightboxItem.id);
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'rgba(0,0,0,0.96)' }}
        onClick={() => { if (lbZoom <= 1) setLightboxItem(null); }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <div className="flex-1 min-w-0 pr-2">
            {lightboxItem.itemNumber && (
              <p className="text-[10px] text-amber-400/80 font-mono mb-0.5">#{lightboxItem.itemNumber}</p>
            )}
            <p className="text-sm font-semibold text-white truncate">{lightboxItem.itemName || ''}</p>
            {p > 0 && (
              <p className="text-sm font-bold mt-0.5" style={{ color: '#FFB347' }}>HK${p.toLocaleString('en-HK')}</p>
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

        <div className="flex items-center justify-between px-4 pt-2 pb-5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {lbZoom > 1 ? (
            <button
              className="text-white/60 text-xs px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={() => { setLbZoom(1); setLbPanX(0); setLbPanY(0); }}
            >重設縮放</button>
          ) : (
            <p className="text-[11px] text-white/30">捏合手勢可放大</p>
          )}
          {isItemSold ? (
            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#DC2626', color: '#fff' }}>已售出</span>
          ) : (
            <button
              onClick={() => { setLightboxItem(null); setBuyingItem(lightboxItem); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)', color: '#fff' }}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              立即落單
            </button>
          )}
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
                const isSold = item.status === 'sold' || localSold.has(item.id);
                const isCompact = displayCols >= 7;
                const ribbonSize = displayCols >= 5 ? 36 : 46;
                const showBuyBtn = !isCompact;

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden"
                    style={{
                      borderRadius: isCompact ? '4px' : '10px',
                      background: '#fff',
                      boxShadow: isCompact ? 'none' : '0 1px 6px rgba(0,0,0,0.10)',
                    }}
                  >
                    {/* ── Image (clickable → lightbox) ── */}
                    <div
                      className="relative w-full cursor-pointer"
                      style={{ aspectRatio: '1/1' }}
                      onClick={() => openLightbox(item)}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.itemName || '商品'}
                        className="w-full h-full object-cover"
                        style={{ filter: isSold ? 'grayscale(50%) brightness(0.88)' : 'none' }}
                        loading="lazy"
                      />

                      {/* Bottom-left info overlay (name + price) */}
                      {!isCompact && (item.itemNumber || item.itemName || price > 0) && (
                        <div
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
                            padding: '18px 6px 5px 6px',
                          }}
                        >
                          {item.itemNumber && (
                            <p className="font-mono leading-none mb-0.5" style={{ fontSize: displayCols >= 4 ? '7px' : '8px', color: 'rgba(255,255,255,0.7)' }}>
                              #{item.itemNumber}
                            </p>
                          )}
                          {item.itemName && (
                            <p className="font-semibold text-white leading-tight truncate" style={{ fontSize: displayCols >= 4 ? '8px' : '10px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                              {item.itemName}
                            </p>
                          )}
                          {price > 0 && (
                            <p className="font-bold leading-none mt-0.5" style={{ fontSize: displayCols >= 4 ? '8px' : '10px', color: '#FFD580' }}>
                              HK${price.toLocaleString('en-HK')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Sold ribbon */}
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

                    {/* ── Buy button strip (non-compact only) ── */}
                    {showBuyBtn && (
                      isSold ? (
                        <button
                          onClick={() => setSoldItem(item)}
                          className="w-full flex items-center justify-center gap-1 py-1.5"
                          style={{
                            background: '#F3F4F6',
                            fontSize: displayCols >= 4 ? '9px' : '11px',
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
                            background: 'linear-gradient(135deg, #FF8C00, #FF6B00)',
                            fontSize: displayCols >= 4 ? '9px' : '11px',
                            color: '#fff',
                            fontWeight: 700,
                          }}
                        >
                          <ShoppingCart style={{ width: displayCols >= 4 ? '9px' : '11px', height: displayCols >= 4 ? '9px' : '11px' }} />
                          <span>立即落單</span>
                        </button>
                      )
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

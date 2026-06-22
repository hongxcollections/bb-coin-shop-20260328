import { useState, useRef } from "react";
import { X, Loader2, Images, ShoppingCart, MessageCircle, CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/pages/AdminAuctions";
import ImageLightbox from "@/components/ImageLightbox";

interface GalleryItem {
  id: number;
  galleryId: number;
  merchantId: number;
  itemName: string;
  itemNumber: string | null;
  price: string;
  currency: string;
  imageUrl: string;
  status: string;
  sortOrder: number;
  images?: Array<{ id: number; imageUrl: string }>;
}

function BuySheet({ item, onClose, onSuccess }: { item: GalleryItem; onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const price = parseFloat(item.price);

  const buyM = trpc.productGalleries.buyItem.useMutation({
    onSuccess: () => { setDone(true); onSuccess(); },
    onError: (e) => { toast.error(e.message, { className: 'bb-toast-err' }); setSubmitting(false); },
  });

  if (!user) {
    return (
      <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="font-bold text-gray-800 mb-1">請先登入</h2>
          <p className="text-sm text-gray-500 mb-5">登入後才可以購買商品</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">取消</button>
            <button onClick={() => { onClose(); navigate(`/login?from=${encodeURIComponent(window.location.pathname)}`); }}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold">登入</button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="font-bold text-gray-800 mb-1">購買成功！</h2>
          <p className="text-sm text-gray-500 mb-5">商戶會盡快聯繫你確認訂單</p>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold">完成</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          {item.imageUrl
            ? <img src={item.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
            : <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0"><Images className="w-6 h-6 text-gray-300" /></div>
          }
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 text-sm leading-snug truncate">{item.itemName}</p>
            {item.itemNumber && <p className="text-xs text-gray-400 mt-0.5">#{item.itemNumber}</p>}
            <p className="text-base font-bold text-amber-600 mt-0.5">{getCurrencySymbol(item.currency)}${Number(price).toLocaleString()}</p>
          </div>
        </div>
        <div className="p-4">
          <label className="block text-xs text-gray-500 mb-1 font-medium">備註（選填）</label>
          <textarea
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none resize-none"
            style={{ background: '#fff', borderRadius: 12 }}
            rows={2}
            placeholder="如有特別要求可填寫..."
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">取消</button>
            <button
              onClick={() => { setSubmitting(true); buyM.mutate({ itemId: item.id, buyerNote: note || undefined }); }}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
              確認購買
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoldPopup({ item, merchantId, onClose }: { item: GalleryItem; merchantId: number; onClose: () => void }) {
  const { user } = useAuth();
  const openChat = trpc.chat.openRoomByMerchant.useMutation({
    onSuccess: ({ roomId }) => { window.location.href = `/chat/${roomId}`; },
    onError: (e) => toast.error(e.message, { className: 'bb-toast-err' }),
  });
  return (
    <div className="fixed inset-0 z-[10001] flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl">🏷️</span>
        </div>
        <h2 className="font-bold text-gray-800 mb-1">此貨品已售出</h2>
        {item.itemName && <p className="text-sm text-gray-500 mb-1">{item.itemName}</p>}
        <p className="text-sm text-gray-400 mb-5">詳情可以聯繫商戶查詢</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm">關閉</button>
          {user
            ? <button onClick={() => openChat.mutate({ merchantId, productTitle: item.itemName || '圖集商品' })}
                disabled={openChat.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
                {openChat.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                聯繫商戶
              </button>
            : <button onClick={() => { onClose(); window.location.href = '/login'; }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold">
                登入後聯繫
              </button>
          }
        </div>
      </div>
    </div>
  );
}

export default function GallerySheet({ galleryId, onClose }: { galleryId: number; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = trpc.productGalleries.getPublic.useQuery(
    { id: galleryId },
    { refetchOnWindowFocus: false }
  );

  const gallery = (data as any)?.gallery;
  const merchantId = gallery?.merchantId;
  const allItems: GalleryItem[] = ((data as any)?.items ?? []);
  const items = allItems.filter((i: GalleryItem) => i.status !== 'hidden');
  const displayCols = gallery?.columnsPerRow ?? 3;

  const otherGalQ = trpc.productGalleries.listPublicByMerchant.useQuery(
    { merchantId: merchantId ?? 0 },
    { enabled: !!merchantId, refetchOnWindowFocus: false, staleTime: 60000 }
  );
  const otherGalleries = ((otherGalQ.data ?? []) as Array<{ id: number; title: string; activeItemCount: number; coverImageUrl: string | null; firstItemImage: string | null }>)
    .filter(g => g.id !== galleryId);

  const [otherGalOpen, setOtherGalOpen] = useState(false);
  const [buyingItem, setBuyingItem] = useState<GalleryItem | null>(null);
  const [soldItem, setSoldItem] = useState<GalleryItem | null>(null);
  const [localSold, setLocalSold] = useState<Set<number>>(new Set());
  const [lbImages, setLbImages] = useState<string[]>([]);
  const [lbIdx, setLbIdx] = useState(0);
  const [lbOpen, setLbOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  function openLightbox(item: GalleryItem, startIdx = 0) {
    const imgs: string[] = [];
    if (item.images && item.images.length > 0) {
      item.images.forEach(img => { if (img.imageUrl) imgs.push(img.imageUrl); });
    }
    if (imgs.length === 0 && item.imageUrl) imgs.push(item.imageUrl);
    if (imgs.length === 0) return;
    setLbImages(imgs);
    setLbIdx(startIdx);
    setLbOpen(true);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-[9999] flex flex-col rounded-t-2xl bg-white"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-sm flex-shrink-0">
              <Images className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-indigo-900 truncate">{gallery?.title ?? '圖片集'}</p>
              {gallery?.merchantName && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] text-gray-400 truncate flex-1">{gallery.merchantName}</p>
                  {otherGalleries.length > 0 && (
                    <button
                      type="button"
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                      onClick={() => setOtherGalOpen(v => !v)}
                    >
                      <span className="text-[10px] font-semibold" style={{ color: '#6366F1' }}>其他圖片集</span>
                      <span className="text-[10px] font-bold px-1 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366F1' }}>{otherGalleries.length}</span>
                      {otherGalOpen
                        ? <ChevronUp className="w-3 h-3 flex-shrink-0" style={{ color: '#6366F1' }} />
                        : <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: '#6366F1' }} />}
                    </button>
                  )}
                </div>
              )}
            </div>
            {gallery && (
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full flex-shrink-0">
                {items.filter(i => i.status === 'active' && !localSold.has(i.id)).length} 件
              </span>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
          {/* 其他圖片集 dropdown */}
          {otherGalleries.length > 0 && otherGalOpen && (
            <div
              className="flex gap-2.5 px-3 pb-2.5"
              style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
            >
              {otherGalleries.map(g => {
                const thumb = g.coverImageUrl || g.firstItemImage;
                return (
                  <button
                    key={g.id}
                    type="button"
                    className="flex-shrink-0 flex flex-col items-center gap-1 active:scale-95 transition-transform"
                    style={{ width: 64 }}
                    onClick={() => { onClose(); navigate(`/gallery/${g.id}`); }}
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.12)' }}>
                      {thumb
                        ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Images className="w-4 h-4" style={{ color: '#9CA3AF' }} />}
                    </div>
                    <p className="text-[9px] font-medium leading-tight text-center line-clamp-2" style={{ color: '#374151', maxWidth: 60 }}>{g.title}</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#16A34A' }}>
                      {g.activeItemCount} 件
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Images className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">暫無商品</p>
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
                  paddingTop: 8,
                  paddingBottom: 80,
                  width: 'max-content',
                  minWidth: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {items.map(item => {
                  const isSold = item.status === 'sold' || localSold.has(item.id);
                  const thumbUrl = item.images && item.images.length > 0
                    ? item.images[0].imageUrl
                    : item.imageUrl;
                  const colW = (window.innerWidth - 24) / 3;
                  const fontSize = displayCols <= 3 ? 10 : displayCols <= 5 ? 8 : 7;
                  const badgePad = displayCols <= 4 ? '2px 6px' : '1px 4px';

                  return (
                    <div
                      key={item.id}
                      className="relative flex flex-col"
                      style={{ width: colW, maxWidth: colW }}
                    >
                      <div
                        className="relative overflow-hidden"
                        style={{ borderRadius: displayCols <= 3 ? 10 : 6, aspectRatio: '1 / 1', width: '100%', background: '#F3F4F6', cursor: 'pointer' }}
                        onClick={() => openLightbox(item)}
                      >
                        {thumbUrl
                          ? <img src={thumbUrl} alt={item.itemName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                          : <div className="w-full h-full flex items-center justify-center"><Images className="text-gray-300" style={{ width: colW * 0.35, height: colW * 0.35 }} /></div>
                        }
                        {isSold && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                            <span className="text-white font-bold" style={{ fontSize: fontSize + 1 }}>已售</span>
                          </div>
                        )}
                        {item.itemNumber && !isSold && (
                          <div className="absolute top-1 left-1">
                            <span className="text-white font-bold" style={{ fontSize: fontSize - 1, background: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: '1px 4px' }}>
                              #{item.itemNumber}
                            </span>
                          </div>
                        )}
                      </div>

                      {displayCols <= 5 && (
                        <div style={{ paddingTop: 3, paddingBottom: 2 }}>
                          {item.itemName && (
                            <p style={{ fontSize, lineHeight: 1.3, color: '#374151', fontWeight: 500 }} className="line-clamp-2 leading-tight">
                              {item.itemName}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-0.5 gap-1">
                            <span style={{ fontSize, color: '#D97706', fontWeight: 700 }}>
                              {getCurrencySymbol(item.currency)}${Number(item.price).toLocaleString()}
                            </span>
                            {!isSold ? (
                              <button
                                onClick={() => setBuyingItem(item)}
                                style={{ fontSize: fontSize - 1, padding: badgePad, background: '#F59E0B', color: '#fff', borderRadius: 99, fontWeight: 700, flexShrink: 0 }}
                              >購</button>
                            ) : (
                              <button
                                onClick={() => setSoldItem(item)}
                                style={{ fontSize: fontSize - 1, padding: badgePad, background: '#EF4444', color: '#fff', borderRadius: 99, fontWeight: 700, flexShrink: 0 }}
                              >售</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lbOpen && lbImages.length > 0 && (
        <div style={{ zIndex: 10000, position: 'fixed', inset: 0 }}>
          <ImageLightbox
            images={lbImages}
            initialIndex={lbIdx}
            onClose={() => setLbOpen(false)}
          />
        </div>
      )}

      {/* Buy sheet */}
      {buyingItem && (
        <BuySheet
          item={buyingItem}
          onClose={() => setBuyingItem(null)}
          onSuccess={() => {
            setLocalSold(prev => new Set([...prev, buyingItem.id]));
            setBuyingItem(null);
          }}
        />
      )}

      {/* Sold popup */}
      {soldItem && (
        <SoldPopup
          item={soldItem}
          merchantId={soldItem.merchantId}
          onClose={() => setSoldItem(null)}
        />
      )}
    </>
  );
}

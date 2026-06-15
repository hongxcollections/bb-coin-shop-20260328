import { useState } from "react";
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

  // ── Lightbox ──
  if (lightboxSrc) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/92 flex items-center justify-center p-4"
        onClick={() => setLightboxSrc(null)}
      >
        <button
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          onClick={() => setLightboxSrc(null)}
        >
          <X className="w-5 h-5 text-white" />
        </button>
        <img
          src={lightboxSrc}
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={e => e.stopPropagation()}
          alt=""
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
                        onClick={() => setLightboxSrc(item.imageUrl)}
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

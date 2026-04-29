import { useState, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import ImageLightbox from "@/components/ImageLightbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { buildWhatsAppUrl } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import {
  Store, MessageCircle, Package, Gavel, ChevronLeft,
  Clock, Tag, ShoppingBag, ChevronLeft as Prev, ChevronRight as Next,
  ChevronDown, ChevronUp, Star, Phone, ShoppingCart, Loader2, X, CheckCircle2,
} from "lucide-react";

// ── 落單確認彈窗 ──
function BuyDialog({ product, onClose }: { product: any; onClose: () => void }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [orderedQty, setOrderedQty] = useState(0);
  const utils = trpc.useUtils();
  const price = parseFloat(product?.price ?? "0");
  const currSymbol = product?.currency ?? "HKD";

  const createOrder = trpc.productOrders.create.useMutation({
    onSuccess: () => {
      utils.merchants.listProducts.invalidate();
      setOrderedQty(qty);
      setOrdered(true);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <ShoppingCart className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">請先登入</p>
          <p className="text-sm text-gray-500 mb-4">登入後才可落單購買</p>
          <button onClick={() => { onClose(); navigate(`/login?from=${encodeURIComponent(window.location.pathname + window.location.search)}`); }}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors">前往登入</button>
          <button onClick={onClose} className="w-full mt-2 text-sm text-gray-400 py-2">取消</button>
        </div>
      </div>
    );
  }

  if (product?.merchantId === user.id) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <span className="text-4xl mb-3 block">🚫</span>
          <p className="font-semibold text-gray-800 mb-1">不能購買自己的商品</p>
          <p className="text-sm text-gray-500 mb-4">此商品屬於你的商戶帳號</p>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-200">關閉</button>
        </div>
      </div>
    );
  }

  if (ordered) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 pb-20" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-green-500" />
          </div>
          <h2 className="font-bold text-gray-800 text-lg mb-1">落單成功！</h2>
          <p className="text-sm text-gray-500 mb-2">已成功落單 <span className="font-semibold text-gray-700">{orderedQty} 件</span></p>
          <div className="bg-amber-50 rounded-xl px-4 py-2.5 mb-4 text-left">
            <p className="text-sm font-medium text-gray-800 line-clamp-2">{product?.title}</p>
            <p className="text-amber-600 font-bold text-sm mt-0.5">{currSymbol} ${(price * orderedQty).toLocaleString()}</p>
          </div>
          <p className="text-sm text-gray-500 mb-6">請等候商戶確認成交，確認後我們會通知你。</p>
          <button onClick={onClose} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors">完成</button>
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
          <button onClick={onClose} className="ml-auto p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" aria-label="關閉">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 space-y-1">
          <p className="font-semibold text-gray-800 text-sm line-clamp-2">{product?.title}</p>
          <p className="text-amber-600 font-bold">{currSymbol} ${price.toLocaleString()}</p>
          <p className="text-xs text-gray-500">庫存：{product?.stock} 件</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">數量</label>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-full border border-amber-200 text-amber-600 font-bold text-lg flex items-center justify-center hover:bg-amber-50">−</button>
            <span className="text-lg font-bold text-gray-800 w-8 text-center">{qty}</span>
            <button onClick={() => setQty(q => Math.min(product?.stock ?? 1, q + 1))}
              className="w-8 h-8 rounded-full border border-amber-200 text-amber-600 font-bold text-lg flex items-center justify-center hover:bg-amber-50">+</button>
            <span className="text-sm text-gray-500 ml-auto">合計：<span className="text-amber-600 font-bold">{currSymbol}${(price * qty).toLocaleString()}</span></span>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">備注（選填）</label>
          <textarea className="w-full border border-gray-200 rounded-xl p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300"
            rows={2} maxLength={200} placeholder="如有特別要求請在此說明…"
            value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5">落單後商戶會聯絡你確認成交，傭金於商戶確認後才自動扣除。</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50">取消</button>
          <button disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                let buyerPushEndpoint: string | undefined;
                try {
                  const swReady = navigator.serviceWorker?.ready;
                  if (swReady) {
                    const timeout = new Promise<undefined>((res) => setTimeout(() => res(undefined), 1500));
                    const reg = await Promise.race([swReady, timeout]);
                    const sub = await reg?.pushManager?.getSubscription();
                    if (sub?.endpoint) buyerPushEndpoint = sub.endpoint;
                  }
                } catch {}
                await createOrder.mutateAsync({ productId: product.id, quantity: qty, buyerNote: note || undefined, buyerPushEndpoint });
              } catch {} finally {
                setSubmitting(false);
              }
            }}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            {submitting ? "處理中…" : "確認落單"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuctionCountdown({ endTime }: { endTime: string | Date }) {
  const end = new Date(endTime);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return <span className="text-red-500 text-[10px]">已結束</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return <span className="text-gray-500 text-[10px]">{Math.floor(h / 24)}天後</span>;
  if (h >= 1) return <span className="text-amber-600 text-[10px]">{h}時{m}分</span>;
  return <span className="text-red-500 text-[10px] font-semibold">{m}分鐘</span>;
}

export default function MerchantProductDetail() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id ?? "0", 10);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imgTouchStartX = useRef(0);
  const imgTouchStartY = useRef(0);
  const touchOpenedLightbox = useRef(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [buyingProduct, setBuyingProduct] = useState<any | null>(null);
  const { user } = useAuth();

  const { data: product, isLoading, error } = trpc.merchants.getPublicProduct.useQuery(
    { id: productId },
    { enabled: productId > 0 }
  );

  const { data: allProducts = [] } = trpc.merchants.listProducts.useQuery(
    { merchantId: product?.merchantId },
    { enabled: !!product?.merchantId }
  );

  const { data: auctionItems = [] } = trpc.merchants.getMerchantAuctions.useQuery(
    { userId: product?.merchantId ?? 0 },
    { enabled: !!product?.merchantId }
  );

  const { data: allMerchants = [] } = trpc.merchants.listApprovedMerchants.useQuery();
  const merchantInfo = (allMerchants as any[]).find((m: any) => m.userId === product?.merchantId);

  const { data: merchantDetail, isLoading: merchantLoading } = trpc.merchants.getPublicMerchant.useQuery(
    { userId: product?.merchantId ?? 0 },
    { enabled: !!product?.merchantId }
  );

  const { data: siteSettingsData } = trpc.siteSettings.getAll.useQuery();
  const merchantContactPreset = (siteSettingsData as Record<string, string> | undefined)?.merchantContactMessage ?? "你好，我想查詢你的商品";

  const imgs: string[] = (() => {
    try { return product?.images ? JSON.parse(product.images) : []; } catch { return []; }
  })();

  const otherProducts = (allProducts as any[]).filter(
    (p: any) => p.id !== productId && p.status === "active" && p.stock > 0
  );

  if (!productId || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <Package className="w-10 h-10 opacity-30" />
          <p>找不到此商品</p>
          <Link href="/merchants" className="text-amber-600 text-sm underline">返回商戶市集</Link>
        </div>
      </div>
    );
  }

  const price = parseFloat(product?.price ?? "0");
  // 只採用包含 ≥7 位數字的 whatsapp（過濾 "222" 等測試/無效資料）
  const _productWa = product?.whatsapp ?? "";
  const _productWaDigits = _productWa.replace(/[^0-9]/g, "");
  const whatsapp = _productWaDigits.length >= 7 ? _productWa : (merchantInfo?.whatsapp ?? "");
  const productUrl = `${window.location.origin}/merchant-products/${productId}`;
  const waLink = buildWhatsAppUrl(whatsapp, `你好，我想查詢以下商品：\n商品：${product?.title}\n價錢：HK$${price.toLocaleString()}\n連結：${productUrl}`);
  const fbRaw = (merchantDetail as any)?.facebook ?? "";
  const messengerLink = fbRaw
    ? (fbRaw.startsWith("http") ? fbRaw : `https://m.me/${fbRaw}`)
    : "";

  const messengerMessage = `你好，我想查詢以下商品：\n商品：${product?.title ?? ""}\n價錢：HK$${price.toLocaleString()}\n連結：${productUrl}`;

  const handleMessengerClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(messengerMessage);
      } else {
        const ta = document.createElement("textarea");
        ta.value = messengerMessage;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("商品資訊已複製，請在 Messenger 對話內長按輸入欄貼上", { duration: 5000 });
    } catch {
      toast.error("複製失敗，請手動輸入商品名稱");
    }
    window.open(messengerLink, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* 返回 */}
        <button onClick={() => history.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-amber-600 transition-colors">
          <ChevronLeft className="w-4 h-4" />返回
        </button>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-amber-100 p-5 animate-pulse space-y-3">
            <div className="w-full aspect-square bg-amber-50 rounded-xl" />
            <div className="h-4 bg-amber-50 rounded w-3/4" />
            <div className="h-3 bg-amber-50 rounded w-1/2" />
          </div>
        ) : product ? (
          <>
            {/* ── 商品主卡 ── */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
              {/* 圖片 gallery */}
              {imgs.length > 0 ? (
                <div className="relative">
                  <div
                    className="w-full aspect-square bg-amber-50 overflow-hidden cursor-zoom-in select-none"
                    onTouchStart={e => {
                      imgTouchStartX.current = e.touches[0].clientX;
                      imgTouchStartY.current = e.touches[0].clientY;
                      touchOpenedLightbox.current = false;
                    }}
                    onTouchEnd={e => {
                      const dx = imgTouchStartX.current - e.changedTouches[0].clientX;
                      const dy = imgTouchStartY.current - e.changedTouches[0].clientY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      if (Math.abs(dx) >= 40 && imgs.length > 1) {
                        setImgIdx(i => dx > 0 ? (i + 1) % imgs.length : (i - 1 + imgs.length) % imgs.length);
                      } else if (dist < 10) {
                        touchOpenedLightbox.current = true;
                        setLightboxOpen(true);
                      }
                    }}
                    onClick={() => {
                      if (!touchOpenedLightbox.current) setLightboxOpen(true);
                      touchOpenedLightbox.current = false;
                    }}
                  >
                    <img src={imgs[imgIdx]} alt={product.title} draggable={false}
                      className="w-full h-full object-cover pointer-events-none"
                      style={{ WebkitTouchCallout: 'none' }} />
                  </div>
                  {imgs.length > 1 && (
                    <>
                      <button
                        onTouchEnd={e => e.stopPropagation()}
                        onClick={() => setImgIdx(i => (i - 1 + imgs.length) % imgs.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
                      ><Prev className="w-4 h-4 text-gray-600" /></button>
                      <button
                        onTouchEnd={e => e.stopPropagation()}
                        onClick={() => setImgIdx(i => (i + 1) % imgs.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 rounded-full flex items-center justify-center shadow"
                      ><Next className="w-4 h-4 text-gray-600" /></button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {imgs.map((_, i) => (
                          <button key={i}
                            onTouchEnd={e => e.stopPropagation()}
                            onClick={() => setImgIdx(i)}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? "bg-amber-500" : "bg-white/60"}`} />
                        ))}
                      </div>
                    </>
                  )}
                  {imgs.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/40 text-white text-xs px-1.5 py-0.5 rounded-full pointer-events-none">
                      {imgIdx + 1}/{imgs.length}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full aspect-square bg-amber-50 flex items-center justify-center">
                  <Package className="w-16 h-16 text-amber-200" />
                </div>
              )}

              {/* 縮圖列 */}
              {imgs.length > 1 && (
                <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {imgs.map((u, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIdx ? "border-amber-400" : "border-transparent"}`}>
                      <img src={u} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* 商品資料 */}
              <div className="p-4 space-y-3">
                {/* 商戶名稱行 + accordion */}
                <button
                  onClick={() => setMerchantOpen(o => !o)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  {product.merchantIcon ? (
                    <img src={product.merchantIcon} alt={product.merchantName} className="w-7 h-7 rounded-full object-cover border border-amber-200 flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Store className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                  )}
                  <span className="text-sm text-amber-700 font-medium flex-1">{product.merchantName}</span>
                  <span className="flex items-center gap-0.5 text-xs text-gray-400">
                    查看商戶{merchantOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </span>
                </button>

                {/* 展開：商戶公開申請資料 */}
                {merchantOpen && (
                  <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 space-y-3 text-sm">
                    {merchantLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-3 bg-amber-200/60 rounded w-3/4" />
                        <div className="h-3 bg-amber-200/60 rounded w-1/2" />
                      </div>
                    ) : (() => {
                      const md = merchantDetail as any;
                      const icon = md?.merchantIcon ?? product.merchantIcon ?? "";
                      const name = md?.merchantName ?? product.merchantName ?? "";
                      const cats: string[] = (() => { try { return md?.categories ? JSON.parse(md.categories) : []; } catch { return []; } })();
                      const samples: string[] = (() => { try { return md?.samplePhotos ? JSON.parse(md.samplePhotos) : []; } catch { return []; } })();
                      const _rawWa = md?.whatsapp ?? "";
                      const _rawWaDigits = _rawWa.replace(/[^0-9]/g, "");
                      const wa = _rawWaDigits.length >= 7 ? _rawWa : (product.whatsapp && product.whatsapp.replace(/[^0-9]/g, "").length >= 7 ? product.whatsapp : "");
                      const merchantUrl = `${window.location.origin}/merchants/${product.merchantId}`;
                      const merchantContactMsg = `${merchantContactPreset}\n${merchantUrl}`;
                      const accordionWaLink = buildWhatsAppUrl(wa, merchantContactMsg);
                      const handleMerchantMessenger = async (e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.preventDefault();
                        try {
                          if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(merchantContactMsg);
                          } else {
                            const ta = document.createElement("textarea");
                            ta.value = merchantContactMsg;
                            ta.style.position = "fixed";
                            ta.style.opacity = "0";
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand("copy");
                            document.body.removeChild(ta);
                          }
                          toast.success("商戶資訊已複製，請在 Messenger 對話內長按輸入欄貼上", { duration: 5000 });
                        } catch {
                          toast.error("複製失敗，請手動輸入");
                        }
                        window.open(messengerLink, "_blank", "noopener,noreferrer");
                      };
                      return (
                        <>
                          {/* 名稱 + 年資 */}
                          <div className="flex items-center gap-2">
                            {icon ? (
                              <img src={icon} alt={name} className="w-10 h-10 rounded-full object-cover border-2 border-amber-200" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                                <Store className="w-5 h-5 text-amber-600" />
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{name}</p>
                              {md?.yearsExperience && (
                                <p className="flex items-center gap-0.5 text-xs text-amber-600">
                                  <Star className="w-3 h-3" />錢幣經驗 {md.yearsExperience}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 自我介紹 */}
                          {md?.selfIntro && (
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{md.selfIntro}</p>
                          )}

                          {/* 銷售類別 */}
                          {cats.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {cats.map((c: string) => (
                                <span key={c} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{c}</span>
                              ))}
                            </div>
                          )}

                          {/* 示範照片 */}
                          {samples.length > 0 && (
                            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                              {samples.map((u: string, i: number) => (
                                <img key={i} src={u} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-amber-100" />
                              ))}
                            </div>
                          )}

                          {/* 聯絡 + 跳頁 */}
                          <div className="flex gap-2 pt-1 flex-wrap">
                            {accordionWaLink && (
                              <a href={accordionWaLink} target="_blank" rel="noopener noreferrer"
                                className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 bg-green-500 text-white text-xs font-semibold rounded-lg">
                                <Phone className="w-3.5 h-3.5" />WhatsApp
                              </a>
                            )}
                            {messengerLink && (
                              <a href={messengerLink} onClick={handleMerchantMessenger} target="_blank" rel="noopener noreferrer"
                                className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg">
                                <MessageCircle className="w-3.5 h-3.5" />Messenger
                              </a>
                            )}
                            <Link href={`/merchants/${product.merchantId}`}
                              className="flex-1 min-w-[80px] flex items-center justify-center gap-1.5 py-2 bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg">
                              <Store className="w-3.5 h-3.5" />商戶主頁
                            </Link>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="h-px bg-gray-100" />

                {/* 標題 */}
                <h1 className="font-bold text-gray-900 text-base leading-snug">{product.title}</h1>

                {/* 分類 tag（獨立一行，多個逗號分隔各自一個） */}
                {product.category && (
                  <div className="flex flex-wrap gap-1.5">
                    {product.category.split(",").map((tag: string) => tag.trim()).filter(Boolean).map((tag: string) => (
                      <span key={tag} className="flex items-center gap-0.5 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <Tag className="w-3 h-3 shrink-0" />{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 描述 */}
                {product.description && (
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
                )}

                {/* 出售價錢 + 庫存 */}
                <div className="flex items-end justify-between pt-1">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">出售價錢</p>
                    <span className="text-2xl font-bold text-amber-600">{product.currency} ${price.toLocaleString()}</span>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {product.stock > 0 ? `庫存 ${product.stock} 件` : "已售出"}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    product.stock > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {product.stock > 0 ? "有貨" : "售罄"}
                  </span>
                </div>

                {/* 落單按鈕 */}
                {product.stock > 0 && (
                  (() => {
                    const isOwn = user != null && product.merchantId === user.id;
                    return isOwn ? (
                      <div className="flex items-center justify-center gap-2 py-3 bg-gray-100 rounded-xl text-sm font-semibold text-gray-400 cursor-not-allowed select-none">
                        🚫 此商品屬於你的商戶帳號，不能自行落單
                      </div>
                    ) : (
                      <button
                        onClick={() => setBuyingProduct(product)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                      >
                        <ShoppingCart className="w-4 h-4" />立即落單
                      </button>
                    );
                  })()
                )}

                {/* 聯絡按鈕 */}
                {product.stock > 0 && (waLink || messengerLink) && (
                  <div className={`flex gap-2 ${waLink && messengerLink ? "flex-row" : ""}`}>
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors ${messengerLink ? "flex-1" : "w-full"}`}>
                        <MessageCircle className="w-4 h-4" />WhatsApp
                      </a>
                    )}
                    {messengerLink && (
                      <a href={messengerLink} onClick={handleMessengerClick} target="_blank" rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors ${waLink ? "flex-1" : "w-full"}`}>
                        <MessageCircle className="w-4 h-4" />Messenger
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── 同商戶其他出售商品 ── */}
            {otherProducts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  <h2 className="font-semibold text-sm text-gray-800">更多出售商品</h2>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ml-auto">{otherProducts.length} 件</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {otherProducts.map((p: any) => {
                    const pImgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
                    const pPrice = parseFloat(p.price ?? "0");
                    const _pWa = (p.whatsapp ?? "").toString();
                    const _pWaDigits = _pWa.replace(/[^0-9]/g, "");
                    const _mWaDigits = (whatsapp ?? "").toString().replace(/[^0-9]/g, "");
                    const pEffWa = _mWaDigits.length >= 7 ? whatsapp : (_pWaDigits.length >= 7 ? _pWa : "");
                    const pProductUrl = `${window.location.origin}/merchant-products/${p.id}`;
                    const pMsg = `你好，我想查詢以下商品：\n商品：${p.title}\n價錢：HK$${pPrice.toLocaleString()}\n連結：${pProductUrl}`;
                    const pWaLink = pEffWa ? buildWhatsAppUrl(pEffWa, pMsg) : "";
                    const handlePMessenger = async (e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(pMsg);
                        toast.success("商品資訊已複製，請在 Messenger 對話內長按輸入欄貼上", { duration: 5000 });
                      } catch { toast.error("複製失敗，請手動輸入"); }
                      window.open(messengerLink, "_blank", "noopener,noreferrer");
                    };
                    return (
                      <Link key={p.id} href={`/merchant-products/${p.id}`}>
                        <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-amber-300 transition-colors">
                          {pImgs[0] ? (
                            <div className="aspect-square w-full overflow-hidden bg-amber-50">
                              <img src={pImgs[0]} alt={p.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="aspect-square w-full bg-amber-50 flex items-center justify-center">
                              <Package className="w-8 h-8 text-amber-200" />
                            </div>
                          )}
                          <div className="p-2 flex flex-col gap-1 flex-1">
                            <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{p.title}</h3>
                            {p.category && <span className="text-[10px] text-amber-600">{p.category}</span>}
                            <span className="font-bold text-amber-600 text-xs">{p.currency ?? "HKD"} ${pPrice.toLocaleString()}</span>
                            <div className="mt-auto pt-1 flex items-center justify-end gap-1">
                              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                {p.merchantId === user?.id ? (
                                  <span className="flex items-center gap-0.5 bg-gray-100 text-gray-400 text-[10px] font-semibold px-2 py-1 rounded-full cursor-not-allowed">🚫 自己</span>
                                ) : (
                                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); setBuyingProduct(p); }}
                                    className="flex items-center gap-0.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold px-2 py-1 rounded-full transition-colors shadow-sm">
                                    <ShoppingCart className="w-2.5 h-2.5" />落單
                                  </button>
                                )}
                                {pWaLink && (
                                  <a href={pWaLink} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp 聯絡"
                                    className="w-6 h-6 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors shadow-sm">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.15-.174.2-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                  </a>
                                )}
                                {messengerLink && (
                                  <a href={messengerLink} onClick={handlePMessenger} target="_blank" rel="noopener noreferrer" aria-label="Messenger 聯絡"
                                    className="w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-sm">
                                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.13 3.26L19.752 8l-6.561 6.963z"/></svg>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 同商戶拍賣中商品 ── */}
            {(auctionItems as any[]).length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-purple-500" />
                  <h2 className="font-semibold text-sm text-gray-800">拍賣中商品</h2>
                  <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full ml-auto">{(auctionItems as any[]).length} 件</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(auctionItems as any[]).map((a: any) => {
                    const aPrice = parseFloat(a.currentPrice ?? a.startingPrice ?? "0");
                    return (
                      <Link key={a.id} href={`/auctions/${a.id}`}>
                        <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-purple-300 transition-colors">
                          {a.coverImage ? (
                            <div className="aspect-square w-full overflow-hidden bg-purple-50">
                              <img src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="aspect-square w-full bg-purple-50 flex items-center justify-center">
                              <Gavel className="w-8 h-8 text-purple-200" />
                            </div>
                          )}
                          <div className="p-2 flex flex-col gap-0.5 flex-1">
                            <h3 className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{a.title}</h3>
                            {a.category && <span className="text-[10px] text-purple-500">{a.category}</span>}
                            <div className="flex items-center justify-between mt-auto pt-0.5">
                              <span className="font-bold text-amber-600 text-xs">{a.currency ?? "HKD"} ${aPrice.toLocaleString()}</span>
                              <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                <Clock className="w-2.5 h-2.5" />
                                <AuctionCountdown endTime={a.endTime} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* 落單彈窗 */}
      {buyingProduct && <BuyDialog product={buyingProduct} onClose={() => setBuyingProduct(null)} />}

      {/* 大圖燈箱 */}
      {lightboxOpen && imgs.length > 0 && (
        <ImageLightbox
          images={imgs}
          initialIndex={imgIdx}
          alt={product?.title}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

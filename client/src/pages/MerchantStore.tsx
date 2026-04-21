import { useParams, Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import Header from "@/components/Header";
import { Store, MessageCircle, Package, Gavel, ChevronLeft, Clock, Tag } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils";

type LayoutMode = "list" | "grid2" | "grid3" | "big";

function WhatsAppBtn({ whatsapp, title, price, id }: { whatsapp: string; title: string; price?: number; id?: number }) {
  const productUrl = id ? `${window.location.origin}/merchant-products/${id}` : "";
  const msg = `你好，我想查詢以下商品：\n商品：${title}${price !== undefined ? `\n價錢：HK$${price.toLocaleString()}` : ""}${productUrl ? `\n連結：${productUrl}` : ""}`;
  const link = buildWhatsAppUrl(whatsapp, msg);
  return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1.5 rounded-full transition-colors shrink-0">
      <MessageCircle className="w-3 h-3" />WhatsApp
    </a>
  );
}

function ProductsList({ products, layout, whatsapp }: { products: any[]; layout: LayoutMode; whatsapp: string }) {
  if (products.length === 0) return <p className="text-center text-gray-400 text-sm py-6">暫無出售商品</p>;

  if (layout === "list") {
    return (
      <div className="space-y-2">
        {products.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-3 flex gap-3 items-start cursor-pointer hover:border-amber-300 transition-colors">
              {imgs[0] ? (
                <img src={imgs[0]} alt={p.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Package className="w-6 h-6 text-amber-200" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 line-clamp-1">{p.title}</h3>
                {p.category && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{p.category}</span>}
                {p.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.description}</p>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-bold text-amber-600 text-sm">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
                  {p.stock > 0 && whatsapp ? <WhatsAppBtn whatsapp={whatsapp} title={p.title} price={price} id={p.id} /> : p.stock <= 0 ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已售出</span> : null}
                </div>
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    );
  }

  if (layout === "big") {
    return (
      <div className="space-y-4">
        {products.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden cursor-pointer hover:border-amber-300 transition-colors">
              {imgs[0] ? (
                <img src={imgs[0]} alt={p.title} className="w-full h-56 object-cover" />
              ) : (
                <div className="w-full h-56 bg-amber-50 flex items-center justify-center">
                  <Package className="w-10 h-10 text-amber-200" />
                </div>
              )}
              {imgs.length > 1 && (
                <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {imgs.slice(1).map((u, i) => (
                    <img key={i} src={u} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-amber-100" />
                  ))}
                </div>
              )}
              <div className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-800 line-clamp-2 text-sm flex-1">{p.title}</h3>
                  {p.category && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{p.category}</span>}
                </div>
                {p.description && <p className="text-xs text-gray-500 line-clamp-3">{p.description}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-amber-600 text-base">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
                  {p.stock > 0 && whatsapp ? <WhatsAppBtn whatsapp={whatsapp} title={p.title} price={price} id={p.id} /> : p.stock <= 0 ? <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">已售出</span> : null}
                </div>
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    );
  }

  if (layout === "grid3") {
    return (
      <div className="grid grid-cols-3 gap-2">
        {products.map((p: any) => {
          const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
          const price = parseFloat(p.price ?? "0");
          return (
            <Link key={p.id} href={`/merchant-products/${p.id}`}>
            <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-amber-300 transition-colors">
              {imgs[0] ? (
                <img src={imgs[0]} alt={p.title} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-amber-50 flex items-center justify-center">
                  <Package className="w-5 h-5 text-amber-200" />
                </div>
              )}
              <div className="p-1.5 flex flex-col gap-0.5 flex-1">
                <h3 className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight">{p.title}</h3>
                <span className="text-[10px] font-bold text-amber-600">${price.toLocaleString()}</span>
                {p.stock > 0 && whatsapp ? (
                  <a href={buildWhatsAppUrl(whatsapp, `你好，我想查詢以下商品：\n商品：${p.title}\n價錢：HK$${price.toLocaleString()}\n連結：${window.location.origin}/merchant-products/${p.id}`)}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-auto text-[9px] py-0.5 bg-green-50 text-green-600 rounded text-center">
                    WhatsApp
                  </a>
                ) : p.stock <= 0 ? (
                  <span className="mt-auto text-[9px] py-0.5 bg-gray-100 text-gray-400 rounded text-center">已售出</span>
                ) : null}
              </div>
            </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {products.map((p: any) => {
        const imgs: string[] = (() => { try { return p.images ? JSON.parse(p.images) : []; } catch { return []; } })();
        const price = parseFloat(p.price ?? "0");
        return (
          <Link key={p.id} href={`/merchant-products/${p.id}`}>
          <div className="bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-amber-300 transition-colors">
            {imgs[0] ? (
              <div className="aspect-square w-full overflow-hidden bg-amber-50">
                <img src={imgs[0]} alt={p.title} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="aspect-square w-full bg-amber-50 flex items-center justify-center">
                <Package className="w-10 h-10 text-amber-200" />
              </div>
            )}
            <div className="p-2.5 flex flex-col gap-1 flex-1">
              <div className="flex items-start justify-between gap-1">
                <h3 className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 flex-1">{p.title}</h3>
                {p.category && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded-full shrink-0">{p.category}</span>}
              </div>
              {p.description && <p className="text-[10px] text-gray-500 line-clamp-2">{p.description}</p>}
              <div className="mt-auto pt-1.5 flex items-center justify-between gap-1">
                <span className="font-bold text-amber-600 text-xs">{p.currency ?? "HKD"} ${price.toLocaleString()}</span>
                {p.stock > 0 && whatsapp ? <WhatsAppBtn whatsapp={whatsapp} title={p.title} price={price} id={p.id} /> : p.stock <= 0 ? <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">已售出</span> : null}
              </div>
            </div>
          </div>
          </Link>
        );
      })}
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

export default function MerchantStore() {
  const params = useParams<{ userId: string }>();
  const userId = parseInt(params.userId ?? "0", 10);

  const { data: merchant, isLoading: loadingMerchant, error } = trpc.merchants.getPublicMerchant.useQuery(
    { userId },
    { enabled: userId > 0 }
  );

  const { data: products = [], isLoading: loadingProducts } = trpc.merchants.listProducts.useQuery(
    { merchantId: userId },
    { enabled: userId > 0 }
  );

  const { data: auctionItems = [], isLoading: loadingAuctions } = trpc.merchants.getMerchantAuctions.useQuery(
    { userId },
    { enabled: userId > 0 }
  );

  const { data: siteSettingsData } = trpc.siteSettings.getAll.useQuery();
  const merchantContactPreset = (siteSettingsData as Record<string, string> | undefined)?.merchantContactMessage ?? "你好，我想查詢你的商品";

  const { data: allMerchants = [] } = trpc.merchants.listApprovedMerchants.useQuery();
  const merchantLayout = (allMerchants as any[]).find((m: any) => m.userId === userId)?.listingLayout as LayoutMode ?? "grid2";

  const activeProducts = (products as any[]).filter((p: any) => p.status === "active" && p.stock > 0);
  const categories = merchant?.categories ? merchant.categories.split(",").map((c: string) => c.trim()).filter(Boolean) : [];

  if (!userId || error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
          <Store className="w-10 h-10 opacity-30" />
          <p>找不到該商戶</p>
          <Link href="/merchants" className="text-amber-600 text-sm underline">返回商戶市集</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* 返回 */}
        <Link href="/merchants" className="flex items-center gap-1 text-sm text-gray-500 hover:text-amber-600 transition-colors">
          <ChevronLeft className="w-4 h-4" />返回商戶市集
        </Link>

        {/* 商戶資料卡 */}
        {loadingMerchant ? (
          <div className="bg-white rounded-2xl border border-amber-100 p-5 animate-pulse space-y-3">
            <div className="flex gap-3 items-center">
              <div className="w-14 h-14 rounded-full bg-amber-100" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-amber-100 rounded w-1/2" />
                <div className="h-3 bg-amber-50 rounded w-3/4" />
              </div>
            </div>
          </div>
        ) : merchant ? (
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3">
              {merchant.merchantIcon ? (
                <img src={merchant.merchantIcon} alt={merchant.merchantName} className="w-14 h-14 rounded-full object-cover border-2 border-amber-200 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Store className="w-6 h-6 text-amber-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-gray-900 text-base leading-tight">{merchant.merchantName}</h1>
                {merchant.selfIntro && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{merchant.selfIntro}</p>
                )}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {categories.map((cat: string) => (
                      <span key={cat} className="flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <Tag className="w-2.5 h-2.5" />{cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {(() => {
              const fbRaw = (merchant as any)?.facebook ?? "";
              const messengerLink = fbRaw
                ? (fbRaw.startsWith("http") ? fbRaw : `https://m.me/${fbRaw}`)
                : "";
              const merchantUrl = `${window.location.origin}/merchants/${userId}`;
              const contactMsg = `${merchantContactPreset}\n${merchantUrl}`;
              const waLink = merchant.whatsapp ? buildWhatsAppUrl(merchant.whatsapp, contactMsg) : "";
              if (!waLink && !messengerLink) return null;
              const handleMessenger = async (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(contactMsg);
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = contactMsg;
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
                <div className={`flex gap-2 ${waLink && messengerLink ? "flex-row" : ""}`}>
                  {waLink && (
                    <a href={waLink} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors ${messengerLink ? "flex-1" : "w-full"}`}>
                      <MessageCircle className="w-4 h-4" />WhatsApp
                    </a>
                  )}
                  {messengerLink && (
                    <a href={messengerLink} onClick={handleMessenger} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors ${waLink ? "flex-1" : "w-full"}`}>
                      <MessageCircle className="w-4 h-4" />Messenger
                    </a>
                  )}
                </div>
              );
            })()}
          </div>
        ) : null}

        {/* 出售商品 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-sm text-gray-800">出售商品</h2>
            {!loadingProducts && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ml-auto">{activeProducts.length} 件</span>
            )}
          </div>
          {loadingProducts ? (
            <div className="text-center py-8 text-2xl animate-spin">💰</div>
          ) : (
            <ProductsList
              products={activeProducts}
              layout={merchantLayout}
              whatsapp={merchant?.whatsapp ?? ""}
            />
          )}
        </div>

        {/* 拍賣中商品 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-purple-500" />
            <h2 className="font-semibold text-sm text-gray-800">拍賣中商品</h2>
            {!loadingAuctions && (
              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full ml-auto">{(auctionItems as any[]).length} 件</span>
            )}
          </div>
          {loadingAuctions ? (
            <div className="text-center py-8 text-2xl animate-spin">🔨</div>
          ) : (auctionItems as any[]).length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">暫無拍賣中商品</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(auctionItems as any[]).map((a: any) => {
                const price = parseFloat(a.currentPrice ?? a.startingPrice ?? "0");
                return (
                  <Link key={a.id} href={`/auctions/${a.id}`}>
                    <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden flex flex-col hover:border-purple-300 transition-colors cursor-pointer">
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
                        {a.category && <span className="text-[10px] text-purple-600">{a.category}</span>}
                        <div className="mt-auto pt-1 flex items-center justify-between gap-1">
                          <span className="font-bold text-amber-600 text-xs">{a.currency ?? "HKD"} ${price.toLocaleString()}</span>
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
          )}
        </div>
      </div>
    </div>
  );
}

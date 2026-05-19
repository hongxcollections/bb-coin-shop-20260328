import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";
import { ShareMenu, SessionShareMenu } from "@/components/ShareMenu";
import { QuickBidPopover } from "@/components/QuickBidPopover";
import { AuctionCard } from "@/components/AuctionCard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Clock, Package, Users, Store, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { sanitizeUserText } from "@/lib/utils";

function getCurrencySymbol(c?: string) {
  switch (c) {
    case "USD": return "US$"; case "CNY": return "¥"; case "GBP": return "£";
    case "EUR": return "€"; case "JPY": return "¥"; default: return "HK$";
  }
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

function fmtCountdown(target: number, now: number): string {
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  if (diff === 0) return "已結束";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}日 ${h}小時 ${m}分`;
  if (h > 0) return `${h}小時 ${m}分 ${s}秒`;
  return `${m}分 ${s}秒`;
}

function AuctionImageOverlay({ endTime }: { endTime: Date | string }) {
  const [txt, setTxt] = useState("");
  const [urgent, setUrgent] = useState(false);
  useEffect(() => {
    function update() {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setTxt(""); return; }
      const totalHours = diff / 3600000;
      if (totalHours > 12) {
        const days = Math.floor(diff / 86400000);
        const remH = Math.floor((diff % 86400000) / 3600000);
        setTxt(days >= 1 ? (remH > 0 ? `${days}天${remH}h後` : `${days}天後`) : `${Math.floor(totalHours)}h後`);
        setUrgent(false);
      } else {
        const h = Math.floor(totalHours);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        setTxt(h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
        setUrgent(diff < 3600000);
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  if (!txt) return null;
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 pointer-events-none">
      {urgent
        ? <div className="flex items-center gap-0.5 text-[10px] font-black leading-none animate-pulse bg-red-600 text-white px-1 py-0.5 rounded self-start inline-flex">
            <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
          </div>
        : <div className="flex items-center gap-0.5 text-[10px] font-bold leading-none text-white">
            <Clock className="w-2.5 h-2.5 shrink-0" />{txt}
          </div>
      }
    </div>
  );
}

export default function MerchantSessionPublic() {
  const [, params] = useRoute<{ userId: string; slug: string }>("/s/:userId/:slug");
  const merchantUserId = params ? parseInt(params.userId, 10) : 0;
  const slug = params?.slug || "";
  const now = useNow();
  const [qrOpen, setQrOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "leading">("all");
  const listRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  const scrollToList = () => {
    setTimeout(() => {
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const { data, isLoading, error } = trpc.merchantSessions.getPublic.useQuery(
    { merchantUserId, slug },
    {
      enabled: merchantUserId > 0 && !!slug,
      retry: false,
      // 已結束唔洗高頻 refetch；進行中每 8 秒更新
      refetchInterval: (d: any) => {
        const s = d?.session;
        if (!s) return 8000;
        if (s.status === 'ended') return false;
        const eMs = new Date(s.endAt).getTime();
        return eMs <= Date.now() ? false : 8000;
      },
      refetchOnWindowFocus: true,
    }
  );

  const session = data?.session;
  const auctions = data?.auctions || [];
  const merchantName = data?.merchantName || "商戶";
  const merchantIcon = data?.merchantIcon || null;
  const summary = data?.summary;

  const stats = useMemo(() => {
    const nowMs = Date.now();
    const active = auctions.filter((a: any) => a.status === "active" && new Date(a.endTime).getTime() > nowMs).length;
    const ended = auctions.filter((a: any) => a.status === "ended" || a.status === "sold" || new Date(a.endTime).getTime() <= nowMs).length;
    const myLeading = user?.id ? auctions.filter((a: any) => a.highestBidderId === user.id && new Date(a.endTime).getTime() > nowMs).length : 0;
    return { total: auctions.length, active, ended, myLeading };
  }, [auctions, user?.id]);

  if (isLoading) {
    return <div className="min-h-screen bg-amber-50/30"><Header /><div className="text-center py-12">載入中...</div><BottomNav /></div>;
  }
  if (error || !session) {
    return (
      <div className="min-h-screen bg-amber-50/30">
        <Header />
        <div className="container mx-auto max-w-3xl px-4 py-12 text-center pb-20">
          <div className="text-5xl mb-3">🤷</div>
          <h1 className="text-xl font-bold text-amber-900 mb-2">專場不存在或未發佈</h1>
          <Link href="/" className="text-amber-700 underline text-sm">返回首頁</Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const endAtMs = new Date(session.endAt).getTime();
  // 時間到 或 商戶手動封盤 均視作已結束
  const isEnded = endAtMs <= now || session.status === 'ended';
  // 專場擁有者或管理員可睇完整真實紀錄
  const isPrivileged = user?.role === "admin" || user?.id === merchantUserId;
  const endingSoonMs = 60 * 60 * 1000; // 1h

  return (
    <div className="min-h-screen bg-amber-50/30">
      <Header />
      <div className="container mx-auto max-w-3xl px-4 py-4 pb-20">
        {/* Hero */}
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-lg mb-4">
          {session.coverImage && (
            <div className="w-full h-44 sm:h-56 overflow-hidden">
              <img src={session.coverImage} alt={session.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-5 sm:p-6">
            {/* 商戶 avatar + 名 */}
            <Link href={`/merchants/${merchantUserId}`}>
              <a className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 pl-1 pr-3 py-1 rounded-full mb-3 transition">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-white/30 border border-white/50 flex items-center justify-center shrink-0">
                  {merchantIcon ? (
                    <img src={merchantIcon} alt={merchantName} className="w-full h-full object-cover" />
                  ) : (
                    <Store className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                <span className="text-xs font-medium truncate max-w-[12rem]">{merchantName}</span>
              </a>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">{session.title}</h1>
            {session.description && <p className="text-sm sm:text-base text-amber-50/90 whitespace-pre-wrap mb-3">{session.description}</p>}
            <div className="flex flex-wrap gap-2 text-sm mb-3">
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Calendar className="w-4 h-4" /> 結束：{new Date(session.endAt).toLocaleString("zh-HK", { hour12: false })}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${isEnded ? "bg-gray-700/50" : "bg-green-500/30"}`}>
                <Clock className="w-4 h-4" /> {isEnded ? "已結束" : `仲有 ${fmtCountdown(endAtMs, now)}`}
              </div>
              <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Package className="w-4 h-4" /> {stats.total} 件
              </div>
            </div>
            {/* Share action + QR */}
            <div className="flex items-center gap-2">
              <SessionShareMenu
                merchantUserId={merchantUserId}
                slug={slug}
                title={session.title}
                merchantName={merchantName}
                endTime={session.endAt}
                variant="light"
              />
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                aria-label="顯示專場 QR Code"
                title="專場 QR Code"
                className="flex items-center justify-center w-9 h-9 text-amber-800 bg-white hover:bg-amber-50 rounded-full transition-colors shadow-sm"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 已結束 banner */}
        {isEnded && (
          <div className="bg-gray-800 text-white rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-2xl">🏁</span>
            <div>
              <div className="font-bold text-sm">此場已結束</div>
              <div className="text-xs text-gray-300">以下為各拍品最終成交紀錄，僅供瀏覽</div>
            </div>
          </div>
        )}

        {/* QR Code Dialog（沿用 MerchantStore 同款 pattern） */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-center text-sm">{`「${sanitizeUserText(session.title)}」專場 QR Code`}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-2">
              <div id="session-qr-svg-wrap" className="bg-white p-3 rounded-lg border border-gray-200">
                <QRCodeSVG value={`https://hongxcollections.com/s/${merchantUserId}/${slug}`} size={200} level="M" />
              </div>
              <p className="text-[11px] text-gray-500 text-center break-all px-2">https://hongxcollections.com/s/{merchantUserId}/{slug}</p>
              <p className="text-xs text-gray-600 text-center">用手機掃 QR Code 即可入場</p>
              <button
                type="button"
                onClick={() => {
                  const wrap = document.getElementById("session-qr-svg-wrap");
                  const svg = wrap?.querySelector("svg");
                  if (!svg) return;
                  const xml = new XMLSerializer().serializeToString(svg);
                  const svg64 = btoa(unescape(encodeURIComponent(xml)));
                  const dataUrl = `data:image/svg+xml;base64,${svg64}`;
                  const img = new Image();
                  img.onload = () => {
                    const scale = 3;
                    const size = 200 * scale;
                    const pad = 24 * scale;
                    const merchantH = 22 * scale;
                    const titleH = 18 * scale;
                    const poweredH = 8 * scale;
                    const gapAfterQR = 8 * scale;
                    const gapLine = 4 * scale;
                    const canvas = document.createElement("canvas");
                    canvas.width = size + pad * 2;
                    canvas.height = pad + size + gapAfterQR + merchantH + gapLine + titleH + gapLine + poweredH + pad;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, pad, pad, size, size);
                    const merchantText = sanitizeUserText(merchantName) || "商戶";
                    const titleText = sanitizeUserText(session.title) || "專場";
                    const rightX = pad + size;
                    const merchantY = pad + size + gapAfterQR + merchantH / 2;
                    const titleY = pad + size + gapAfterQR + merchantH + gapLine + titleH / 2;
                    const poweredY = pad + size + gapAfterQR + merchantH + gapLine + titleH + gapLine + poweredH / 2;
                    const makeGoldGradient = (y: number) => {
                      const g = ctx.createLinearGradient(0, y - 10 * scale, 0, y + 10 * scale);
                      g.addColorStop(0, "#f59e0b");
                      g.addColorStop(0.5, "#d97706");
                      g.addColorStop(1, "#92400e");
                      return g;
                    };
                    ctx.textBaseline = "middle";
                    ctx.textAlign = "right";
                    // 第一行：商戶名稱
                    ctx.font = `bold ${18 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
                    ctx.fillStyle = makeGoldGradient(merchantY);
                    ctx.fillText(merchantText, rightX, merchantY);
                    // 第二行：專場名稱
                    ctx.font = `bold ${15 * scale}px -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif`;
                    ctx.fillStyle = makeGoldGradient(titleY);
                    ctx.fillText(titleText, rightX, titleY);
                    // 第三行：Powered by
                    ctx.font = `${3 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
                    ctx.fillStyle = makeGoldGradient(poweredY);
                    ctx.fillText("Powered by hongxcollections.com", rightX, poweredY);
                    canvas.toBlob((blob) => {
                      if (!blob) return;
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `session-${merchantUserId}-${slug}-qr.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, "image/png");
                  };
                  img.src = dataUrl;
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                下載 QR 圖片
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats bar */}
        {isEnded && summary ? (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-emerald-100 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">成交</div>
                <div className="text-lg font-bold text-emerald-700">{summary.soldCount}</div>
              </div>
              <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">流拍</div>
                <div className="text-lg font-bold text-gray-500">{summary.unsoldCount}</div>
              </div>
              <div className="bg-white border border-amber-100 rounded-xl p-3 text-center">
                <div className="text-xs text-gray-500">總商品</div>
                <div className="text-lg font-bold text-amber-900">{summary.totalCount}</div>
              </div>
            </div>
            <div className="mt-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs sm:text-sm text-amber-800 font-semibold">總成交額</span>
              </div>
              <div className="space-y-1">
                {Object.keys(summary.totalsByCurrency || {}).length === 0 ? (
                  <div className="text-right text-lg sm:text-xl font-extrabold text-amber-700 tabular-nums">
                    {getCurrencySymbol(summary.currency)}0
                  </div>
                ) : Object.entries(summary.totalsByCurrency).map(([cur, amt]) => (
                  <div key={cur} className="flex items-center justify-between">
                    <span className="text-xs text-amber-700">{cur}</span>
                    <span className="text-lg sm:text-xl font-extrabold text-amber-700 tabular-nums">
                      {getCurrencySymbol(cur)}{Math.round(amt as number).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={`grid ${user?.id ? "grid-cols-4" : "grid-cols-3"} gap-2 mb-4`}>
            {/* 總商品 — 點擊重設 filter */}
            <button
              type="button"
              onClick={() => { setFilter("all"); scrollToList(); }}
              className={`rounded-xl p-3 text-center transition-all ${filter === "all" ? "bg-amber-50 border-2 border-amber-400 shadow-sm" : "bg-white border border-amber-100 hover:border-amber-300"}`}
            >
              <div className="text-xs text-gray-500">總商品</div>
              <div className="text-lg font-bold text-amber-900">{stats.total}</div>
            </button>
            {/* 進行中 — 點擊篩選 active */}
            <button
              type="button"
              onClick={() => { setFilter("active"); scrollToList(); }}
              className={`rounded-xl p-3 text-center transition-all ${filter === "active" ? "bg-green-50 border-2 border-green-500 shadow-sm" : "bg-white border border-green-100 hover:border-green-400"}`}
            >
              <div className="text-xs text-gray-500">進行中</div>
              <div className="text-lg font-bold text-green-700">{stats.active}</div>
            </button>
            {/* 已結束 */}
            <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
              <div className="text-xs text-gray-500">已結束</div>
              <div className="text-lg font-bold text-gray-600">{stats.ended}</div>
            </div>
            {/* 你領先 — > 0 可點擊篩選 + 淡出淡入；= 0 唔可點 */}
            {user?.id && (
              stats.myLeading > 0 ? (
                <button
                  type="button"
                  onClick={() => { setFilter("leading"); scrollToList(); }}
                  className={`rounded-xl p-3 text-center transition-all ${
                    filter === "leading"
                      ? "bg-emerald-50 border-2 border-emerald-500 shadow-sm"
                      : "bg-white border-2 border-emerald-400 hover:border-emerald-500 animate-pulse"
                  }`}
                >
                  <div className="text-xs text-gray-500">你領先</div>
                  <div className="text-lg font-bold text-emerald-600">{stats.myLeading}</div>
                </button>
              ) : (
                <div className="bg-white border border-emerald-100 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500">你領先</div>
                  <div className="text-lg font-bold text-emerald-700">0</div>
                </div>
              )
            )}
          </div>
        )}

        {/* Items list — same auction-list-item style as /auctions */}
        {auctions.length === 0 ? (
          <div className="bg-white border border-amber-100 rounded-2xl p-8 text-center text-gray-500">
            專場仲未加入商品
          </div>
        ) : (() => {
          const nowMs = Date.now();
          const filtered = filter === "active"
            ? auctions.filter((a: any) => a.status === "active" && new Date(a.endTime).getTime() > nowMs)
            : filter === "leading"
              ? auctions.filter((a: any) => user?.id && a.highestBidderId === user.id && new Date(a.endTime).getTime() > nowMs)
              : auctions;
          return (
          <>
            <div ref={listRef} className="scroll-mt-4" />
            <div className="flex flex-col gap-[2px]">
            {filtered.map((auction: any) => {
              const nowMs = Date.now();
              const endMs = new Date(auction.endTime).getTime();
              const isItemEnded = endMs <= nowMs;
              const isEndingSoon = !isItemEnded && (endMs - nowMs) <= endingSoonMs;
              const a = auction as { highestBidderName?: string | null; highestBidderId?: number | null; sellerName?: string | null; bidCount?: number | null; startingPrice?: number | string | null; bidIncrement?: number | null; currency?: string; fbShareTemplate?: string | null; createdBy?: number };
              const curr = getCurrencySymbol(a.currency ?? "HKD");
              const startPrice = a.startingPrice ? Number(a.startingPrice) : null;
              const curPrice = Number(auction.currentPrice);
              const totalDuration = auction.createdAt ? endMs - new Date(auction.createdAt).getTime() : null;
              const elapsed = auction.createdAt ? nowMs - new Date(auction.createdAt).getTime() : null;
              const timeProgress = (totalDuration && elapsed && totalDuration > 0)
                ? Math.min(Math.max(elapsed / totalDuration, 0), 1)
                : null;

              return (
                <AuctionCard
                  key={auction.id}
                  auctionId={auction.id}
                  title={auction.title}
                  imageUrl={(auction.images as Array<{ imageUrl: string }> | undefined)?.[0]?.imageUrl}
                  endTime={auction.endTime}
                  currentPrice={curPrice}
                  startingPrice={Number(a.startingPrice ?? 0)}
                  currency={a.currency}
                  isEnded={isItemEnded}
                  isEndingSoon={isEndingSoon}
                  currentUserId={user?.id}
                  highestBidderId={a.highestBidderId}
                  highestBidderName={a.highestBidderName}
                  bidCount={Number(a.bidCount ?? 0)}
                  sessionMode
                  isSessionFullyEnded={isEnded}
                  isPrivileged={isPrivileged}
                  sellerName={a.sellerName}
                  bidIncrement={Number(a.bidIncrement ?? 30)}
                  shareTemplate={a.fbShareTemplate}
                  antiSnipeEnabled={(a as { antiSnipeEnabled?: number }).antiSnipeEnabled}
                  antiSnipeMinutes={(a as { antiSnipeMinutes?: number }).antiSnipeMinutes}
                  extendMinutes={(a as { extendMinutes?: number }).extendMinutes}
                  createdBy={a.createdBy}
                  timeProgress={timeProgress}
                  onLinkClick={() => {
                    try {
                      sessionStorage.setItem("bb_auction_from_session", JSON.stringify({
                        merchantUserId, slug, title: session.title, merchantName,
                      }));
                    } catch {}
                  }}
                />
              );
            })}
            </div>
          </>
          );
        })()}
      </div>
      <BottomNav />
    </div>
  );
}

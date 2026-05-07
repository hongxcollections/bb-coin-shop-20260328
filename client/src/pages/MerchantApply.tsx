import { useState, useRef, useEffect, useMemo } from "react";
import ImageLightbox from "@/components/ImageLightbox";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ChevronLeft, Store, X, CheckCircle2, Clock, XCircle, ImagePlus,
  ChevronDown, ChevronUp, Crown, Receipt, Sparkles, ChevronRight,
} from "lucide-react";

const errTop = (msg: string) => toast.error(msg, { position: "top-center" });
const fmt = (n: number) => `HK$${n.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function StatusBanner({ status, adminNote, app }: { status: string; adminNote?: string | null; app?: any }) {
  if (status === "pending") return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 flex items-start gap-3">
      <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold text-amber-800">申請審核中</p>
        <p className="text-sm text-amber-700 mt-0.5">
          {app?.chosenPlanId
            ? "我們會在 1-3 個工作天內覆核你的訂閱 + 保證金資料，批准後即時開通。"
            : "我們會在 1-3 個工作天內審核你的申請，請耐心等候。"}
        </p>
        {app?.totalAmount && (
          <p className="text-xs text-amber-600 mt-1">
            提交總入數：HK${parseFloat(app.totalAmount).toLocaleString()}
            {app?.paymentReference ? `　參考號：${app.paymentReference}` : ""}
          </p>
        )}
      </div>
    </div>
  );
  if (status === "approved") return (
    <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 flex items-start gap-3">
      <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-emerald-800">申請已獲批准 🎉</p>
        <p className="text-sm text-emerald-700 mt-0.5">恭喜！你已成為 hongxcollections 商戶，立即去後台開始上架。</p>
        {adminNote && <p className="text-sm text-emerald-600 mt-1 italic">備注：{adminNote}</p>}
      </div>
    </div>
  );
  if (status === "rejected") return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-3">
      <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold text-red-700">申請未獲批准</p>
        {adminNote && <p className="text-sm text-red-600 mt-0.5">原因：{adminNote}</p>}
        <p className="text-sm text-red-500 mt-1">如有疑問，請聯絡客服或重新提交。</p>
      </div>
    </div>
  );
  return null;
}

function WhyBBSection() {
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div className="mb-6 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden shadow-sm">
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3.5 text-left">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <div>
              <p className="font-semibold text-amber-900 text-sm">為什麼選擇 hongxcollections.com？</p>
              <p className="text-xs text-amber-600">告別 Facebook 拍賣的繁瑣，讓系統幫你省時省力</p>
            </div>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-amber-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3">
            <img src="/fb-vs-pro-auction.png" alt="臉書拍賣 VS 專業拍賣網站對比"
              className="w-full rounded-xl border border-amber-100 shadow-sm cursor-zoom-in active:opacity-80 transition-opacity"
              onClick={() => setLightbox(true)} />
            <p className="text-center text-[11px] text-amber-400">點擊圖片可放大查看</p>
          </div>
        )}
      </div>
      {lightbox && <ImageLightbox images={["/fb-vs-pro-auction.png"]} alt="臉書拍賣 VS 專業拍賣網站對比" onClose={() => setLightbox(false)} />}
    </>
  );
}

function MerchantApplySeo() {
  useEffect(() => {
    const prev = document.title;
    document.title = "成為商戶｜hongxcollections 香港錢幣拍賣平台";
    return () => { document.title = prev; };
  }, []);
  return null;
}

const LEVEL_META: Record<string, { icon: string; label: string; color: string }> = {
  bronze: { icon: "🥉", label: "銅卡", color: "from-orange-100 to-orange-50 border-orange-300 text-orange-700" },
  silver: { icon: "🥈", label: "銀卡", color: "from-slate-100 to-slate-50 border-slate-300 text-slate-700" },
  gold:   { icon: "🥇", label: "金卡", color: "from-amber-100 to-amber-50 border-amber-400 text-amber-800" },
  vip:    { icon: "👑", label: "VIP",  color: "from-purple-100 to-purple-50 border-purple-400 text-purple-700" },
};

type PlanRow = {
  id: number; name: string; memberLevel: string;
  monthlyPrice: string; yearlyPrice: string;
  maxListings: number; description: string | null; benefits: string | null;
};
type TierRow = { id: number; name: string; amount: string; description: string | null };

export default function MerchantApply() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: myApp, isLoading: loadingApp, refetch } = trpc.merchants.myApplication.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // ── 取 plan + tier 資料畀 wizard ──
  const { data: plans } = trpc.subscriptions.getPlans.useQuery(undefined, { enabled: isAuthenticated });
  const { data: tiers } = trpc.depositTiers.listActive.useQuery(undefined, { enabled: isAuthenticated });

  const uploadPhoto = trpc.merchants.uploadPhoto.useMutation();
  const uploadProof = trpc.subscriptions.uploadPaymentProof.useMutation();
  const submit = trpc.merchants.submit.useMutation({
    onSuccess: () => {
      toast.success("申請已成功提交！我們會盡快審核。", { position: "top-center" });
      refetch();
    },
    onError: (e) => errTop(e.message),
  });

  // ── Mode：完整 onboarding 套餐 vs 純申請 fallback ──
  const [mode, setMode] = useState<"full" | "lite">("full");

  // ── Wizard step 1-4（full mode 用）/ lite mode 只用 step 1 ──
  const [step, setStep] = useState(1);

  // 表單 state
  const [form, setForm] = useState({ contactName: "", merchantName: "", selfIntro: "", whatsapp: "" });
  const [iconUrl, setIconUrl] = useState("");
  const [iconPreview, setIconPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  // 揀 plan / tier
  const [chosenPlanId, setChosenPlanId] = useState<number | null>(null);
  const [chosenPeriod, setChosenPeriod] = useState<"monthly" | "yearly">("monthly");
  const [chosenTierId, setChosenTierId] = useState<number | null>(null);

  // 付款資料
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [paymentProofPreview, setPaymentProofPreview] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [stepsLightbox, setStepsLightbox] = useState(false);

  // 自動填入註冊資料（只填空欄位）
  useEffect(() => {
    if (!user || myApp) return;
    const u = user as { name?: string | null; phone?: string | null };
    setForm((f) => ({
      ...f,
      contactName: f.contactName || (u.name ?? ""),
      merchantName: f.merchantName || (u.name ?? ""),
      whatsapp: f.whatsapp || (u.phone ?? ""),
    }));
  }, [user, myApp]);

  // ── 計算合計 ──
  const chosenPlan = useMemo(() => (plans as PlanRow[] | undefined)?.find(p => p.id === chosenPlanId), [plans, chosenPlanId]);
  const chosenTier = useMemo(() => (tiers as TierRow[] | undefined)?.find(t => t.id === chosenTierId), [tiers, chosenTierId]);
  const planPrice = chosenPlan
    ? parseFloat(chosenPeriod === "yearly" ? chosenPlan.yearlyPrice : chosenPlan.monthlyPrice)
    : 0;
  const tierPrice = chosenTier ? parseFloat(chosenTier.amount) : 0;
  const totalAmount = planPrice + tierPrice;

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const previewUrl = URL.createObjectURL(file);
      const result = await uploadPhoto.mutateAsync({
        imageData: base64,
        fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
        mimeType: file.type || "image/jpeg",
      });
      setIconUrl(result.url);
      setIconPreview(previewUrl);
    } catch (err: unknown) {
      errTop((err as { message?: string })?.message ?? "圖片上傳失敗");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { errTop("收據圖不可超過 8MB"); return; }
    setUploadingProof(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const previewUrl = URL.createObjectURL(file);
      const result = await uploadProof.mutateAsync({
        base64,
        filename: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"),
      });
      setPaymentProofUrl(result.url);
      setPaymentProofPreview(previewUrl);
    } catch (err: unknown) {
      errTop((err as { message?: string })?.message ?? "收據上傳失敗");
    } finally {
      setUploadingProof(false);
      if (proofInputRef.current) proofInputRef.current.value = "";
    }
  }

  function validateStep1(): boolean {
    if (!form.contactName.trim()) { errTop("請填寫聯繫姓名"); return false; }
    if (!form.merchantName.trim()) { errTop("請填寫商戶名稱"); return false; }
    if (!form.selfIntro.trim() || form.selfIntro.trim().length < 10) { errTop("自我介紹最少 10 個字"); return false; }
    if (!form.whatsapp.trim()) { errTop("請填寫 WhatsApp 號碼"); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!validateStep1()) { setStep(1); return; }
    if (mode === "full") {
      if (!chosenPlanId) { errTop("請揀選訂閱計劃"); setStep(2); return; }
      if (!chosenTierId) { errTop("請揀選保證金套餐"); setStep(3); return; }
      if (!paymentProofUrl) { errTop("請上載付款收據圖"); return; }
      if (!paymentReference.trim()) { errTop("請填寫付款參考號（FPS / 銀行轉帳尾 4 位）"); return; }
    }
    submit.mutate({
      contactName: form.contactName.trim(),
      merchantName: form.merchantName.trim(),
      selfIntro: form.selfIntro.trim(),
      whatsapp: form.whatsapp.trim(),
      merchantIcon: iconUrl || undefined,
      ...(mode === "full" && chosenPlanId ? {
        chosenPlanId,
        chosenPeriod,
        chosenDepositTierId: chosenTierId!,
        totalAmount,
        paymentReference: paymentReference.trim(),
        paymentProofUrl,
      } : {}),
    });
  }

  if (loading || loadingApp) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-4xl animate-spin">💰</div>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <MerchantApplySeo />
        <Store className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-bold">請先登入</h1>
        <p className="text-muted-foreground text-sm">申請商戶需要先登入帳號</p>
        <Button className="gold-gradient text-white border-0" onClick={() => window.location.href = getLoginUrl()}>
          立即登入
        </Button>
      </div>
    );
  }

  const showForm = !myApp || myApp.status === "rejected";
  const totalSteps = mode === "full" ? 4 : 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      <MerchantApplySeo />
      <Header />
      <div className="container max-w-2xl pt-6 pb-28 px-4">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 mb-6 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-1 hover:text-amber-700 transition-colors">
            <ChevronLeft className="w-4 h-4" /> 返回
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-900">開通商戶</h1>
            <p className="text-xs text-muted-foreground">一次過完成資料、訂閱、保證金，最快 1-3 工作天即用</p>
          </div>
        </div>

        <WhyBBSection />

        {/* 申請流程圖 */}
        <div className="mb-6">
          <img src="/merchant-apply-steps.png" alt="成為商戶的申請步驟"
            className="w-full rounded-2xl shadow-sm cursor-zoom-in active:opacity-80 transition-opacity"
            onClick={() => setStepsLightbox(true)} />
          <p className="text-center text-xs text-gray-400 mt-1.5">點擊圖片可放大查看</p>
        </div>

        {/* Existing application status */}
        {myApp && (
          <div className="mb-6">
            <StatusBanner status={myApp.status} adminNote={myApp.adminNote} app={myApp} />
            {myApp.status === "pending" && (
              <div className="mt-4 rounded-xl border border-amber-100 bg-white p-4 flex items-center gap-4">
                {myApp.merchantIcon ? (
                  <img src={myApp.merchantIcon} alt="商戶圖示" className="w-14 h-14 rounded-xl object-cover border border-amber-100 flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center flex-shrink-0">
                    <Store className="w-6 h-6 text-amber-300" />
                  </div>
                )}
                <div className="space-y-1 text-sm text-gray-600 min-w-0">
                  {myApp.contactName && <p><span className="font-medium text-gray-800">聯繫姓名：</span>{myApp.contactName}</p>}
                  <p><span className="font-medium text-gray-800">商戶名稱：</span>{myApp.merchantName}</p>
                  <p><span className="font-medium text-gray-800">WhatsApp：</span>{myApp.whatsapp}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Form / Wizard ─── */}
        {showForm && (
          <>
            {/* Mode toggle */}
            <div className="mb-5 grid grid-cols-2 gap-2 p-1 bg-white rounded-xl border border-amber-100 shadow-sm">
              <button
                onClick={() => { setMode("full"); setStep(1); }}
                className={`text-xs font-semibold py-2.5 rounded-lg transition-all ${mode === "full" ? "gold-gradient text-white shadow-sm" : "text-gray-500 hover:text-amber-700"}`}
              >
                <Sparkles className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                完整入駐套餐（推薦）
              </button>
              <button
                onClick={() => { setMode("lite"); setStep(1); }}
                className={`text-xs font-semibold py-2.5 rounded-lg transition-all ${mode === "lite" ? "bg-amber-100 text-amber-800" : "text-gray-500 hover:text-amber-700"}`}
              >
                純資料申請
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-4 px-1 leading-relaxed">
              {mode === "full"
                ? "💎 一次過提交資料、訂閱、保證金，管理員一鍵批核即時開通，慳返兩次等候時間。"
                : "📝 只提交基本資料，批核後再分開申請訂閱及保證金（傳統流程）。"}
            </p>

            {/* Step indicator (full mode only) */}
            {mode === "full" && (
              <div className="mb-5 flex items-center gap-1.5">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className="flex items-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === s ? "gold-gradient text-white shadow"
                      : step > s ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-400"}`}>
                      {step > s ? "✓" : s}
                    </div>
                    {s < 4 && <div className={`flex-1 h-0.5 mx-1 ${step > s ? "bg-emerald-200" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* ─── Step 1: 商戶資料 ─── */}
            {step === 1 && (
              <div className="space-y-5">
                {/* 商戶 Icon */}
                <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm">
                  <h2 className="font-semibold text-amber-900 text-sm mb-3">商戶圖示</h2>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      {iconPreview ? (
                        <>
                          <img src={iconPreview} alt="商戶圖示預覽" className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-200" />
                          <button type="button" onClick={() => { setIconUrl(""); setIconPreview(""); }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-amber-50 border-2 border-dashed border-amber-200 flex flex-col items-center justify-center gap-1 text-amber-400">
                          <Store className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 hover:bg-amber-100 transition-all disabled:opacity-50">
                        {uploading ? <span className="animate-spin">⏳</span> : <ImagePlus className="w-4 h-4" />}
                        {uploading ? "上傳中…" : iconPreview ? "更換圖示" : "上傳圖示"}
                      </button>
                      <p className="text-xs text-gray-400 mt-1.5">建議正方形圖片，最大 8MB（選填）</p>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
                </div>

                <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3 shadow-sm">
                  <h2 className="font-semibold text-amber-900 text-sm">基本資料</h2>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">聯繫姓名 *</label>
                    <Input placeholder="例如：陳大文" value={form.contactName}
                      onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))}
                      maxLength={50} className="border-amber-200 focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">商戶名稱 *</label>
                    <Input placeholder="例如：您的店舖名稱" value={form.merchantName}
                      onChange={e => setForm(f => ({ ...f, merchantName: e.target.value }))}
                      maxLength={50} className="border-amber-200 focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">WhatsApp 號碼 *</label>
                    <Input placeholder="例如：+852 9123 4567" value={form.whatsapp}
                      onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                      className="border-amber-200 focus:border-amber-400" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-2 shadow-sm">
                  <h2 className="font-semibold text-amber-900 text-sm">自我介紹 *</h2>
                  <p className="text-xs text-gray-400">簡單介紹你的收藏背景及出售貨品（最少 10 字）</p>
                  <textarea
                    className="w-full min-h-[100px] rounded-lg border border-amber-200 focus:border-amber-400 focus:outline-none px-3 py-2 text-sm resize-none"
                    placeholder="例如：本人收藏港幣逾 10 年，主要買賣 1960-1990 年代港幣硬幣，所有貨品均保證真品……"
                    value={form.selfIntro} onChange={e => setForm(f => ({ ...f, selfIntro: e.target.value }))}
                    maxLength={500} />
                  <p className="text-xs text-gray-400 text-right">{form.selfIntro.length}/500</p>
                </div>

                {mode === "lite" && (
                  <div className="bg-amber-50 rounded-xl border border-amber-100 px-4 py-3 text-xs text-amber-700 space-y-1">
                    <p>📋 申請成功後，管理員會透過 WhatsApp 聯絡你。</p>
                    <p>💰 批准後需另外申請訂閱及繳交保證金。</p>
                  </div>
                )}

                {mode === "full" ? (
                  <Button onClick={() => { if (validateStep1()) setStep(2); }}
                    className="w-full gold-gradient text-white border-0 h-12 text-base font-semibold rounded-xl">
                    下一步：揀訂閱計劃 <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} disabled={submit.isPending || uploading}
                    className="w-full gold-gradient text-white border-0 h-12 text-base font-semibold rounded-xl">
                    {submit.isPending ? "提交中…" : "提交申請"}
                  </Button>
                )}
              </div>
            )}

            {/* ─── Step 2: 揀 plan ─── */}
            {step === 2 && mode === "full" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm">
                  <h2 className="font-semibold text-amber-900 text-sm mb-1 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" /> 揀選訂閱計劃
                  </h2>
                  <p className="text-xs text-gray-500 mb-3">不同等級享有不同上架配額及折扣</p>

                  <div className="grid grid-cols-2 gap-1 p-1 bg-amber-50 rounded-lg mb-3">
                    <button onClick={() => setChosenPeriod("monthly")}
                      className={`text-xs font-semibold py-1.5 rounded-md transition-all ${chosenPeriod === "monthly" ? "bg-white shadow text-amber-800" : "text-gray-500"}`}>
                      月費
                    </button>
                    <button onClick={() => setChosenPeriod("yearly")}
                      className={`text-xs font-semibold py-1.5 rounded-md transition-all ${chosenPeriod === "yearly" ? "bg-white shadow text-amber-800" : "text-gray-500"}`}>
                      年費（更抵）
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(plans as PlanRow[] | undefined)?.map(plan => {
                      const meta = LEVEL_META[plan.memberLevel] ?? LEVEL_META.bronze;
                      const price = parseFloat(chosenPeriod === "yearly" ? plan.yearlyPrice : plan.monthlyPrice);
                      const selected = chosenPlanId === plan.id;
                      return (
                        <button key={plan.id} type="button" onClick={() => setChosenPlanId(plan.id)}
                          className={`w-full text-left rounded-xl border-2 p-3 transition-all ${selected ? "border-amber-500 bg-gradient-to-br " + meta.color : "border-gray-200 bg-white hover:border-amber-300"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm flex items-center gap-1.5">
                                <span>{meta.icon}</span> {plan.name}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {plan.maxListings === 0 ? "♾️ 無限上架" : `每${chosenPeriod === "yearly" ? "年" : "月"} ${plan.maxListings} 件配額`}
                              </p>
                              {plan.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{plan.description}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-amber-700">{fmt(price)}</p>
                              <p className="text-[10px] text-gray-400">/{chosenPeriod === "yearly" ? "年" : "月"}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {(!plans || plans.length === 0) && (
                      <p className="text-xs text-gray-400 text-center py-4">暫無可選訂閱計劃，請聯絡客服</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11 border-amber-200">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 上一步
                  </Button>
                  <Button onClick={() => { if (!chosenPlanId) { errTop("請揀一個訂閱計劃"); return; } setStep(3); }}
                    className="flex-1 gold-gradient text-white border-0 h-11">
                    下一步 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ─── Step 3: 揀保證金 tier ─── */}
            {step === 3 && mode === "full" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm">
                  <h2 className="font-semibold text-amber-900 text-sm mb-1 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-amber-500" /> 揀選保證金套餐
                  </h2>
                  <p className="text-xs text-gray-500 mb-3">保證金會存入你的商戶帳戶，可隨時用來扣繳傭金</p>

                  <div className="space-y-2">
                    {(tiers as TierRow[] | undefined)?.map(tier => {
                      const selected = chosenTierId === tier.id;
                      const amount = parseFloat(tier.amount);
                      return (
                        <button key={tier.id} type="button" onClick={() => setChosenTierId(tier.id)}
                          className={`w-full text-left rounded-xl border-2 p-3 transition-all ${selected ? "border-amber-500 bg-gradient-to-br from-amber-50 to-orange-50" : "border-gray-200 bg-white hover:border-amber-300"}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">💰 {tier.name}</p>
                              {tier.description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tier.description}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-amber-700">{fmt(amount)}</p>
                              <p className="text-[10px] text-gray-400">保證金</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {(!tiers || tiers.length === 0) && (
                      <p className="text-xs text-gray-400 text-center py-4">暫無可選保證金套餐，請聯絡客服</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-11 border-amber-200">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 上一步
                  </Button>
                  <Button onClick={() => { if (!chosenTierId) { errTop("請揀一個保證金套餐"); return; } setStep(4); }}
                    className="flex-1 gold-gradient text-white border-0 h-11">
                    下一步 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ─── Step 4: 總結 + 入數 ─── */}
            {step === 4 && mode === "full" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border-2 border-amber-300 p-4 shadow-sm">
                  <h2 className="font-semibold text-amber-900 text-sm mb-3 flex items-center gap-1.5">
                    <Receipt className="w-4 h-4" /> 訂單總結
                  </h2>
                  <div className="space-y-2 text-sm">
                    {chosenPlan && (
                      <div className="flex justify-between items-center py-1.5 border-b border-amber-100">
                        <span className="text-gray-600">訂閱：{chosenPlan.name}（{chosenPeriod === "yearly" ? "年費" : "月費"}）</span>
                        <span className="font-semibold text-amber-800">{fmt(planPrice)}</span>
                      </div>
                    )}
                    {chosenTier && (
                      <div className="flex justify-between items-center py-1.5 border-b border-amber-100">
                        <span className="text-gray-600">保證金：{chosenTier.name}</span>
                        <span className="font-semibold text-amber-800">{fmt(tierPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-bold text-amber-900">合計入數</span>
                      <span className="text-2xl font-bold text-amber-700">{fmt(totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-xs text-amber-800 space-y-1.5 leading-relaxed">
                  <p className="font-semibold">📌 入數方法（請任選其一）</p>
                  <p>• <b>FPS 轉數快</b>：手機號 9123-4567 / 識別碼 123456789</p>
                  <p>• <b>銀行轉帳</b>：匯豐 123-456789-001（戶名：HONGX COLLECTIONS）</p>
                  <p className="text-amber-600 mt-1">入數後請填寫參考號 + 上載收據截圖</p>
                </div>

                <div className="bg-white rounded-2xl border border-amber-100 p-4 space-y-3 shadow-sm">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">付款參考號 *</label>
                    <Input placeholder="例如：FPS 末 4 位 / 銀行轉帳編號"
                      value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
                      maxLength={100} className="border-amber-200 focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-2 block">付款收據圖 *</label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        {paymentProofPreview ? (
                          <>
                            <img src={paymentProofPreview} alt="收據預覽" className="w-20 h-20 rounded-xl object-cover border-2 border-amber-200" />
                            <button type="button" onClick={() => { setPaymentProofUrl(""); setPaymentProofPreview(""); }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center">
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-amber-50 border-2 border-dashed border-amber-200 flex items-center justify-center text-amber-400">
                            <Receipt className="w-7 h-7" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <button type="button" onClick={() => proofInputRef.current?.click()} disabled={uploadingProof}
                          className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 hover:bg-amber-100 transition-all disabled:opacity-50">
                          {uploadingProof ? <span className="animate-spin">⏳</span> : <ImagePlus className="w-4 h-4" />}
                          {uploadingProof ? "上傳中…" : paymentProofPreview ? "更換收據" : "上載收據"}
                        </button>
                        <p className="text-xs text-gray-400 mt-1.5">最大 8MB</p>
                      </div>
                    </div>
                    <input ref={proofInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofChange} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(3)} className="flex-1 h-11 border-amber-200">
                    <ChevronLeft className="w-4 h-4 mr-1" /> 上一步
                  </Button>
                  <Button onClick={handleSubmit} disabled={submit.isPending || uploading || uploadingProof}
                    className="flex-1 gold-gradient text-white border-0 h-12 text-base font-semibold">
                    {submit.isPending ? "提交中…" : "提交申請"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {stepsLightbox && <ImageLightbox images={["/merchant-apply-steps.png"]} alt="成為商戶的申請步驟" onClose={() => setStepsLightbox(false)} />}
    </div>
  );
}

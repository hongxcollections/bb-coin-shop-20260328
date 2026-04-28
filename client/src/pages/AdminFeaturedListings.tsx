import { useState } from "react";
import AdminHeader from "@/components/AdminHeader";
import { trpc } from "@/lib/trpc";
import { X, Flame, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";

const TIER_ORDER = ["day1", "day3", "day7"];

// 用字串型態儲存草稿，避免 parseInt("") 跳回預設值的問題
type DraftTier = { tier: string; label: string; price: string; hours: string };

export default function AdminFeaturedListings() {
  const configQuery = trpc.featuredListings.getConfig.useQuery();
  const allQuery = trpc.featuredListings.adminList.useQuery(undefined, { refetchInterval: 60_000 });

  const updateConfig = trpc.featuredListings.updateConfig.useMutation({
    onSuccess: () => {
      setEditMode(false);
      configQuery.refetch();
      toast.success("主打方案設定已儲存");
    },
    onError: (e) => toast.error("儲存失敗：" + e.message),
  });

  const cancelMutation = trpc.featuredListings.adminCancel.useMutation({
    onSuccess: () => { allQuery.refetch(); toast.success("主打已取消"); },
    onError: (e) => toast.error("取消失敗：" + e.message),
  });

  const purgeMutation = trpc.featuredListings.adminPurge.useMutation({
    onSuccess: (res) => {
      setShowPurgeConfirm(false);
      allQuery.refetch();
      toast.success(`已清除 ${res.cleared} 條進行中／排隊主打記錄`);
    },
    onError: (e) => toast.error("清除失敗：" + e.message),
  });

  const [editMode, setEditMode] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [draftTiers, setDraftTiers] = useState<DraftTier[]>([]);
  const [draftMaxSlots, setDraftMaxSlots] = useState("5");
  const [confirmTarget, setConfirmTarget] = useState<{ id: number; productTitle: string; type: "active" | "queued" } | null>(null);

  function startEdit() {
    if (!configQuery.data) return;
    const tiers = TIER_ORDER.map((t) => {
      const found = configQuery.data!.tiers.find((x: any) => x.tier === t);
      return {
        tier: t,
        label: found?.label ?? t,
        price: String(found?.price ?? 0),
        hours: String(found?.hours ?? 24),
      };
    });
    setDraftTiers(tiers);
    setDraftMaxSlots(String(configQuery.data.maxSlots));
    setEditMode(true);
  }

  function updateDraftTier(idx: number, field: keyof DraftTier, val: string) {
    setDraftTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));
  }

  function handleSave() {
    const slots = parseInt(draftMaxSlots);
    if (!draftMaxSlots.trim() || isNaN(slots) || slots < 1) { toast.error("最多同時主打數至少為 1"); return; }
    if (slots > 100) { toast.error("最多同時主打數不能超過 100"); return; }

    const parsedTiers = [];
    for (const t of draftTiers) {
      if (!t.label.trim()) { toast.error(`${t.tier} 方案名稱不可空白`); return; }
      const price = parseFloat(t.price);
      const hours = parseInt(t.hours);
      if (isNaN(price) || price < 0) { toast.error(`${t.tier} 費用必須為 0 或以上`); return; }
      if (isNaN(hours) || hours < 1) { toast.error(`${t.tier} 時長至少 1 小時`); return; }
      parsedTiers.push({ tier: t.tier, label: t.label.trim(), price, hours });
    }

    updateConfig.mutate({ tiers: parsedTiers, maxSlots: slots });
  }

  const listings = allQuery.data ?? [];
  const now = new Date();
  const isReallyActive = (l: any) => l.status === "active" && (!l.endAt || new Date(l.endAt) > now);
  const isReallyExpired = (l: any) => l.status === "expired" || (l.status === "active" && l.endAt && new Date(l.endAt) <= now);
  const active = listings.filter((l: any) => isReallyActive(l));
  const queued = listings.filter((l: any) => l.status === "queued");
  const expired = listings.filter((l: any) => isReallyExpired(l));

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">

        {/* ── 方案設定卡 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">付費主打方案設定</h2>
              <p className="text-xs text-gray-400 mt-0.5">修改後即時生效，商戶申請時會看到最新價格</p>
            </div>
            {!editMode && (
              <button
                onClick={startEdit}
                disabled={configQuery.isLoading}
                className="shrink-0 ml-3 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                ✏️ 編輯
              </button>
            )}
          </div>

          {configQuery.isLoading && <p className="text-sm text-gray-400">載入中…</p>}

          {/* 顯示模式 */}
          {!editMode && configQuery.data && (
            <div className="space-y-0">
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-xs text-gray-500">最多同時主打數</span>
                <span className="text-sm font-bold text-indigo-700">{configQuery.data.maxSlots} 個</span>
              </div>
              {TIER_ORDER.map((t) => {
                const tier = configQuery.data!.tiers.find((x: any) => x.tier === t);
                return (
                  <div key={t} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-300">{t}</span>
                      <span className="text-sm font-medium text-gray-700">{tier?.label ?? "-"}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-700">HK${tier?.price ?? 0}</div>
                      <div className="text-xs text-gray-400">{tier?.hours ?? "-"} 小時</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 編輯模式 */}
          {editMode && (
            <div className="space-y-4">
              {/* 同時主打數 */}
              <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
                <span className="text-sm text-gray-700 font-medium">最多同時主打數</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draftMaxSlots}
                    onChange={(e) => setDraftMaxSlots(e.target.value)}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <span className="text-xs text-gray-400">個</span>
                </div>
              </div>

              {/* 各方案 */}
              {draftTiers.map((t, idx) => (
                <div key={t.tier} className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <span className="inline-block text-xs font-mono bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md">
                    {t.tier}
                  </span>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">方案名稱</label>
                    <input
                      type="text"
                      value={t.label}
                      onChange={(e) => updateDraftTier(idx, "label", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="例如：1天主打"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">費用 (HK$)</label>
                      <input
                        type="number"
                        min={0}
                        value={t.price}
                        onChange={(e) => updateDraftTier(idx, "price", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">時長（小時）</label>
                      <input
                        type="number"
                        min={1}
                        value={t.hours}
                        onChange={(e) => updateDraftTier(idx, "hours", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        placeholder="24"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={updateConfig.isLoading}
                  className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateConfig.isLoading ? "儲存中…" : "💾 儲存設定"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 進行中主打 ── */}
        <ListingSection
          title={`進行中主打（${active.length} / ${configQuery.data?.maxSlots ?? "…"} 位）`}
          color="green"
          listings={active}
          onCancel={(id, productTitle) => setConfirmTarget({ id, productTitle, type: "active" })}
          loading={allQuery.isLoading}
          showExpiry
        />

        {/* ── 排隊中 ── */}
        <ListingSection
          title={`排隊中（${queued.length}）`}
          color="amber"
          listings={queued}
          onCancel={(id, productTitle) => setConfirmTarget({ id, productTitle, type: "queued" })}
          loading={allQuery.isLoading}
        />

        {/* ── 過期記錄 ── */}
        <ListingSection
          title={`過期記錄（${expired.length}）`}
          color="gray"
          listings={expired}
          loading={allQuery.isLoading}
          readOnly
        />

        {/* ── 危險區域：一鍵清除 ── */}
        <div className="border border-red-200 bg-red-50 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-red-700 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" />一鍵清除所有主打
              </p>
              <p className="text-xs text-red-400 mt-0.5">清除所有進行中及排隊中的記錄，費用不退還。用於資料混亂時重置。</p>
            </div>
            <button
              onClick={() => setShowPurgeConfirm(true)}
              disabled={active.length + queued.length === 0}
              className="shrink-0 px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              清除（{active.length + queued.length}）
            </button>
          </div>
        </div>
      </div>

      {/* ── 一鍵清除 Confirm Dialog ── */}
      {showPurgeConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPurgeConfirm(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3 text-red-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold">確認一鍵清除所有主打？</h3>
              <button className="ml-auto p-1 hover:bg-gray-100 rounded-full" onClick={() => setShowPurgeConfirm(false)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="bg-red-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-400 font-medium mb-1">將被清除</p>
              <p className="text-sm font-semibold text-red-700">
                進行中：{active.length} 條　排隊中：{queued.length} 條
              </p>
            </div>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              此操作不可逆。所有進行中及排隊的主打將標為「已取消」，費用不退還。只在系統數據混亂時使用。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPurgeConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={() => purgeMutation.mutate()}
                disabled={purgeMutation.isPending}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
              >
                {purgeMutation.isPending ? "清除中…" : "確認清除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 取消主打 Confirm Dialog ── */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmTarget(null)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* 拖動把手 */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            {/* 標題 */}
            <div className={`flex items-center gap-2 mb-3 ${confirmTarget.type === "active" ? "text-red-600" : "text-amber-600"}`}>
              {confirmTarget.type === "active"
                ? <Flame className="w-5 h-5 shrink-0" />
                : <Clock className="w-5 h-5 shrink-0" />
              }
              <h3 className="text-base font-bold">
                {confirmTarget.type === "active" ? "取消主打刊登" : "取消排隊"}
              </h3>
              <button className="ml-auto p-1 hover:bg-gray-100 rounded-full" onClick={() => setConfirmTarget(null)}>
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* 商品名稱 */}
            <div className={`rounded-xl p-3 mb-3 ${confirmTarget.type === "active" ? "bg-red-50" : "bg-amber-50"}`}>
              <p className={`text-xs font-medium mb-0.5 ${confirmTarget.type === "active" ? "text-red-400" : "text-amber-400"}`}>商品</p>
              <p className={`text-sm font-semibold leading-snug ${confirmTarget.type === "active" ? "text-red-700" : "text-amber-700"}`}>
                {confirmTarget.productTitle}
              </p>
            </div>

            {/* 說明文字 */}
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">
              {confirmTarget.type === "active"
                ? "確定要取消這個主打刊登？費用不退還，取消後立即失效。"
                : "確定要取消排隊？排隊預扣的費用將退回商戶保證金。"
              }
            </p>

            {/* 按鈕 */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                {confirmTarget.type === "active" ? "保留主打" : "保留排隊"}
              </button>
              <button
                onClick={() => { cancelMutation.mutate({ id: confirmTarget.id }); setConfirmTarget(null); }}
                disabled={cancelMutation.isPending}
                className={`flex-1 py-3 rounded-2xl text-white text-sm font-semibold transition-colors disabled:opacity-50 ${confirmTarget.type === "active" ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"}`}
              >
                確認取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ListingSection({
  title, color, listings, onCancel, loading, showExpiry, readOnly,
}: {
  title: string;
  color: "green" | "amber" | "gray";
  listings: any[];
  onCancel?: (id: number, productTitle: string) => void;
  loading?: boolean;
  showExpiry?: boolean;
  readOnly?: boolean;
}) {
  const titleColor = { green: "text-green-700", amber: "text-amber-700", gray: "text-gray-400" }[color];
  const tierBadge = { green: "bg-green-100 text-green-700", amber: "bg-amber-100 text-amber-700", gray: "bg-gray-100 text-gray-500" }[color];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className={`text-sm font-bold mb-3 ${titleColor}`}>{title}</h3>

      {loading && <p className="text-sm text-gray-400">載入中…</p>}
      {!loading && listings.length === 0 && (
        <p className="text-sm text-gray-400">（目前無記錄）</p>
      )}

      {!loading && listings.length > 0 && (
        <div className="space-y-3">
          {listings.map((l: any) => (
            <div key={l.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="text-sm font-medium text-gray-800 leading-snug">{l.productTitle}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierBadge}`}>{l.tier}</span>
                <span className="text-xs text-green-700 font-bold">HK${Number(l.amount).toFixed(0)}</span>
                <span className="text-xs text-gray-400">{l.merchantName}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                {showExpiry && l.endAt ? (() => {
                  const end = new Date(l.endAt);
                  const isExpired = end <= new Date();
                  const soonMs = end.getTime() - Date.now();
                  const isSoon = !isExpired && soonMs < 60 * 60 * 1000;
                  return (
                    <span className={`text-xs ${isExpired ? "text-red-500 font-semibold" : isSoon ? "text-orange-500 font-medium" : "text-gray-400"}`}>
                      {isExpired ? "⚠️ 已過期：" : isSoon ? "⏰ 到期：" : "到期："}
                      {end.toLocaleString("zh-HK", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  );
                })() : (
                  <span />
                )}
                {!readOnly && (
                  <button
                    onClick={() => onCancel?.(l.id, l.productTitle ?? "")}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-100 shrink-0"
                  >
                    取消主打
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

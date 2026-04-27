import { useState } from "react";
import AdminHeader from "@/components/AdminHeader";
import { trpc } from "@/lib/trpc";

const TIER_ORDER = ["day1", "day3", "day7"];

export default function AdminFeaturedListings() {
  const configQuery = trpc.featuredListings.getConfig.useQuery();
  const allQuery = trpc.featuredListings.adminList.useQuery();

  const updateConfig = trpc.featuredListings.updateConfig.useMutation({
    onSuccess: () => {
      setEditMode(false);
      configQuery.refetch();
      alert("✅ 主打方案設定已儲存");
    },
    onError: (e) => alert("❌ 儲存失敗：" + e.message),
  });

  const cancelMutation = trpc.featuredListings.adminCancel.useMutation({
    onSuccess: () => allQuery.refetch(),
    onError: (e) => alert("❌ 取消失敗：" + e.message),
  });

  const [editMode, setEditMode] = useState(false);
  const [draftTiers, setDraftTiers] = useState<
    Array<{ tier: string; label: string; price: number; hours: number }>
  >([]);
  const [draftMaxSlots, setDraftMaxSlots] = useState(5);

  function startEdit() {
    if (!configQuery.data) return;
    const tiers = TIER_ORDER.map((t) => {
      const found = configQuery.data!.tiers.find((x: any) => x.tier === t);
      return { tier: t, label: found?.label ?? t, price: found?.price ?? 0, hours: found?.hours ?? 24 };
    });
    setDraftTiers(tiers);
    setDraftMaxSlots(configQuery.data.maxSlots);
    setEditMode(true);
  }

  function updateDraftTier(idx: number, field: string, val: string | number) {
    setDraftTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t)));
  }

  function handleSave() {
    for (const t of draftTiers) {
      if (!t.label.trim()) return alert("方案名稱不可空白");
      if (t.price < 0) return alert("價格不能為負數");
      if (t.hours < 1) return alert("時長至少 1 小時");
    }
    if (draftMaxSlots < 1) return alert("最多同時主打數至少為 1");
    updateConfig.mutate({ tiers: draftTiers, maxSlots: draftMaxSlots });
  }

  const listings = allQuery.data ?? [];
  const active = listings.filter((l: any) => l.status === "active");
  const queued = listings.filter((l: any) => l.status === "queued");
  const expired = listings.filter((l: any) => l.status === "expired");

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
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-xs text-gray-500">最多同時主打數</span>
                <span className="text-sm font-bold text-indigo-700">{configQuery.data.maxSlots} 個</span>
              </div>
              {TIER_ORDER.map((t) => {
                const tier = configQuery.data!.tiers.find((x: any) => x.tier === t);
                return (
                  <div key={t} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-xs font-mono text-gray-400 mr-2">{t}</span>
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
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700 font-medium">最多同時主打數</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={1} max={100} value={draftMaxSlots}
                    onChange={(e) => setDraftMaxSlots(parseInt(e.target.value) || 1)}
                    className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">個</span>
                </div>
              </div>

              {/* 各方案 */}
              {draftTiers.map((t, idx) => (
                <div key={t.tier} className="p-3 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono bg-gray-200 text-gray-500 px-2 py-0.5 rounded">{t.tier}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">方案名稱</label>
                      <input
                        type="text" value={t.label}
                        onChange={(e) => updateDraftTier(idx, "label", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">費用 (HK$)</label>
                        <input
                          type="number" min={0} value={t.price}
                          onChange={(e) => updateDraftTier(idx, "price", parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">時長（小時）</label>
                        <input
                          type="number" min={1} value={t.hours}
                          onChange={(e) => updateDraftTier(idx, "hours", parseInt(e.target.value) || 1)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        />
                      </div>
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
          onCancel={(id) => {
            if (confirm("確定取消這個主打？費用不退還。")) cancelMutation.mutate({ id });
          }}
          loading={allQuery.isLoading}
          showExpiry
        />

        {/* ── 排隊中 ── */}
        <ListingSection
          title={`排隊中（${queued.length}）`}
          color="amber"
          listings={queued}
          onCancel={(id) => {
            if (confirm("確定取消排隊？")) cancelMutation.mutate({ id });
          }}
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
      </div>
    </div>
  );
}

function ListingSection({
  title, color, listings, onCancel, loading, showExpiry, readOnly,
}: {
  title: string;
  color: "green" | "amber" | "gray";
  listings: any[];
  onCancel?: (id: number) => void;
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
              {/* 商品名稱 */}
              <div className="text-sm font-medium text-gray-800 leading-snug">{l.productTitle}</div>

              {/* 標籤行 */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierBadge}`}>{l.tier}</span>
                <span className="text-xs text-green-700 font-bold">HK${Number(l.amount).toFixed(0)}</span>
                <span className="text-xs text-gray-400">{l.merchantName}</span>
              </div>

              {/* 到期時間 + 取消按鈕 */}
              <div className="flex items-center justify-between gap-2">
                {showExpiry && l.endAt ? (
                  <span className="text-xs text-gray-400">
                    到期：{new Date(l.endAt).toLocaleString("zh-HK", {
                      month: "2-digit", day: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                ) : (
                  <span />
                )}
                {!readOnly && (
                  <button
                    onClick={() => onCancel?.(l.id)}
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

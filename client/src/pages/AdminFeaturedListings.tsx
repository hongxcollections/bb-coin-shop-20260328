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
      return {
        tier: t,
        label: found?.label ?? t,
        price: found?.price ?? 0,
        hours: found?.hours ?? 24,
      };
    });
    setDraftTiers(tiers);
    setDraftMaxSlots(configQuery.data.maxSlots);
    setEditMode(true);
  }

  function updateDraftTier(idx: number, field: string, val: string | number) {
    setDraftTiers((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, [field]: val } : t))
    );
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
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">

        {/* ── 方案設定卡 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-800">付費主打方案設定</h2>
              <p className="text-xs text-gray-400 mt-0.5">修改後即時生效，商戶申請時會看到最新價格</p>
            </div>
            {!editMode && (
              <button
                onClick={startEdit}
                disabled={configQuery.isLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                ✏️ 編輯設定
              </button>
            )}
          </div>

          {configQuery.isLoading && (
            <p className="text-sm text-gray-400">載入中…</p>
          )}

          {!editMode && configQuery.data && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">最多同時主打數：</span>
                <span className="text-indigo-700 font-bold text-base">
                  {configQuery.data.maxSlots} 個
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium">方案代號</th>
                    <th className="pb-2 pr-4 font-medium">名稱</th>
                    <th className="pb-2 pr-4 font-medium">費用 (HK$)</th>
                    <th className="pb-2 font-medium">時長</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {TIER_ORDER.map((t) => {
                    const tier = configQuery.data!.tiers.find((x: any) => x.tier === t);
                    return (
                      <tr key={t}>
                        <td className="py-2 pr-4 font-mono text-gray-400 text-xs">{t}</td>
                        <td className="py-2 pr-4 font-medium text-gray-700">{tier?.label ?? "-"}</td>
                        <td className="py-2 pr-4 text-green-700 font-semibold">HK${tier?.price ?? 0}</td>
                        <td className="py-2 text-gray-500">{tier?.hours ?? "-"} 小時</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {editMode && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-32">最多同時主打數</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draftMaxSlots}
                  onChange={(e) => setDraftMaxSlots(parseInt(e.target.value) || 1)}
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center"
                />
                <span className="text-sm text-gray-400">個</span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                    <th className="pb-2 pr-4 font-medium w-24">方案代號</th>
                    <th className="pb-2 pr-4 font-medium">方案名稱</th>
                    <th className="pb-2 pr-4 font-medium w-32">費用 (HK$)</th>
                    <th className="pb-2 font-medium w-32">時長（小時）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {draftTiers.map((t, idx) => (
                    <tr key={t.tier}>
                      <td className="py-2 pr-4 font-mono text-gray-400 text-xs">{t.tier}</td>
                      <td className="py-2 pr-4">
                        <input
                          type="text"
                          value={t.label}
                          onChange={(e) => updateDraftTier(idx, "label", e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          min={0}
                          value={t.price}
                          onChange={(e) => updateDraftTier(idx, "price", parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          type="number"
                          min={1}
                          value={t.hours}
                          onChange={(e) => updateDraftTier(idx, "hours", parseInt(e.target.value) || 1)}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={updateConfig.isLoading}
                  className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateConfig.isLoading ? "儲存中…" : "💾 儲存"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
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
          onCancel={(id) => cancelMutation.mutate({ id })}
          loading={allQuery.isLoading}
          showExpiry
        />

        {/* ── 排隊中 ── */}
        <ListingSection
          title={`排隊中（${queued.length}）`}
          color="amber"
          listings={queued}
          onCancel={(id) => cancelMutation.mutate({ id })}
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
  title,
  color,
  listings,
  onCancel,
  loading,
  showExpiry,
  readOnly,
}: {
  title: string;
  color: "green" | "amber" | "gray";
  listings: any[];
  onCancel?: (id: number) => void;
  loading?: boolean;
  showExpiry?: boolean;
  readOnly?: boolean;
}) {
  const titleColor = {
    green: "text-green-700",
    amber: "text-amber-700",
    gray: "text-gray-400",
  }[color];

  const badgeStyle = {
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    gray: "bg-gray-100 text-gray-500",
  }[color];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className={`text-sm font-bold mb-4 ${titleColor}`}>{title}</h3>

      {loading && <p className="text-sm text-gray-400">載入中…</p>}

      {!loading && listings.length === 0 && (
        <p className="text-sm text-gray-400">（目前無記錄）</p>
      )}

      {!loading && listings.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-2 pr-4 font-medium">商品名稱</th>
              <th className="pb-2 pr-4 font-medium">商戶</th>
              <th className="pb-2 pr-4 font-medium">方案</th>
              <th className="pb-2 pr-4 font-medium">費用</th>
              {showExpiry && <th className="pb-2 pr-4 font-medium">到期時間</th>}
              {!readOnly && <th className="pb-2 font-medium">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {listings.map((l: any) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="py-2.5 pr-4 text-gray-800 font-medium max-w-xs truncate">{l.productTitle}</td>
                <td className="py-2.5 pr-4 text-gray-500">{l.merchantName}</td>
                <td className="py-2.5 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeStyle}`}>
                    {l.tier}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-green-700 font-semibold">
                  HK${Number(l.amount).toFixed(0)}
                </td>
                {showExpiry && (
                  <td className="py-2.5 pr-4 text-gray-400 text-xs whitespace-nowrap">
                    {l.endAt
                      ? new Date(l.endAt).toLocaleString("zh-HK", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-"}
                  </td>
                )}
                {!readOnly && (
                  <td className="py-2.5">
                    <button
                      onClick={() => onCancel?.(l.id)}
                      className="text-xs px-3 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-100"
                    >
                      取消主打
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

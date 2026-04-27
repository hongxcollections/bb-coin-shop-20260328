import { useState } from "preact/hooks";
import AdminHeader from "../components/AdminHeader";
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
      const found = configQuery.data!.tiers.find((x) => x.tier === t);
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
  const active = listings.filter((l) => l.status === "active");
  const queued = listings.filter((l) => l.status === "queued");
  const expired = listings.filter((l) => l.status === "expired");

  return (
    <div class="min-h-screen bg-gray-50">
      <AdminHeader />
      <div class="max-w-6xl mx-auto py-8 px-4 space-y-8">
        {/* 方案設定卡 */}
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-gray-800">主打方案設定</h2>
            {!editMode && (
              <button
                onClick={startEdit}
                disabled={configQuery.isLoading}
                class="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
              >
                ✏️ 編輯設定
              </button>
            )}
          </div>

          {configQuery.isLoading && (
            <p class="text-sm text-gray-400">載入中…</p>
          )}

          {!editMode && configQuery.data && (
            <div class="space-y-4">
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <span class="font-medium">最多同時主打數：</span>
                <span class="text-indigo-700 font-bold">
                  {configQuery.data.maxSlots} 個
                </span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="bg-gray-50 text-gray-500 text-left">
                      <th class="px-4 py-2 font-medium border border-gray-100">方案</th>
                      <th class="px-4 py-2 font-medium border border-gray-100">名稱</th>
                      <th class="px-4 py-2 font-medium border border-gray-100">費用 (HK$)</th>
                      <th class="px-4 py-2 font-medium border border-gray-100">時長</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIER_ORDER.map((t) => {
                      const tier = configQuery.data!.tiers.find((x) => x.tier === t);
                      return (
                        <tr key={t} class="border-t border-gray-100">
                          <td class="px-4 py-2 font-mono border border-gray-100 text-gray-500">{t}</td>
                          <td class="px-4 py-2 border border-gray-100">{tier?.label ?? "-"}</td>
                          <td class="px-4 py-2 border border-gray-100 text-green-700 font-medium">
                            ${tier?.price ?? 0}
                          </td>
                          <td class="px-4 py-2 border border-gray-100">
                            {tier?.hours ?? "-"} 小時
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {editMode && (
            <div class="space-y-5">
              <div class="flex items-center gap-3">
                <label class="text-sm font-medium text-gray-700">
                  最多同時主打數
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draftMaxSlots}
                  onInput={(e) =>
                    setDraftMaxSlots(parseInt((e.target as HTMLInputElement).value) || 1)
                  }
                  class="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                />
                <span class="text-sm text-gray-400">個</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr class="bg-gray-50 text-gray-500 text-left">
                      <th class="px-4 py-2 font-medium border border-gray-100">方案代號</th>
                      <th class="px-4 py-2 font-medium border border-gray-100">方案名稱</th>
                      <th class="px-4 py-2 font-medium border border-gray-100">費用 (HK$)</th>
                      <th class="px-4 py-2 font-medium border border-gray-100">時長（小時）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftTiers.map((t, idx) => (
                      <tr key={t.tier} class="border-t border-gray-100">
                        <td class="px-4 py-2 font-mono border border-gray-100 text-gray-400">{t.tier}</td>
                        <td class="px-4 py-2 border border-gray-100">
                          <input
                            type="text"
                            value={t.label}
                            onInput={(e) =>
                              updateDraftTier(idx, "label", (e.target as HTMLInputElement).value)
                            }
                            class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td class="px-4 py-2 border border-gray-100">
                          <input
                            type="number"
                            min={0}
                            value={t.price}
                            onInput={(e) =>
                              updateDraftTier(
                                idx,
                                "price",
                                parseFloat((e.target as HTMLInputElement).value) || 0
                              )
                            }
                            class="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td class="px-4 py-2 border border-gray-100">
                          <input
                            type="number"
                            min={1}
                            value={t.hours}
                            onInput={(e) =>
                              updateDraftTier(
                                idx,
                                "hours",
                                parseInt((e.target as HTMLInputElement).value) || 1
                              )
                            }
                            class="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div class="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={updateConfig.isLoading}
                  class="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateConfig.isLoading ? "儲存中…" : "💾 儲存"}
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  class="px-5 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 進行中主打 */}
        <Section
          title={`進行中主打（${active.length} / ${configQuery.data?.maxSlots ?? "…"} 位）`}
          color="green"
          listings={active}
          onCancel={(id) => cancelMutation.mutate({ id })}
          loading={allQuery.isLoading}
          showCountdown
        />

        {/* 排隊中 */}
        <Section
          title={`排隊中（${queued.length}）`}
          color="amber"
          listings={queued}
          onCancel={(id) => cancelMutation.mutate({ id })}
          loading={allQuery.isLoading}
        />

        {/* 過期記錄 */}
        <Section
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

function Section({
  title,
  color,
  listings,
  onCancel,
  loading,
  showCountdown,
  readOnly,
}: {
  title: string;
  color: "green" | "amber" | "gray";
  listings: any[];
  onCancel?: (id: number) => void;
  loading?: boolean;
  showCountdown?: boolean;
  readOnly?: boolean;
}) {
  const headerColors = {
    green: "text-green-700 border-green-100",
    amber: "text-amber-700 border-amber-100",
    gray: "text-gray-500 border-gray-100",
  };
  const badgeColors = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-gray-50 text-gray-500",
  };

  return (
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 class={`text-base font-bold mb-4 ${headerColors[color]}`}>{title}</h3>
      {loading && <p class="text-sm text-gray-400">載入中…</p>}
      {!loading && listings.length === 0 && (
        <p class="text-sm text-gray-400">（無記錄）</p>
      )}
      {!loading && listings.length > 0 && (
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="bg-gray-50 text-gray-400 text-left">
                <th class="px-3 py-2 font-medium border border-gray-100">商品</th>
                <th class="px-3 py-2 font-medium border border-gray-100">商戶</th>
                <th class="px-3 py-2 font-medium border border-gray-100">方案</th>
                <th class="px-3 py-2 font-medium border border-gray-100">費用</th>
                {showCountdown && (
                  <th class="px-3 py-2 font-medium border border-gray-100">到期時間</th>
                )}
                {!readOnly && (
                  <th class="px-3 py-2 font-medium border border-gray-100">操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id} class="border-t border-gray-100 hover:bg-gray-50">
                  <td class="px-3 py-2 border border-gray-100">{l.productTitle}</td>
                  <td class="px-3 py-2 border border-gray-100">{l.merchantName}</td>
                  <td class="px-3 py-2 border border-gray-100">
                    <span class={`px-2 py-0.5 rounded text-xs font-medium ${badgeColors[color]}`}>
                      {l.tier}
                    </span>
                  </td>
                  <td class="px-3 py-2 border border-gray-100 text-green-700 font-medium">
                    HK${Number(l.amount).toFixed(0)}
                  </td>
                  {showCountdown && (
                    <td class="px-3 py-2 border border-gray-100 text-gray-500 text-xs">
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
                    <td class="px-3 py-2 border border-gray-100">
                      <button
                        onClick={() => onCancel?.(l.id)}
                        class="text-xs px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                      >
                        取消主打
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

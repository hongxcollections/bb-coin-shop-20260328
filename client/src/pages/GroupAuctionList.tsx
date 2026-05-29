import { useState } from "react";
import { Link, useLocation } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { Plus, ChevronLeft, Pencil, Trash2, Globe, Archive, Clock, QrCode } from "lucide-react";
import { GroupAuctionShareMenu } from "@/components/ShareMenu";
import { GroupAuctionPosterModal } from "@/components/GroupAuctionPosterModal";

function statusLabel(s: string) {
  if (s === "draft") return { text: "草稿", cls: "bg-gray-100 text-gray-600" };
  if (s === "published") return { text: "進行中", cls: "bg-green-100 text-green-700" };
  return { text: "已結拍", cls: "bg-amber-100 text-amber-700" };
}

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

export default function GroupAuctionList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"published" | "draft" | "ended">("published");
  const [posterRound, setPosterRound] = useState<any | null>(null);

  const { data: rounds, isLoading, refetch } = trpc.groupAuctions.myListRounds.useQuery(undefined, {
    enabled: !!user,
  });

  const deleteMut = trpc.groupAuctions.deleteRound.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });

  const publishMut = trpc.groupAuctions.publishRound.useMutation({
    onSuccess: () => { toast.success("已發布，出價頁已公開"); refetch(); },
    onError: (e) => toast.error(e.message || "發布失敗"),
  });

  const endMut = trpc.groupAuctions.endRound.useMutation({
    onSuccess: () => { toast.success("場次已結拍"); refetch(); },
    onError: (e) => toast.error(e.message || "結拍失敗"),
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header />
      <div className="max-w-2xl mx-auto px-[3px] pt-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setLocation("/merchant-dashboard")} className="text-gray-500 hover:text-gray-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">團購拍賣</h1>
          <div className="ml-auto">
            <Link href="/merchant/group-auctions/new">
              <button className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-xl">
                <Plus className="w-4 h-4" />
                新建場次
              </button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {(["published", "draft", "ended"] as const).map(tab => {
            const labels = { published: "Live", draft: "草稿", ended: "已結拍" };
            const count = rounds?.filter(r => r.status === tab).length ?? 0;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === tab ? "bg-white text-amber-700 shadow-sm" : "text-gray-500"
                }`}
              >
                {labels[tab]}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {isLoading && (
          <div className="text-center py-12 text-gray-400 text-sm">載入中...</div>
        )}

        {!isLoading && rounds?.filter(r => r.status === activeTab).length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {activeTab === "published" ? "未有進行中場次" : activeTab === "draft" ? "未有草稿場次" : "未有已結拍場次"}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {rounds?.filter(r => r.status === activeTab).map((r) => {
            const sl = statusLabel(r.status);
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {r.coverImage ? (
                    <img src={r.coverImage} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Archive className="w-6 h-6 text-amber-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sl.cls}`}>{sl.text}</span>
                      {r.periodNumber && (
                        <span className="text-xs text-gray-400">第 {r.periodNumber} 期</span>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 mt-1 truncate">{r.title}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {r.endAt ? `結拍：${fmtDate(r.endAt)}` : "未設結拍時間"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Link href={r.status === "ended"
                    ? `/merchant/group-auctions/${r.id}?tab=results`
                    : `/merchant/group-auctions/${r.id}`}>
                    <button className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg ${
                      r.status === "ended"
                        ? "bg-blue-50 hover:bg-blue-100 text-blue-700"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}>
                      {r.status === "ended" ? <Archive className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                      {r.status === "ended" ? "成績紀錄" : "管理"}
                    </button>
                  </Link>

                  {r.status === "published" && (
                    <Link href={`/group/${r.id}`}>
                      <button className="flex items-center gap-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg">
                        <Globe className="w-3 h-3" />
                        出價頁
                      </button>
                    </Link>
                  )}

                  <button
                    onClick={() => setPosterRound(r)}
                    className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg"
                  >
                    <QrCode className="w-3 h-3" />
                    入場海報
                  </button>

                  {r.status === "published" && (
                    <GroupAuctionShareMenu
                      roundId={r.id}
                      title={r.title}
                      endAt={r.endAt}
                    />
                  )}

                  {r.status === "draft" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "發布場次", description: "發布後出價頁即時公開，確認？" });
                        if (ok) publishMut.mutate({ id: r.id });
                      }}
                      className="flex items-center gap-1 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg"
                    >
                      <Globe className="w-3 h-3" />
                      發布
                    </button>
                  )}

                  {r.status === "published" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "手動結拍", description: "結拍後所有仍 active 商品將標記為結果，無法再出價。確認？" });
                        if (ok) endMut.mutate({ id: r.id });
                      }}
                      className="flex items-center gap-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg"
                    >
                      <Archive className="w-3 h-3" />
                      結拍
                    </button>
                  )}

                  {r.status !== "published" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "刪除場次", description: "刪除後不可恢復，所有商品及出價記錄一併刪除。確認？" });
                        if (ok) deleteMut.mutate({ id: r.id });
                      }}
                      className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-500 px-3 py-1.5 rounded-lg"
                    >
                      <Trash2 className="w-3 h-3" />
                      刪除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />

      {posterRound && (
        <GroupAuctionPosterModal
          open={!!posterRound}
          onClose={() => setPosterRound(null)}
          round={posterRound}
        />
      )}
    </div>
  );
}

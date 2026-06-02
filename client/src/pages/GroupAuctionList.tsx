import { useState } from "react";
import { Link, useLocation } from "wouter";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useConfirm } from "@/components/ui/confirm-provider";
import { toast } from "sonner";
import { Plus, ChevronLeft, Pencil, Trash2, Globe, Archive, Clock, QrCode, Receipt, ListOrdered } from "lucide-react";
import { GroupAuctionShareMenu } from "@/components/ShareMenu";
import { GroupAuctionPosterModal } from "@/components/GroupAuctionPosterModal";
import { GroupAuctionCommissionModal } from "@/components/GroupAuctionCommissionModal";
import { GroupAuctionRecordsModal } from "@/components/GroupAuctionRecordsModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

function statusLabel(s: string) {
  if (s === "draft") return { text: "草稿", cls: "bg-gray-100 text-gray-600" };
  if (s === "published") return { text: "進行中", cls: "bg-green-100 text-green-700" };
  return { text: "已結束", cls: "bg-amber-100 text-amber-700" };
}

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

function fmtDateShort(d: string | Date | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getMonth() + 1}月${dt.getDate()}日 ${dt.getHours().toString().padStart(2, "0")}:${dt.getMinutes().toString().padStart(2, "0")}`;
}

type DestroyTarget = { round: any; step: 1 | 2; inputVal: string } | null;

export default function GroupAuctionList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"published" | "draft" | "ended" | "archived">("published");
  const [posterRound, setPosterRound] = useState<any | null>(null);
  const [commissionRound, setCommissionRound] = useState<any | null>(null);
  const [platformCommissionRound, setPlatformCommissionRound] = useState<any | null>(null);
  const [recordsRound, setRecordsRound] = useState<any | null>(null);
  const [destroyTarget, setDestroyTarget] = useState<DestroyTarget>(null);

  const { data: rounds, isLoading, refetch } = trpc.groupAuctions.myListRounds.useQuery(undefined, {
    enabled: !!user,
  });

  const { data: merchantApp } = trpc.merchants.myApplication.useQuery(undefined, { enabled: !!user });

  const deleteMut = trpc.groupAuctions.deleteRound.useMutation({
    onSuccess: () => { toast.success("已刪除"); refetch(); },
    onError: (e) => toast.error(e.message || "刪除失敗"),
  });

  const destroyMut = trpc.groupAuctions.destroyRound.useMutation({
    onSuccess: () => {
      toast.success("場次已拆除");
      refetch();
      setDestroyTarget(null);
    },
    onError: (e) => toast.error(e.message || "拆除失敗"),
  });

  const publishMut = trpc.groupAuctions.publishRound.useMutation({
    onSuccess: () => { toast.success("已發布，出價頁已公開"); refetch(); },
    onError: (e) => toast.error(e.message || "發布失敗"),
  });

  const endMut = trpc.groupAuctions.endRound.useMutation({
    onSuccess: () => { toast.success("場次已結拍"); refetch(); },
    onError: (e) => toast.error(e.message || "結拍失敗"),
  });

  const archiveMut = trpc.groupAuctions.archiveRound.useMutation({
    onSuccess: () => { toast.success("已封存"); refetch(); },
    onError: (e) => toast.error(e.message || "封存失敗"),
  });

  const unarchiveMut = trpc.groupAuctions.unarchiveRound.useMutation({
    onSuccess: () => { toast.success("已取消封存"); refetch(); },
    onError: (e) => toast.error(e.message || "取消封存失敗"),
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
          {(["published", "draft", "ended", "archived"] as const).map(tab => {
            const labels = { published: "Live", draft: "草稿", ended: "已結束", archived: "封存" };
            const count = tab === "archived"
              ? rounds?.filter(r => r.status === "ended" && r.isArchived).length ?? 0
              : tab === "ended"
              ? rounds?.filter(r => r.status === "ended" && !r.isArchived).length ?? 0
              : rounds?.filter(r => r.status === tab).length ?? 0;
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

        {!isLoading && (() => {
          const visible = activeTab === "archived"
            ? rounds?.filter(r => r.status === "ended" && r.isArchived)
            : activeTab === "ended"
            ? rounds?.filter(r => r.status === "ended" && !r.isArchived)
            : rounds?.filter(r => r.status === activeTab);
          if ((visible?.length ?? 0) > 0) return null;
          const emptyMsg: Record<string, string> = {
            published: "未有進行中場次", draft: "未有草稿場次",
            ended: "未有已結束場次", archived: "未有封存場次",
          };
          return (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{emptyMsg[activeTab]}</p>
            </div>
          );
        })()}

        <div className="space-y-3">
          {(activeTab === "archived"
            ? rounds?.filter(r => r.status === "ended" && r.isArchived)
            : activeTab === "ended"
            ? rounds?.filter(r => r.status === "ended" && !r.isArchived)
            : rounds?.filter(r => r.status === activeTab)
          )?.map((r) => {
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
                      {r.startAt || r.endAt
                        ? `開拍時間：${fmtDateShort(r.startAt ?? null)} 至 ${fmtDateShort(r.endAt ?? null)}`
                        : "未設開拍時間"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Link href={r.status === "ended"
                    ? `/merchant/group-auctions/${r.id}?tab=results`
                    : `/merchant/group-auctions/${r.id}`}>
                    <button className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border ${
                      r.status === "ended"
                        ? "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200"
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

                  {r.status === "published" && (
                    <button
                      onClick={() => setRecordsRound(r)}
                      className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg"
                    >
                      <ListOrdered className="w-3 h-3" />
                      拍賣紀錄
                    </button>
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

                  {/* 已結束 + 封存 tab 共用：買家傭金 / 平台傭金 */}
                  {r.status === "ended" && (
                    <>
                      <button
                        onClick={() => setCommissionRound(r)}
                        className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg"
                      >
                        <Receipt className="w-3 h-3" />
                        買家傭金
                      </button>
                      <button
                        onClick={() => setPlatformCommissionRound(r)}
                        className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg"
                      >
                        <Receipt className="w-3 h-3" />
                        平台傭金
                      </button>

                      {/* 已結束（非封存）：封存 + 拆除 */}
                      {!r.isArchived ? (
                        <>
                          <button
                            onClick={async () => {
                              const ok = await confirm({ title: "封存場次", description: "封存後場次會移至封存tab，可隨時取消封存。確認？" });
                              if (ok) archiveMut.mutate({ id: r.id });
                            }}
                            className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 border border-gray-300 px-3 py-1.5 rounded-lg"
                          >
                            <Archive className="w-3 h-3" />
                            封存
                          </button>
                          <button
                            onClick={() => setDestroyTarget({ round: r, step: 1, inputVal: "" })}
                            className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg"
                          >
                            <Trash2 className="w-3 h-3" />
                            拆除
                          </button>
                        </>
                      ) : (
                        /* 封存 tab：取消封存 */
                        <button
                          onClick={() => unarchiveMut.mutate({ id: r.id })}
                          className="flex items-center gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg"
                        >
                          <Archive className="w-3 h-3" />
                          取消封存
                        </button>
                      )}
                    </>
                  )}

                  {r.status === "draft" && (
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

      {/* Poster modal */}
      {posterRound && (
        <GroupAuctionPosterModal
          open={!!posterRound}
          onClose={() => setPosterRound(null)}
          round={posterRound}
          merchantName={(merchantApp as any)?.merchantName ?? (user as any)?.name}
          merchantAvatar={(merchantApp as any)?.merchantIcon || (user as any)?.photoUrl}
        />
      )}

      {/* 拍賣紀錄 modal — Live tab */}
      {recordsRound && (
        <GroupAuctionRecordsModal
          open={!!recordsRound}
          onClose={() => setRecordsRound(null)}
          roundId={recordsRound.id}
          roundTitle={recordsRound.title}
        />
      )}

      {/* Commission modals — 已結束 + 封存 tab 共用同一 component */}
      {commissionRound && (
        <GroupAuctionCommissionModal
          open={!!commissionRound}
          onClose={() => setCommissionRound(null)}
          roundId={commissionRound.id}
          roundTitle={commissionRound.title}
          type="buyer"
        />
      )}
      {platformCommissionRound && (
        <GroupAuctionCommissionModal
          open={!!platformCommissionRound}
          onClose={() => setPlatformCommissionRound(null)}
          roundId={platformCommissionRound.id}
          roundTitle={platformCommissionRound.title}
          type="platform"
        />
      )}

      {/* 拆除確認 — 單一 AlertDialog，step 控制內容 */}
      <AlertDialog open={!!destroyTarget} onOpenChange={(open) => { if (!open && !destroyMut.isPending) setDestroyTarget(null); }}>
        <AlertDialogContent>
          {destroyTarget?.step === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>拆除場次？</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-gray-600 space-y-2">
                    <p>此操作不可撤銷，以下資料將被永久刪除：</p>
                    <ul className="list-disc list-inside text-gray-500 space-y-1">
                      <li>場次資料及所有商品</li>
                      <li>所有出價紀錄</li>
                      <li>場次圖片</li>
                    </ul>
                    <p className="text-amber-700 font-medium">已扣除的平台傭金保留在保證金紀錄，不受影響。</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDestroyTarget(null)}>取消</AlertDialogCancel>
                <button
                  className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2"
                  onClick={() => setDestroyTarget(prev => prev ? { ...prev, step: 2 } : null)}
                >
                  繼續
                </button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>輸入場次名稱確認</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-gray-600 space-y-3">
                    <p>請輸入以下場次名稱以確認拆除：</p>
                    <p className="font-semibold text-gray-900 bg-gray-100 rounded-lg px-3 py-2 break-all">
                      {destroyTarget?.round?.title}
                    </p>
                    <input
                      className="w-full text-sm outline-none px-3 py-2"
                      style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: "12px" }}
                      placeholder="輸入場次名稱..."
                      value={destroyTarget?.inputVal ?? ""}
                      onChange={(e) => setDestroyTarget(prev => prev ? { ...prev, inputVal: e.target.value } : null)}
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDestroyTarget(null)}>取消</AlertDialogCancel>
                <button
                  className="inline-flex items-center justify-center rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 disabled:opacity-40"
                  disabled={destroyTarget?.inputVal !== destroyTarget?.round?.title || destroyMut.isPending}
                  onClick={() => {
                    if (destroyTarget && destroyTarget.inputVal === destroyTarget.round.title) {
                      destroyMut.mutate({ id: destroyTarget.round.id });
                    }
                  }}
                >
                  {destroyMut.isPending ? "拆除中..." : "確認拆除"}
                </button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

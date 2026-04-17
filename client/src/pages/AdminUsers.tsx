import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Pencil, Trash2, Store, UserRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { MemberBadge, type MemberLevel } from "@/components/MemberBadge";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  role: string | null;
  memberLevel: string | null;
  createdAt: Date | null;
  lastSignedIn: Date | null;
  depositId: number | null;
  depositBalance: string | null;
  requiredDeposit: string | null;
  commissionRate: string | null;
  depositIsActive: number | null;
};

type EditState = {
  userId: number;
  name: string;
  email: string;
  phone: string;
  memberLevel: MemberLevel;
  isMerchant: boolean;
  requiredDeposit: string;
  commissionRate: string;
  depositIsActive: number;
};

export default function AdminUsers() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const { data: users, isLoading, refetch } = trpc.users.listAllExtended.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const adminUpdate = trpc.users.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("用戶資料已更新");
      setEditState(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const adminUpdateDeposit = trpc.users.adminUpdateDeposit.useMutation({
    onSuccess: () => {
      toast.success("保證金設定已更新");
    },
    onError: (err) => toast.error(err.message),
  });

  const adminDelete = trpc.users.adminDelete.useMutation({
    onSuccess: () => {
      toast.success("用戶及所有相關資料已刪除");
      setDeleteTarget(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    navigate("/");
    return null;
  }

  const allUsers: UserRow[] = (users ?? []) as UserRow[];
  const buyers = allUsers.filter((u) => !u.depositId && u.role !== "admin");
  const merchants = allUsers.filter((u) => !!u.depositId);
  const admins = allUsers.filter((u) => u.role === "admin");

  function openEdit(u: UserRow) {
    setEditState({
      userId: u.id,
      name: u.name ?? "",
      email: u.email ?? "",
      phone: u.phone ?? "",
      memberLevel: (u.memberLevel ?? "bronze") as MemberLevel,
      isMerchant: !!u.depositId,
      requiredDeposit: u.requiredDeposit ?? "500.00",
      commissionRate: u.commissionRate ? (parseFloat(u.commissionRate) * 100).toFixed(1) : "5.0",
      depositIsActive: u.depositIsActive ?? 1,
    });
  }

  function handleSaveEdit() {
    if (!editState) return;
    adminUpdate.mutate({
      userId: editState.userId,
      name: editState.name || undefined,
      email: editState.email || undefined,
      phone: editState.phone || undefined,
      memberLevel: editState.memberLevel,
    });
    if (editState.isMerchant) {
      adminUpdateDeposit.mutate({
        userId: editState.userId,
        requiredDeposit: parseFloat(editState.requiredDeposit),
        commissionRate: parseFloat(editState.commissionRate) / 100,
        isActive: editState.depositIsActive,
      });
    }
  }

  function formatDate(d: Date | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("zh-HK", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function renderUserList(list: UserRow[], emptyText: string) {
    if (isLoading) {
      return (
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-14 bg-amber-50 rounded animate-pulse" />
          ))}
        </div>
      );
    }
    if (list.length === 0) {
      return <div className="p-8 text-center text-muted-foreground text-sm">{emptyText}</div>;
    }
    return (
      <div className="divide-y divide-amber-50">
        {list.map((u) => (
          <div key={u.id} className="px-4 py-3 hover:bg-amber-50/40 transition-colors">
            <div className="flex items-start justify-between gap-2">
              {/* Avatar + info */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 mt-0.5">
                  {u.depositId
                    ? <Store className="w-4 h-4" />
                    : u.role === "admin"
                    ? <ShieldAlert className="w-4 h-4" />
                    : <UserRound className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    <span className="font-medium text-sm">{u.name ?? "未知用戶"}</span>
                    <MemberBadge level={u.memberLevel} variant="badge" size="sm" />
                    {u.role === "admin" && (
                      <Badge className="bg-amber-600 text-white text-[0.6rem] px-1.5 py-0">管理員</Badge>
                    )}
                    {u.depositId && (
                      <Badge className={`text-[0.6rem] px-1.5 py-0 ${u.depositIsActive ? "bg-emerald-600 text-white" : "bg-gray-400 text-white"}`}>
                        {u.depositIsActive ? "商戶活躍" : "商戶停用"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 min-w-0">
                    {u.email && (
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="flex-shrink-0">📧</span>
                        <span className="truncate">{u.email}</span>
                      </div>
                    )}
                    {u.phone && (
                      <div className="whitespace-nowrap">📱 {u.phone}</div>
                    )}
                    {u.depositId && (
                      <div className="text-amber-700 whitespace-nowrap">
                        💰 HK${parseFloat(u.depositBalance ?? "0").toFixed(0)} ／ 門檻 HK${parseFloat(u.requiredDeposit ?? "500").toFixed(0)} ／ 佣金 {(parseFloat(u.commissionRate ?? "0.05") * 100).toFixed(1)}%
                      </div>
                    )}
                    <div className="text-gray-400 whitespace-nowrap">登入方式：{u.loginMethod ?? "—"}</div>
                    <div className="text-gray-400 whitespace-nowrap">加入：{formatDate(u.createdAt)}</div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {u.role !== "admin" && (
                <div className="flex gap-1.5 flex-shrink-0 mt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => openEdit(u)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1" />
                    修改
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget({ id: u.id, name: u.name ?? "此用戶" })}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    拆除
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-8 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-900">會員管理</h1>
            <p className="text-sm text-muted-foreground">
              共 {allUsers.length} 人 ｜ 買家 {buyers.length} ｜ 商戶 {merchants.length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all">
          <TabsList className="mb-4 bg-amber-100/60">
            <TabsTrigger value="all" className="data-[state=active]:bg-white">
              全部 <span className="ml-1.5 text-xs text-muted-foreground">({allUsers.length})</span>
            </TabsTrigger>
            <TabsTrigger value="buyers" className="data-[state=active]:bg-white">
              <UserRound className="w-3.5 h-3.5 mr-1" />
              買家 <span className="ml-1.5 text-xs text-muted-foreground">({buyers.length})</span>
            </TabsTrigger>
            <TabsTrigger value="merchants" className="data-[state=active]:bg-white">
              <Store className="w-3.5 h-3.5 mr-1" />
              商戶 <span className="ml-1.5 text-xs text-muted-foreground">({merchants.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  所有用戶
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderUserList(allUsers, "尚無用戶")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buyers">
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserRound className="w-4 h-4 text-amber-600" />
                  買家列表
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderUserList(buyers, "暫無買家")}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merchants">
            <Card className="border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="w-4 h-4 text-amber-600" />
                  商戶列表
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {renderUserList(merchants, "暫無商戶")}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editState} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>修改用戶資料</DialogTitle>
          </DialogHeader>
          {editState && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>姓名</Label>
                <Input
                  value={editState.name}
                  onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                  placeholder="用戶姓名"
                />
              </div>
              <div className="space-y-1.5">
                <Label>電郵</Label>
                <Input
                  type="email"
                  value={editState.email}
                  onChange={(e) => setEditState({ ...editState, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>電話</Label>
                <Input
                  value={editState.phone}
                  onChange={(e) => setEditState({ ...editState, phone: e.target.value })}
                  placeholder="+852 XXXX XXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label>會員等級</Label>
                <Select
                  value={editState.memberLevel}
                  onValueChange={(val) => setEditState({ ...editState, memberLevel: val as MemberLevel })}
                >
                  <SelectTrigger className="border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">🥉 銅牌會員</SelectItem>
                    <SelectItem value="silver">🥈 銀牌會員</SelectItem>
                    <SelectItem value="gold">🥇 金牌會員</SelectItem>
                    <SelectItem value="vip">💎 VIP 會員</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editState.isMerchant && (
                <div className="border border-amber-100 rounded-lg p-3 space-y-3 bg-amber-50/50">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">商戶保證金設定</p>
                  <div className="space-y-1.5">
                    <Label>保證金門檻 (HKD)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editState.requiredDeposit}
                      onChange={(e) => setEditState({ ...editState, requiredDeposit: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>佣金率 (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={editState.commissionRate}
                      onChange={(e) => setEditState({ ...editState, commissionRate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>商戶狀態</Label>
                    <Select
                      value={String(editState.depositIsActive)}
                      onValueChange={(val) => setEditState({ ...editState, depositIsActive: parseInt(val) })}
                    >
                      <SelectTrigger className="border-amber-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">✅ 活躍（可上架）</SelectItem>
                        <SelectItem value="0">🚫 停用（不可上架）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditState(null)}>取消</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleSaveEdit}
              disabled={adminUpdate.isPending || adminUpdateDeposit.isPending}
            >
              {adminUpdate.isPending ? "儲存中…" : "儲存變更"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">確認拆除用戶？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                您即將永久刪除用戶 <strong>{deleteTarget?.name}</strong> 及其所有相關資料，包括：
              </p>
              <ul className="text-sm list-disc list-inside space-y-1 text-muted-foreground">
                <li>所有出價記錄</li>
                <li>代理出價設定</li>
                <li>收藏清單</li>
                <li>訂閱記錄</li>
                <li>保證金及交易記錄（如有）</li>
              </ul>
              <p className="font-semibold text-red-600">此操作不可逆，請謹慎確認。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && adminDelete.mutate({ userId: deleteTarget.id })}
              disabled={adminDelete.isPending}
            >
              {adminDelete.isPending ? "刪除中…" : "確認永久刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

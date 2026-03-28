import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, TrendingUp, Clock, LogOut } from "lucide-react";

function formatDate(date: Date) {
  return new Date(date).toLocaleString("zh-HK", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

interface AuctionFormData {
  title: string;
  description: string;
  startingPrice: string;
  endTime: string;
  imageUrl: string;
}

const defaultForm: AuctionFormData = {
  title: "",
  description: "",
  startingPrice: "",
  endTime: "",
  imageUrl: "",
};

export default function AdminAuctions() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AuctionFormData>(defaultForm);

  const { data: auctions, isLoading, refetch } = trpc.auctions.myAuctions.useQuery();

  const createAuction = trpc.auctions.create.useMutation({
    onSuccess: () => { toast.success("拍賣建立成功！"); setOpen(false); setForm(defaultForm); refetch(); },
    onError: (err) => toast.error(err.message || "建立失敗"),
  });

  const updateAuction = trpc.auctions.update.useMutation({
    onSuccess: () => { toast.success("拍賣更新成功！"); setOpen(false); setEditId(null); setForm(defaultForm); refetch(); },
    onError: (err) => toast.error(err.message || "更新失敗"),
  });

  const deleteAuction = trpc.auctions.delete.useMutation({
    onSuccess: () => { toast.success("拍賣已刪除"); refetch(); },
    onError: (err) => toast.error(err.message || "刪除失敗"),
  });

  const handleSubmit = () => {
    if (!form.title || !form.startingPrice || !form.endTime) {
      toast.error("請填寫所有必填欄位");
      return;
    }
    if (editId) {
      updateAuction.mutate({
        id: editId,
        title: form.title,
        description: form.description,
        endTime: new Date(form.endTime),
      });
    } else {
      createAuction.mutate({
        title: form.title,
        description: form.description,
        startingPrice: parseFloat(form.startingPrice),
        endTime: new Date(form.endTime),
      });
    }
  };

  const openEdit = (auction: { id: number; title: string; description: string | null; startingPrice: string | number; endTime: Date; images: unknown }) => {
    setEditId(auction.id);
    const images = auction.images as Array<{ imageUrl: string }>;
    setForm({
      title: auction.title,
      description: auction.description ?? "",
      startingPrice: String(auction.startingPrice),
      endTime: new Date(auction.endTime).toISOString().slice(0, 16),
      imageUrl: images?.[0]?.imageUrl ?? "",
    });
    setOpen(true);
  };

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-lg font-medium mb-4">需要管理員權限</p>
          <Link href="/"><Button className="gold-gradient text-white border-0">返回首頁</Button></Link>
        </div>
      </div>
    );
  }

  const activeCount = (auctions ?? []).filter((a: { status: string }) => a.status === "active").length;
  const endedCount = (auctions ?? []).filter((a: { status: string }) => a.status === "ended").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="nav-glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-2xl">💰</span>
            <span className="gold-gradient-text">大BB錢幣店</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/auctions">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">所有拍賣</Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm" className="text-amber-700 hover:text-amber-900 hover:bg-amber-50">{user?.name}</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout} className="border-red-200 text-red-600 hover:bg-red-50">
              <LogOut className="w-3.5 h-3.5 mr-1" /> 登出
            </Button>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">管理後台</h1>
            <p className="text-muted-foreground mt-1">管理所有拍賣商品</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(defaultForm); } }}>
            <DialogTrigger asChild>
              <Button className="gold-gradient text-white border-0 shadow-md hover:opacity-90">
                <Plus className="w-4 h-4 mr-2" /> 新增拍賣
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editId ? "編輯拍賣" : "新增拍賣"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="title">拍品名稱 *</Label>
                  <Input id="title" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例：1980年香港一元硬幣" className="mt-1 border-amber-200" />
                </div>
                <div>
                  <Label htmlFor="desc">描述</Label>
                  <Input id="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="拍品詳細說明" className="mt-1 border-amber-200" />
                </div>
                <div>
                  <Label htmlFor="price">起拍價（HK$）*</Label>
                  <Input id="price" type="number" value={form.startingPrice} onChange={(e) => setForm(f => ({ ...f, startingPrice: e.target.value }))} placeholder="100" className="mt-1 border-amber-200" />
                </div>
                <div>
                  <Label htmlFor="endTime">結束時間 *</Label>
                  <Input id="endTime" type="datetime-local" value={form.endTime} onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))} className="mt-1 border-amber-200" />
                </div>
                <div>
                  <Label htmlFor="imageUrl">圖片 URL</Label>
                  <Input id="imageUrl" value={form.imageUrl} onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." className="mt-1 border-amber-200" />
                </div>
                <Button
                  onClick={handleSubmit}
                  disabled={createAuction.isPending || updateAuction.isPending}
                  className="w-full gold-gradient text-white border-0"
                >
                  {createAuction.isPending || updateAuction.isPending ? "處理中..." : editId ? "更新拍賣" : "建立拍賣"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "全部拍賣", value: auctions?.length ?? 0, color: "text-amber-700" },
            { label: "競拍中", value: activeCount, color: "text-emerald-600" },
            { label: "已結束", value: endedCount, color: "text-gray-500" },
          ].map((s) => (
            <Card key={s.label} className="border-amber-100 text-center">
              <CardContent className="py-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Auctions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-amber-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : auctions && auctions.length > 0 ? (
          <div className="space-y-3">
            {auctions.map((auction: {
              id: number;
              title: string;
              description: string | null;
              startingPrice: string | number;
              currentPrice: string | number;
              endTime: Date;
              status: string;
              images: unknown;
            }) => {
              const images = auction.images as Array<{ imageUrl: string }>;
              const gain = Number(auction.currentPrice) - Number(auction.startingPrice);
              const gainPct = Number(auction.startingPrice) > 0 ? ((gain / Number(auction.startingPrice)) * 100).toFixed(1) : "0";
              return (
                <Card key={auction.id} className="border-amber-100 hover:border-amber-300 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-lg coin-placeholder flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {images?.[0]?.imageUrl ? (
                          <img src={images[0].imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🪙</span>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{auction.title}</h3>
                          <Badge className={auction.status === "active" ? "bg-emerald-500 text-white text-xs" : "bg-gray-400 text-white text-xs"}>
                            {auction.status === "active" ? "競拍中" : "已結束"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            HK${Number(auction.currentPrice).toLocaleString()}
                            {gain > 0 && <span className="text-emerald-600 font-medium ml-1">+{gainPct}%</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(new Date(auction.endTime))}
                          </span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(auction)}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm("確定要刪除此拍賣嗎？")) {
                              deleteAuction.mutate({ id: auction.id });
                            }
                          }}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-lg font-medium">尚無拍賣商品</p>
            <p className="text-sm mt-1">點擊「新增拍賣」開始建立</p>
          </div>
        )}
      </div>
    </div>
  );
}

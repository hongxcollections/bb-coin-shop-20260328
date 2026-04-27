import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminHeader from "@/components/AdminHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Megaphone, Users, Store, Eye } from "lucide-react";
import { toast } from "sonner";

type TargetType = "guest" | "member" | "merchant";

const TYPE_LABELS: Record<TargetType, { label: string; desc: string; icon: typeof Eye; color: string }> = {
  guest:    { label: "未登入用戶", desc: "訪客（尚未登入）看到的廣告",    icon: Eye,      color: "text-blue-600" },
  member:   { label: "會員（非商戶）",  desc: "已登入但非商戶的會員看到的廣告", icon: Users,    color: "text-violet-600" },
  merchant: { label: "商戶",          desc: "商戶登入後看到的廣告",         icon: Store,    color: "text-amber-600" },
};

type BannerSlot = { slot: number; title: string | null; body: string | null };
type Config = { targetType: string; enabled: boolean; activeSlot: number };

type LocalState = {
  enabled: boolean;
  activeSlot: number;
  slots: { title: string; body: string }[];
};

const empty3 = (): { title: string; body: string }[] =>
  [1, 2, 3].map(() => ({ title: "", body: "" }));

function initLocal(config: Config, banners: BannerSlot[]): LocalState {
  const slots = empty3();
  banners.forEach(b => {
    if (b.slot >= 1 && b.slot <= 3) {
      slots[b.slot - 1] = { title: b.title ?? "", body: b.body ?? "" };
    }
  });
  return { enabled: config.enabled, activeSlot: config.activeSlot, slots };
}

export default function AdminAds() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === "admin";

  const { data, isLoading, refetch } = trpc.ads.getAll.useQuery(undefined, { enabled: isAdmin });

  const [state, setState] = useState<Record<TargetType, LocalState>>({
    guest:    { enabled: false, activeSlot: 1, slots: empty3() },
    member:   { enabled: false, activeSlot: 1, slots: empty3() },
    merchant: { enabled: false, activeSlot: 1, slots: empty3() },
  });
  const [initialized, setInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<TargetType>("guest");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      const next = { ...state };
      (["guest", "member", "merchant"] as TargetType[]).forEach(t => {
        const cfg = data.configs.find(c => c.targetType === t);
        const banners = data.banners.filter(b => b.targetType === t);
        if (cfg) next[t] = initLocal(cfg as Config, banners as BannerSlot[]);
      });
      setState(next);
      setInitialized(true);
    }
  }, [data, initialized]);

  const upsertMutation = trpc.ads.upsert.useMutation();
  const setConfigMutation = trpc.ads.setConfig.useMutation();

  const handleSave = async (t: TargetType) => {
    setSaving(true);
    try {
      const s = state[t];
      await setConfigMutation.mutateAsync({ targetType: t, enabled: s.enabled, activeSlot: s.activeSlot });
      await Promise.all(s.slots.map((sl, i) =>
        upsertMutation.mutateAsync({ targetType: t, slot: i + 1, title: sl.title || null, body: sl.body || null })
      ));
      toast.success("廣告設定已儲存");
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "儲存失敗");
    } finally {
      setSaving(false);
    }
  };

  const updateSlot = (t: TargetType, slotIdx: number, field: "title" | "body", val: string) => {
    setState(prev => ({
      ...prev,
      [t]: {
        ...prev[t],
        slots: prev[t].slots.map((s, i) => i === slotIdx ? { ...s, [field]: val } : s),
      },
    }));
  };

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">無權限</div>;

  const tabs: TargetType[] = ["guest", "member", "merchant"];
  const cur = state[activeTab];
  const meta = TYPE_LABELS[activeTab];
  const MetaIcon = meta.icon;

  return (
    <div className="min-h-screen bg-amber-50/30">
      <AdminHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-amber-500" />
          <h1 className="text-lg font-semibold">彈出廣告管理</h1>
        </div>

        {/* 三個身份 tab */}
        <div className="flex gap-1.5 bg-white rounded-xl p-1 border border-amber-100">
          {tabs.map(t => {
            const m = TYPE_LABELS[t];
            const Icon = m.icon;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === t
                    ? "bg-amber-100 text-amber-800 shadow-sm"
                    : "text-muted-foreground hover:bg-amber-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
                {state[t].enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">載入中…</span>
          </div>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MetaIcon className={`w-4 h-4 ${meta.color}`} />
                {meta.label}
                <span className="text-xs font-normal text-muted-foreground ml-1">{meta.desc}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 開關 + 選擇版本 */}
              <div className="flex items-center justify-between gap-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">啟用廣告</div>
                  <div className="text-xs text-muted-foreground mt-0.5">關閉後此身份不會看到任何廣告</div>
                </div>
                <Switch
                  checked={cur.enabled}
                  onCheckedChange={v => setState(p => ({ ...p, [activeTab]: { ...p[activeTab], enabled: v } }))}
                />
              </div>

              <div className={`transition-opacity ${cur.enabled ? "" : "opacity-40"}`}>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  🎲 系統每次自動從<strong>有內容的版本</strong>中隨機選一個顯示，可同時填寫多個版本輪流出現
                </p>
              </div>

              {/* 三個版本的內容編輯 */}
              <div className="space-y-4">
                {[1, 2, 3].map(n => {
                  const slotData = cur.slots[n - 1];
                  const hasCnt = !!(slotData.title.trim() || slotData.body.trim());
                  return (
                    <div key={n} className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${hasCnt && cur.enabled ? "border-amber-300 bg-amber-50/60" : "border-border bg-white"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hasCnt ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"}`}>
                          版本 {n}
                        </span>
                        {hasCnt && cur.enabled && <span className="text-xs text-amber-600 font-medium">🎲 納入隨機池</span>}
                        {!hasCnt && <span className="text-xs text-muted-foreground">（空白，不會顯示）</span>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`title-${activeTab}-${n}`} className="text-xs">標題（選填）</Label>
                        <Input
                          id={`title-${activeTab}-${n}`}
                          value={slotData.title}
                          onChange={e => updateSlot(activeTab, n - 1, "title", e.target.value)}
                          placeholder="廣告標題…"
                          className="text-sm h-8"
                          maxLength={200}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`body-${activeTab}-${n}`} className="text-xs">廣告內容</Label>
                        <Textarea
                          id={`body-${activeTab}-${n}`}
                          rows={3}
                          value={slotData.body}
                          onChange={e => updateSlot(activeTab, n - 1, "body", e.target.value)}
                          placeholder="廣告文字內容…"
                          className="text-sm resize-none"
                          maxLength={5000}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  onClick={() => handleSave(activeTab)}
                  disabled={saving}
                  className="gold-gradient text-white border-0 gap-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  儲存設定
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

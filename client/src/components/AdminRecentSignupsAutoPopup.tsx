import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminRecentSignupsModal from "@/components/AdminRecentSignupsModal";

/**
 * 全域掛載：admin 一登入（任何頁面）就自動彈出最近 3 日新註冊 modal。
 * 同一個 HK 日子內只彈一次（用 sessionStorage 標記）。
 */
export default function AdminRecentSignupsAutoPopup() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role !== "admin") return;
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Hong_Kong",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const today = fmt.format(new Date()); // YYYY-MM-DD
      const flagKey = `admin_recent_signups_shown_${today}`;
      if (!sessionStorage.getItem(flagKey)) {
        sessionStorage.setItem(flagKey, "1");
        setOpen(true);
      }
    } catch {}
  }, [isAuthenticated, user?.role]);

  return <AdminRecentSignupsModal open={open} onOpenChange={setOpen} />;
}

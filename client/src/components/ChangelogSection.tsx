import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ChangelogEntry {
  date: string;
  badge?: string;
  badgeColor?: string;
  items: {
    icon: string;
    title: string;
    desc: string;
  }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026年3月30日",
    badge: "最新",
    badgeColor: "bg-amber-500 text-white",
    items: [
      {
        icon: "📊",
        title: "競投中商品優先排序",
        desc: "所有拍賣列表頁面，競投中的商品自動排在最前面，並按結束時間由近至遠排列，讓您第一眼看到快要截止的拍賣。",
      },
      {
        icon: "📤",
        title: "社群媒體分享功能",
        desc: "每個商品卡片新增「分享」按鈕，可一鍵分享至 Facebook、X/Twitter、WhatsApp，或複製連結發送給朋友。",
      },
      {
        icon: "🏷️",
        title: "出價紀錄篩選標籤",
        desc: "「我的出價紀錄」頁面新增「全部」、「進行中」、「已得標」三個篩選標籤，快速過濾您想查看的記錄。",
      },
      {
        icon: "🏆",
        title: "得標徽章",
        desc: "競標成功的商品卡片右上角會顯示金色「得標」徽章，讓您一眼識別已得標的拍賣。",
      },
    ],
  },
  {
    date: "2026年3月29日",
    items: [
      {
        icon: "📋",
        title: "出價紀錄 Accordion 分組",
        desc: "「我的出價紀錄」改為按商品分組顯示，同一商品的多次出價合併為一張卡片，點擊可展開查看詳細競標過程。",
      },
      {
        icon: "👥",
        title: "完整競標過程查看",
        desc: "展開出價紀錄後，可查看該拍賣所有出價者的完整競標歷史，了解整個競標過程。",
      },
      {
        icon: "🔔",
        title: "出價通知設定",
        desc: "用戶可在個人設定中開啟「被超標通知」、「得標通知」及「即將結束通知」，透過電郵接收拍賣狀態更新。",
      },
    ],
  },
  {
    date: "2026年3月28日",
    items: [
      {
        icon: "🤖",
        title: "代理出價（Proxy Bid）",
        desc: "設定最高願付金額，系統自動代您出價至上限，無需時刻守候。有對手出價時，系統即時回應，確保您保持領先。",
      },
      {
        icon: "🖼️",
        title: "商品多圖上傳",
        desc: "管理員可為每個拍賣上傳多張商品圖片，買家可在詳情頁左右滑動查看所有圖片。",
      },
      {
        icon: "📦",
        title: "拍賣封存功能",
        desc: "已結束的拍賣可封存至歸檔區，保持主列表整潔，封存記錄仍可隨時查閱。",
      },
      {
        icon: "🔁",
        title: "重新上架功能",
        desc: "已結束的拍賣可一鍵複製設定重新上架，省去重複填寫資料的時間。",
      },
    ],
  },
  {
    date: "2026年3月27日",
    items: [
      {
        icon: "🏠",
        title: "網站正式上線",
        desc: "大BB錢幣店正式開幕！提供安全、透明的錢幣競標平台，匯聚古幣、紀念幣、外幣精品。",
      },
      {
        icon: "🔐",
        title: "用戶登入系統",
        desc: "透過 Manus OAuth 安全登入，保護您的帳戶資料，支援個人資料管理。",
      },
      {
        icon: "⚡",
        title: "即時競標系統",
        desc: "支援即時出價，倒數計時器自動更新，確保競標過程公平透明。",
      },
      {
        icon: "🛠️",
        title: "管理員後台",
        desc: "管理員可新增、編輯、刪除拍賣，管理出價記錄，並透過 Facebook 貼文連結同步宣傳。",
      },
    ],
  },
];

export function ChangelogSection() {
  const [open, setOpen] = useState(false);

  return (
    <section className="w-full max-w-2xl mx-auto px-4 pb-12">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📅</span>
          <div className="text-left">
            <div className="font-semibold text-amber-800 text-sm">網站功能更新歷史</div>
            <div className="text-xs text-amber-600 mt-0.5">查看所有新增功能與改進記錄</div>
          </div>
        </div>
        <div className="shrink-0 text-amber-500 group-hover:text-amber-700 transition-colors">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Timeline */}
      {open && (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-white overflow-hidden">
          {CHANGELOG.map((entry, ei) => (
            <div key={entry.date} className={ei > 0 ? "border-t border-amber-50" : ""}>
              {/* Date header */}
              <div className="flex items-center gap-2 px-5 py-3 bg-amber-50/60">
                <span className="text-xs font-bold text-amber-700">{entry.date}</span>
                {entry.badge && (
                  <span className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full ${entry.badgeColor}`}>
                    {entry.badge}
                  </span>
                )}
              </div>

              {/* Items */}
              <div className="px-5 py-3 space-y-4">
                {entry.items.map((item, ii) => (
                  <div key={ii} className="flex gap-3">
                    {/* Icon + vertical line */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-lg shadow-sm">
                        {item.icon}
                      </div>
                      {ii < entry.items.length - 1 && (
                        <div className="w-0.5 flex-1 mt-1 bg-amber-100 min-h-[1rem]" />
                      )}
                    </div>
                    {/* Text */}
                    <div className="pb-1 min-w-0">
                      <div className="font-semibold text-sm text-amber-900 leading-snug">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-amber-50 bg-amber-50/40 text-center">
            <span className="text-[0.65rem] text-amber-500">🚀 持續更新中，敬請期待更多新功能</span>
          </div>
        </div>
      )}
    </section>
  );
}

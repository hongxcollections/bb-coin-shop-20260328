import { describe, it, expect } from "vitest";

// ============================================================
// 付款狀態追蹤功能單元測試
// ============================================================

// 狀態設定（與前後端共用邏輯一致）
const VALID_STATUSES = ["pending_payment", "paid", "delivered"] as const;
type PaymentStatus = (typeof VALID_STATUSES)[number];

// 模擬狀態遷移規則
function canBuyerUpdate(
  currentStatus: PaymentStatus | null,
  newStatus: PaymentStatus
): boolean {
  // 買家只能將狀態設為 "paid"（已付款）
  if (newStatus !== "paid") return false;
  // 已交收後不可回退
  if (currentStatus === "delivered") return false;
  return true;
}

function canAdminUpdate(
  _currentStatus: PaymentStatus | null,
  newStatus: PaymentStatus
): boolean {
  // 管理員可設定任意有效狀態
  return VALID_STATUSES.includes(newStatus);
}

function isValidStatus(status: string): status is PaymentStatus {
  return VALID_STATUSES.includes(status as PaymentStatus);
}

// ============================================================
// 狀態驗證測試
// ============================================================
describe("付款狀態驗證", () => {
  it("應接受所有有效狀態", () => {
    expect(isValidStatus("pending_payment")).toBe(true);
    expect(isValidStatus("paid")).toBe(true);
    expect(isValidStatus("delivered")).toBe(true);
  });

  it("應拒絕無效狀態", () => {
    expect(isValidStatus("unknown")).toBe(false);
    expect(isValidStatus("refunded")).toBe(false);
    expect(isValidStatus("")).toBe(false);
  });
});

// ============================================================
// 買家操作權限測試
// ============================================================
describe("買家付款狀態更新權限", () => {
  it("買家可從 null 狀態標記為已付款", () => {
    expect(canBuyerUpdate(null, "paid")).toBe(true);
  });

  it("買家可從待付款標記為已付款", () => {
    expect(canBuyerUpdate("pending_payment", "paid")).toBe(true);
  });

  it("買家不可將狀態設為待付款", () => {
    expect(canBuyerUpdate(null, "pending_payment")).toBe(false);
  });

  it("買家不可將狀態設為已交收", () => {
    expect(canBuyerUpdate("paid", "delivered")).toBe(false);
  });

  it("已交收後買家不可回退至已付款", () => {
    expect(canBuyerUpdate("delivered", "paid")).toBe(false);
  });
});

// ============================================================
// 管理員操作權限測試
// ============================================================
describe("管理員付款狀態更新權限", () => {
  it("管理員可設定為待付款", () => {
    expect(canAdminUpdate(null, "pending_payment")).toBe(true);
  });

  it("管理員可設定為已付款", () => {
    expect(canAdminUpdate("pending_payment", "paid")).toBe(true);
  });

  it("管理員可設定為已交收", () => {
    expect(canAdminUpdate("paid", "delivered")).toBe(true);
  });

  it("管理員可從已交收回退至待付款", () => {
    expect(canAdminUpdate("delivered", "pending_payment")).toBe(true);
  });

  it("管理員不可設定無效狀態", () => {
    expect(canAdminUpdate(null, "unknown" as PaymentStatus)).toBe(false);
  });
});

// ============================================================
// 狀態遷移流程測試
// ============================================================
describe("付款狀態遷移流程", () => {
  it("標準流程：null → pending_payment → paid → delivered", () => {
    // 管理員設定待付款
    expect(canAdminUpdate(null, "pending_payment")).toBe(true);
    // 買家標記已付款
    expect(canBuyerUpdate("pending_payment", "paid")).toBe(true);
    // 管理員確認已交收
    expect(canAdminUpdate("paid", "delivered")).toBe(true);
  });

  it("簡化流程：買家直接從 null 標記已付款", () => {
    expect(canBuyerUpdate(null, "paid")).toBe(true);
  });

  it("管理員可在任意階段更新狀態（糾錯場景）", () => {
    expect(canAdminUpdate("delivered", "pending_payment")).toBe(true);
    expect(canAdminUpdate("delivered", "paid")).toBe(true);
  });
});

// ============================================================
// 狀態顯示文字測試
// ============================================================
describe("付款狀態顯示文字", () => {
  const STATUS_LABELS: Record<PaymentStatus, string> = {
    pending_payment: "待付款",
    paid: "已付款",
    delivered: "已交收",
  };

  it("每個有效狀態都有對應的顯示文字", () => {
    for (const status of VALID_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });

  it("null 狀態顯示為未設定", () => {
    const label = (status: PaymentStatus | null) =>
      status ? STATUS_LABELS[status] : "未設定狀態";
    expect(label(null)).toBe("未設定狀態");
    expect(label("paid")).toBe("已付款");
  });
});

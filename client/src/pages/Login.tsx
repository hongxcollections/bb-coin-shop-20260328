import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Mail, Phone, Lock, User, ShieldCheck, ChevronDown, Bell, Bot, Shield, BadgeCheck, Clock, CheckCircle2, Lightbulb, X } from "lucide-react";
import Header from "@/components/Header";
import { useToast } from "@/contexts/ToastContext";

const COUNTRIES = [
  { code: "+852", flag: "🇭🇰", name: "香港" },
  { code: "+86",  flag: "🇨🇳", name: "中國大陸" },
  { code: "+853", flag: "🇲🇴", name: "澳門" },
  { code: "+886", flag: "🇹🇼", name: "台灣" },
  { code: "+65",  flag: "🇸🇬", name: "新加坡" },
  { code: "+60",  flag: "🇲🇾", name: "馬來西亞" },
  { code: "+1",   flag: "🇺🇸", name: "美國/加拿大" },
  { code: "+44",  flag: "🇬🇧", name: "英國" },
  { code: "+61",  flag: "🇦🇺", name: "澳洲" },
  { code: "+81",  flag: "🇯🇵", name: "日本" },
  { code: "+82",  flag: "🇰🇷", name: "韓國" },
];

// ─── 銀牌會員福利（早鳥說明用）────────────────────────────────────────────────
const SILVER_PERKS_LIST = [
  { icon: Bell,         color: "#6366f1", title: "瀏覽器即時推播",   badge: "銀牌獨有", desc: "有人出價即彈出通知，毋須開電郵，秒速掌握競標動態。" },
  { icon: Bot,          color: "#10b981", title: "代理出價自動跟標", badge: "省時省力", desc: "設定最高出價上限，系統自動替你跟標，無需時刻守候。" },
  { icon: Shield,       color: "#f97316", title: "防截標延時保護",   badge: "反狙擊",   desc: "拍賣尾聲出價自動延時，杜絕最後一秒狙擊，公平決勝。" },
  { icon: Mail,         color: "#ec4899", title: "被超標即時通知",   badge: "電郵通知", desc: "對手超出你的出價時，即時電郵通知，讓你決定是否繼續。" },
  { icon: Clock,        color: "#f59e0b", title: "結束前提醒",       badge: "不錯失",   desc: "拍賣即將結束前自動提醒，確保你不會因忙碌而錯過出價。" },
  { icon: CheckCircle2, color: "#14b8a6", title: "得標確認通知",     badge: "確認通知", desc: "成功得標後即時通知，包含商品資訊及付款交收指引。" },
  { icon: BadgeCheck,   color: "#64748b", title: "銀牌橫幅與徽章",   badge: "身份象徵", desc: "個人頁銀牌漸層橫幅，名字旁顯示尊榮徽章。" },
  { icon: Lock,         color: "#3b82f6", title: "交易記錄永久保存", badge: "安全可查", desc: "所有出價及得標記錄永久儲存，隨時查閱。" },
];

// ─── Phone format validation ────────────────────────────────────────────────
// Returns null if valid, or a Chinese error message if invalid.
function validatePhoneFormat(countryCode: string, local: string): string | null {
  const d = local.replace(/\D/g, "");
  switch (countryCode) {
    case "+852": // HK: 8 digits, start with 2/5/6/9
      if (!/^[25689]\d{7}$/.test(d))
        return `香港號碼須為 8 位數字，首位為 2、5、6 或 9（例如：6123 4567）`;
      break;
    case "+86":  // China: 11 digits, start with 1
      if (!/^1\d{10}$/.test(d))
        return `中國大陸號碼須為 11 位數字，首位為 1（例如：138 0000 0000）`;
      break;
    case "+853": // Macau: 8 digits, start with 6
      if (!/^6\d{7}$/.test(d))
        return `澳門號碼須為 8 位數字，首位為 6（例如：6123 4567）`;
      break;
    case "+886": // Taiwan: 9 digits, start with 9
      if (!/^9\d{8}$/.test(d))
        return `台灣號碼須為 9 位數字，首位為 9（例如：912 345 678）`;
      break;
    case "+65":  // Singapore: 8 digits, start with 8 or 9
      if (!/^[89]\d{7}$/.test(d))
        return `新加坡號碼須為 8 位數字，首位為 8 或 9（例如：9123 4567）`;
      break;
    case "+60":  // Malaysia: 9-10 digits, start with 1
      if (!/^1\d{8,9}$/.test(d))
        return `馬來西亞號碼須為 9–10 位數字，首位為 1（例如：12-345 6789）`;
      break;
    case "+1":   // US/Canada: exactly 10 digits
      if (!/^\d{10}$/.test(d))
        return `美國/加拿大號碼須為 10 位數字（例如：212 555 1234）`;
      break;
    case "+44":  // UK: 10 digits
      if (!/^\d{10}$/.test(d))
        return `英國號碼須為 10 位數字（例如：7911 123456）`;
      break;
    case "+61":  // Australia: 9 digits, start with 4
      if (!/^4\d{8}$/.test(d))
        return `澳洲號碼須為 9 位數字，首位為 4（例如：412 345 678）`;
      break;
    case "+81":  // Japan: 10-11 digits, start with 07/08/09
      if (!/^0[789]\d{8,9}$/.test(d))
        return `日本號碼須為 10–11 位數字，首兩位為 07/08/09（例如：090 1234 5678）`;
      break;
    case "+82":  // Korea: 10-11 digits, start with 01
      if (!/^01\d{8,9}$/.test(d))
        return `韓國號碼須為 10–11 位數字，首兩位為 01（例如：010 1234 5678）`;
      break;
    default:
      if (d.length < 6) return "電話號碼位數不足，請重新確認";
  }
  return null;
}

export default function Login() {
  const initialMode = (() => {
    if (typeof window === "undefined") return "login" as const;
    const p = new URLSearchParams(window.location.search).get("mode");
    return p === "register" || p === "forgot" ? (p as "register" | "forgot") : ("login" as const);
  })();
  // ─── 暫時停用：電郵註冊及電郵忘記密碼功能 ─────────────────────────────────────
  // 若需重新啟用，將 EMAIL_FEATURE_ENABLED 改為 true，並同步更新 authRoutes.ts 的守衛
  const EMAIL_FEATURE_ENABLED = false;

  const initialRegisterMethod = (() => {
    if (!EMAIL_FEATURE_ENABLED) return "phone" as const; // 電郵功能暫時停用，鎖定手機
    if (typeof window === "undefined") return "email" as const;
    const m = new URLSearchParams(window.location.search).get("method");
    return m === "phone" ? ("phone" as const) : ("email" as const);
  })();
  const phoneOnly = (() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("method") === "phone";
  })();
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode);
  const [registerMethod, setRegisterMethod] = useState<"email" | "phone">(initialRegisterMethod);
  const [step, setStep] = useState<"form" | "otp">("form");

  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+852");
  const [localPhone, setLocalPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSilverPerks, setShowSilverPerks] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);

  // ─── WhatsApp 備用 OTP ────────────────────────────────────────────────────────
  const [waSending, setWaSending] = useState(false);
  const [waSent, setWaSent] = useState(false);

  // ─── 電郵 OTP 備用（短訊 40 秒後未收到）─────────────────────────────────────
  const [showEmailFb, setShowEmailFb] = useState(false);
  const [emailFbAddr, setEmailFbAddr] = useState("");
  const [emailFbSending, setEmailFbSending] = useState(false);
  const [emailFbSent, setEmailFbSent] = useState(false);
  const [useEmailFallback, setUseEmailFallback] = useState(false);

  // ─── 強制更改密碼 Dialog（管理員修改後首次登入觸發）────────────────────────────
  const [forceResetOpen, setForceResetOpen] = useState(false);
  const [forceResetPw, setForceResetPw] = useState("");
  const [forceResetPw2, setForceResetPw2] = useState("");
  const [forceResetLoading, setForceResetLoading] = useState(false);

  // ─── Forgot password state ────────────────────────────────────────────────
  const [fpStep, setFpStep] = useState<"identify" | "otp" | "newpw">("identify");
  const [fpMethod, setFpMethod] = useState<"phone" | "email">("phone");
  const [fpEmail, setFpEmail] = useState("");
  const [fpCountryCode, setFpCountryCode] = useState("+852");
  const [fpLocalPhone, setFpLocalPhone] = useState("");
  const [fpPhone, setFpPhone] = useState("");
  const [fpShowCountryDropdown, setFpShowCountryDropdown] = useState(false);
  const fpCountryDropdownRef = useRef<HTMLDivElement>(null);
  const [fpPassword, setFpPassword] = useState("");
  const [fpConfirmPassword, setFpConfirmPassword] = useState("");
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpShowConfirmPassword, setFpShowConfirmPassword] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  const { showToast } = useToast();

  const showError = (msg: string) => showToast({ icon: "⚠️", title: msg, durationMs: 4000 });

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 短訊發出 40 秒後（倒數剩 20 秒）顯示電郵備用選項
  useEffect(() => {
    if (step === "otp" && !showEmailFb && countdown > 0 && countdown <= 20) {
      setShowEmailFb(true);
    }
  }, [countdown, step, showEmailFb]);

  // Sync combined phone number
  useEffect(() => {
    setPhone(countryCode + localPhone);
  }, [countryCode, localPhone]);

  // Close country dropdown on outside click
  useEffect(() => {
    if (!showCountryDropdown) return;
    function handleOutside(e: MouseEvent) {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showCountryDropdown]);

  const otpCode = otpDigits.join("");

  const handleOtpInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setOtpDigits(text.split(""));
      otpRefs.current[5]?.focus();
    }
  };

  const sendOtp = async () => {
    if (!localPhone) { showError("請輸入手機號碼"); return; }
    const fmtErr = validatePhoneFormat(countryCode, localPhone);
    if (fmtErr) { showError(fmtErr); return; }
    // 註冊時：先驗表單再發 OTP，避免 OTP 發出後才發現密碼不符
    if (mode === "register") {
      if (!name.trim()) { showError("請輸入暱稱"); return; }
      if (!password) { showError("請輸入密碼"); return; }
      if (password.length < 6) { showError("密碼須至少 6 個字元"); return; }
      if (password !== confirmPassword) { showError("兩次輸入的密碼不一致，請重新確認"); return; }
    }
    setOtpSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ icon: "⚠️", title: data.error || "發送失敗", desc: data.detail, durationMs: 5000 });
        return;
      }
      setStep("otp");
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setOtpSending(false);
    }
  };

  const resendOtp = async () => {
    if (countdown > 0) return;
    setOtpSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ icon: "⚠️", title: data.error || "發送失敗", desc: data.detail, durationMs: 5000 });
        return;
      }
      setWaSent(false);
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setOtpSending(false);
    }
  };

  // WhatsApp 備用 OTP 發送（短訊收不到時）
  const isChinesePhone = phone.startsWith("+86");
  const isFpChinesePhone = fpPhone.startsWith("+86");
  const sendWhatsAppOtp = async (targetPhone?: string) => {
    const p = targetPhone ?? phone;
    setWaSending(true);
    try {
      const res = await fetch("/api/auth/send-otp-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ icon: "⚠️", title: data.error || "WhatsApp 發送失敗", durationMs: 5000 });
        return;
      }
      setWaSent(true);
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      showToast({ icon: "💬", title: "WhatsApp 驗證碼已發送", desc: "請查看 WhatsApp 訊息", durationMs: 4000 });
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setWaSending(false);
    }
  };

  // ─── 發送電郵備用 OTP ─────────────────────────────────────────────────────────
  const sendEmailFallbackOtp = async () => {
    if (!emailFbAddr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFbAddr)) {
      showError("請輸入有效的電郵地址");
      return;
    }
    setEmailFbSending(true);
    try {
      const res = await fetch("/api/auth/send-otp-email-fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, email: emailFbAddr }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || "電郵發送失敗，請稍後再試");
        return;
      }
      setEmailFbSent(true);
      setUseEmailFallback(true);
      setOtpDigits(["", "", "", "", "", ""]);
      showToast({ icon: "📧", title: "電郵驗證碼已發送", desc: `請查看 ${emailFbAddr}`, durationMs: 4000 });
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setEmailFbSending(false);
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) { showError("兩次輸入的密碼不一致"); return; }
    if (registerMethod === "phone" && otpCode.length < 6) { showError("請輸入完整的6位驗證碼"); return; }

    setLoading(true);
    try {
      const body: Record<string, string | boolean> = {
        password,
        name: name || (registerMethod === "email" ? email.split("@")[0] : phone),
      };
      if (registerMethod === "email") {
        body.email = email;
      } else {
        body.phone = phone;
        body.otpCode = otpCode;
        if (useEmailFallback && emailFbAddr) {
          body.emailFallback = true;
          body.fallbackEmail = emailFbAddr;
        }
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.otpExpired) { setStep("form"); setOtpDigits(["", "", "", "", "", ""]); }
        showError(data.error || "註冊失敗");
        return;
      }
      if (registerMethod === "phone") {
        localStorage.setItem("showWelcomeToast", "phone");
      }
      window.location.href = "/";
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "登入失敗"); return; }
      // 管理員已修改此帳號密碼，須強制更改才能繼續
      if (data.mustChangePassword) {
        setForceResetPw("");
        setForceResetPw2("");
        setForceResetOpen(true);
        return;
      }
      // Set flag so BottomNav can show login success toast after redirect
      localStorage.setItem("showLoginToast", identifier.includes("@") ? "email" : "phone");
      window.location.href = "/";
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      await handleLogin();
    } else if (registerMethod === "phone" && step === "form") {
      await sendOtp();
    } else {
      await handleRegister();
    }
  };

  const switchMode = (newMode: "login" | "register" | "forgot") => {
    setMode(newMode);
    setStep("form");
    setPassword(""); setConfirmPassword(""); setIdentifier("");
    setEmail(""); setPhone(""); setName("");
    setOtpDigits(["", "", "", "", "", ""]);
    if (newMode === "forgot") {
      setFpStep("identify"); setFpMethod("phone"); setFpEmail("");
      setFpLocalPhone(""); setFpPhone("");
      setFpPassword(""); setFpConfirmPassword(""); setCountdown(0);
    }
  };

  // ─── Forgot password handlers ─────────────────────────────────────────────
  const sendForgotOtp = async () => {
    if (!fpLocalPhone) { showError("請輸入手機號碼"); return; }
    const fmtErr = validatePhoneFormat(fpCountryCode, fpLocalPhone);
    if (fmtErr) { showError(fmtErr); return; }
    const fullPhone = fpCountryCode + fpLocalPhone.replace(/\D/g, "");
    setFpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ icon: "⚠️", title: data.error || "發送失敗", desc: data.detail, durationMs: 5000 });
        return;
      }
      setFpPhone(fullPhone);
      setFpStep("otp");
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setFpLoading(false);
    }
  };

  const resendForgotOtp = async () => {
    if (countdown > 0) return;
    setFpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fpPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ icon: "⚠️", title: data.error || "發送失敗", desc: data.detail, durationMs: 5000 });
        return;
      }
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setFpLoading(false);
    }
  };

  const resetPassword = async () => {
    const otpCode = otpDigits.join("");
    if (otpCode.length < 6) { showError("請輸入完整的 6 位驗證碼"); return; }
    if (!fpPassword) { showError("請輸入新密碼"); return; }
    if (fpPassword.length < 6) { showError("密碼須至少 6 個字元"); return; }
    if (fpPassword !== fpConfirmPassword) { showError("兩次輸入的密碼不一致，請重新確認"); return; }
    setFpLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fpPhone, otpCode, newPassword: fpPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.otpExpired) {
          setFpStep("otp");
          setOtpDigits(["", "", "", "", "", ""]);
        }
        showToast({ icon: "⚠️", title: data.error || "重設失敗", durationMs: 5000 });
        return;
      }
      showToast({ icon: "✅", title: "密碼重設成功！", desc: "請使用新密碼登入", durationMs: 4000 });
      switchMode("login");
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setFpLoading(false);
    }
  };

  const inputStyle = { background: "#fff", borderColor: "#E5E5E5", color: "#333" };
  const isPhoneRegister = mode === "register" && registerMethod === "phone";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FEF6EC" }}>
      <Header />

      {/* Welcome banner */}
      <div className="text-center pt-[47px] pb-4">
        <p className="gold-gradient-text font-bold text-xl leading-snug">hongxcollections</p>
        <p className="text-sm font-medium mt-1" style={{ color: "#E07B00" }}>
          {mode === "login" ? "歡迎回來" : mode === "forgot" ? "帳號安全" : "歡迎加入"}
        </p>
        <p className="text-base font-bold mt-1" style={{ color: "#222" }}>
          {mode === "login" ? "登入帳號"
            : mode === "forgot" ? (fpStep === "identify" ? "忘記密碼" : fpStep === "otp" ? "電話驗證" : "設定新密碼")
            : isPhoneRegister && step === "otp" ? "電話驗證" : "註冊帳號"}
        </p>
      </div>

      <div className="px-6 pt-2 pb-24 max-w-sm mx-auto">

        {/* === FORGOT PASSWORD FLOW === */}
        {mode === "forgot" ? (
          <div className="space-y-5">

            {/* STEP 1: identify — phone or email */}
            {fpStep === "identify" && (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: "#FFF3E0" }}>
                    <Lock size={26} style={{ color: "#E07B00" }} />
                  </div>
                  <p className="text-sm" style={{ color: "#555" }}>請選擇重設方式</p>
                </div>

                {/* Phone / Email toggle — 電郵選項暫時停用，EMAIL_FEATURE_ENABLED=false 時不顯示 */}
                {EMAIL_FEATURE_ENABLED && (
                  <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#E5E5E5" }}>
                    {(["phone", "email"] as const).map(m => (
                      <button key={m} type="button"
                        onClick={() => setFpMethod(m)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors"
                        style={{ background: fpMethod === m ? "#E07B00" : "#fff", color: fpMethod === m ? "#fff" : "#555" }}>
                        {m === "phone" ? <><Phone size={15} />手機驗證</> : <><Mail size={15} />電郵</>}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── PHONE METHOD ── */}
                {fpMethod === "phone" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>手機號碼</label>
                      <div className="flex gap-2 items-stretch">
                        <div className="relative flex-shrink-0" ref={fpCountryDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setFpShowCountryDropdown(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium whitespace-nowrap h-full"
                            style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333", minWidth: "100px" }}
                          >
                            <span className="text-base leading-none">{COUNTRIES.find(c => c.code === fpCountryCode)?.flag}</span>
                            <span>{fpCountryCode}</span>
                            <ChevronDown size={13} className="ml-0.5 transition-transform duration-150"
                              style={{ color: "#aaa", transform: fpShowCountryDropdown ? "rotate(180deg)" : "rotate(0deg)" }} />
                          </button>
                          {fpShowCountryDropdown && (
                            <div className="absolute left-0 top-full mt-1.5 rounded-2xl border shadow-xl overflow-hidden z-[9999]"
                              style={{ background: "#fff", borderColor: "#E5E5E5", minWidth: "210px", maxHeight: "260px", overflowY: "auto" }}>
                              {COUNTRIES.map(c => {
                                const sel = c.code === fpCountryCode;
                                return (
                                  <button key={c.code} type="button"
                                    onClick={() => { setFpCountryCode(c.code); setFpShowCountryDropdown(false); }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left"
                                    style={{ background: sel ? "#FFF3E0" : "transparent", color: sel ? "#E07B00" : "#333" }}>
                                    <span className="text-lg leading-none">{c.flag}</span>
                                    <span className="font-semibold w-10 flex-shrink-0">{c.code}</span>
                                    <span style={{ color: sel ? "#E07B00" : "#666" }}>{c.name}</span>
                                    {sel && <span className="ml-auto" style={{ color: "#E07B00" }}>✓</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <input type="tel" value={fpLocalPhone}
                          onChange={e => setFpLocalPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder={fpCountryCode === "+852" ? "XXXX XXXX" : fpCountryCode === "+86" ? "1XX XXXX XXXX" : "電話號碼"}
                          className="flex-1 px-3 py-3 rounded-xl border text-sm outline-none"
                          style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                        />
                      </div>
                    </div>
                    <button onClick={sendForgotOtp} disabled={fpLoading}
                      className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity"
                      style={{ background: "#E07B00", opacity: fpLoading ? 0.6 : 1 }}>
                      {fpLoading ? "發送中..." : "發送驗證碼"}
                    </button>
                  </>
                )}

                {/* ── EMAIL METHOD ── */}
                {fpMethod === "email" && (() => {
                  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fpEmail.trim());
                  const hasInput = fpEmail.trim().length > 0;
                  const borderColor = hasInput ? (emailOk ? "#22c55e" : "#ef4444") : "#E5E5E5";
                  const hintColor  = hasInput ? (emailOk ? "#16a34a" : "#ef4444") : "transparent";
                  const hintText   = hasInput ? (emailOk ? "✓ 格式正確" : "✗ 電郵格式不正確，例如：example@email.com") : "";
                  return (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>電郵地址</label>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                        <input type="email" value={fpEmail}
                          onChange={e => setFpEmail(e.target.value)}
                          placeholder="輸入您的登記電郵"
                          className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                          style={{ background: "#fff", borderColor, color: "#333" }}
                        />
                      </div>
                      {hasInput && (
                        <p className="text-xs mt-1 pl-1" style={{ color: hintColor }}>{hintText}</p>
                      )}
                    </div>

                    {/* Email reset notice */}
                    <div className="rounded-2xl px-4 py-4 text-sm space-y-2" style={{ background: "#FFF8EE", border: "1px solid #F5DEB3" }}>
                      <p className="font-semibold" style={{ color: "#B45309" }}>📧 電郵重設方式</p>
                      <p style={{ color: "#666" }}>請將您的帳號電郵發送至客服：</p>
                      <span className="inline-block font-semibold text-sm" style={{ color: "#E07B00" }}>
                        support@hongxcollections.com
                      </span>
                      <p className="text-xs" style={{ color: "#999" }}>客服將於 1 個工作天內協助您重設密碼。</p>
                    </div>

                    <button
                      type="button"
                      disabled={fpLoading}
                      onClick={async () => {
                        if (!fpEmail.trim()) { showError("請輸入電郵地址"); return; }
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fpEmail.trim())) {
                          showError("電郵格式不正確，請重新確認"); return;
                        }
                        setFpLoading(true);
                        try {
                          const res = await fetch("/api/auth/email-reset-request", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: fpEmail.trim() }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            showToast({ icon: "⚠️", title: data.error || "提交失敗", durationMs: 5000 });
                            return;
                          }
                          showToast({ icon: "✅", title: "申請已提交！", desc: "管理員將盡快聯絡您重設密碼", durationMs: 6000 });
                          switchMode("login");
                        } catch {
                          showError("網絡錯誤，請稍後再試");
                        } finally {
                          setFpLoading(false);
                        }
                      }}
                      className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity"
                      style={{ background: "#E07B00", opacity: (emailOk && !fpLoading) ? 1 : 0.55 }}>
                      {fpLoading ? "提交中..." : "提交重設申請"}
                    </button>
                  </>
                  );
                })()}
              </>
            )}

            {/* STEP 2: otp — verify code */}
            {fpStep === "otp" && (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: "#FFF3E0" }}>
                    <ShieldCheck size={28} style={{ color: "#E07B00" }} />
                  </div>
                  <p className="text-sm" style={{ color: "#555" }}>驗證碼已發送至</p>
                  <p className="font-semibold mt-0.5" style={{ color: "#333" }}>{fpPhone}</p>
                  <p className="text-xs mt-1" style={{ color: "#999" }}>請於 10 分鐘內輸入 6 位驗證碼</p>
                </div>

                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otpDigits.map((d, i) => (
                    <input key={i} ref={el => { otpRefs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1} value={d}
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-11 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all"
                      style={{ height: "52px", borderColor: d ? "#E07B00" : "#E5E5E5", background: "#fff", color: "#333" }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => { setFpStep("newpw"); setFpPassword(""); setFpConfirmPassword(""); }}
                  disabled={otpDigits.join("").length < 6 || fpLoading}
                  className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity"
                  style={{ background: "#E07B00", opacity: otpDigits.join("").length < 6 ? 0.5 : 1 }}>
                  確認驗證碼
                </button>

                <div className="text-center space-y-2">
                  <button type="button" onClick={resendForgotOtp} disabled={countdown > 0 || fpLoading}
                    className="text-sm bg-transparent border-0 cursor-pointer"
                    style={{ color: countdown > 0 ? "#aaa" : "#E07B00" }}>
                    {countdown > 0 ? `重新發送（${countdown}秒）` : fpLoading ? "發送中..." : "重新發送驗證碼"}
                  </button>

                  {/* WhatsApp 備用 — 忘記密碼流程 */}
                  {!isFpChinesePhone && (
                    <div className="pt-1">
                      {waSent ? (
                        <div className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl"
                             style={{ background: "#F0FDF4", color: "#15803d" }}>
                          <span>💬</span>
                          <span>已透過 WhatsApp 發送，請查看訊息</span>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs mb-1.5" style={{ color: "#aaa" }}>收不到短訊？</p>
                          <button
                            type="button"
                            onClick={() => sendWhatsAppOtp(fpPhone)}
                            disabled={waSending || countdown > 0}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
                            style={{
                              borderColor: "#25D366",
                              color: (waSending || countdown > 0) ? "#aaa" : "#128C7E",
                              background: (waSending || countdown > 0) ? "#f5f5f5" : "#F0FDF4",
                            }}
                          >
                            <span>💬</span>
                            {waSending ? "發送中..." : countdown > 0 ? `WhatsApp（${countdown}秒後可用）` : "改用 WhatsApp 發送驗證碼"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <button type="button" onClick={() => { setFpStep("identify"); setOtpDigits(["", "", "", "", "", ""]); setWaSent(false); }}
                      className="text-xs bg-transparent border-0 cursor-pointer" style={{ color: "#aaa" }}>
                      ← 修改手機號碼
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* STEP 3: newpw — set new password */}
            {fpStep === "newpw" && (
              <>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: "#FFF3E0" }}>
                    <Lock size={26} style={{ color: "#E07B00" }} />
                  </div>
                  <p className="text-sm" style={{ color: "#555" }}>設定您的新密碼</p>
                  <p className="text-xs mt-1" style={{ color: "#999" }}>密碼須至少 6 個字元</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>新密碼</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type={fpShowPassword ? "text" : "password"} value={fpPassword}
                      onChange={e => setFpPassword(e.target.value)}
                      placeholder="最少 6 個字元"
                      className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none"
                      style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }} />
                    <button type="button" onClick={() => setFpShowPassword(!fpShowPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }}>
                      {fpShowPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>確認新密碼</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type={fpShowConfirmPassword ? "text" : "password"} value={fpConfirmPassword}
                      onChange={e => setFpConfirmPassword(e.target.value)}
                      placeholder="再次輸入新密碼"
                      className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none"
                      style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }} />
                    <button type="button" onClick={() => setFpShowConfirmPassword(!fpShowConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }}>
                      {fpShowConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button onClick={resetPassword} disabled={fpLoading}
                  className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity"
                  style={{ background: "#E07B00", opacity: fpLoading ? 0.6 : 1 }}>
                  {fpLoading ? "重設中..." : "確認重設密碼"}
                </button>
              </>
            )}

            <div className="text-center mt-2">
              <button onClick={() => switchMode("login")}
                className="text-sm bg-transparent border-0 cursor-pointer" style={{ color: "#aaa" }}>
                ← 返回登入
              </button>
            </div>
          </div>

        ) : isPhoneRegister && step === "otp" ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: "#FFF3E0" }}>
                <ShieldCheck size={28} style={{ color: "#E07B00" }} />
              </div>
              {emailFbSent ? (
                <>
                  <p className="text-sm" style={{ color: "#555" }}>電郵驗證碼已發送至</p>
                  <p className="font-semibold mt-0.5" style={{ color: "#333" }}>{emailFbAddr}</p>
                  <p className="text-xs mt-1" style={{ color: "#0284c7" }}>請查看電郵並輸入 6 位驗證碼</p>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "#555" }}>驗證碼已發送至</p>
                  <p className="font-semibold mt-0.5" style={{ color: "#333" }}>{phone}</p>
                  <p className="text-xs mt-1" style={{ color: "#999" }}>請於 10 分鐘內輸入 6 位驗證碼</p>
                </>
              )}
            </div>

            {/* 6-digit OTP input boxes */}
            <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleOtpInput(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-11 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all"
                  style={{ height: "52px", borderColor: d ? "#E07B00" : "#E5E5E5", background: "#fff", color: "#333" }}
                />
              ))}
            </div>

            <button
              onClick={handleRegister}
              disabled={loading || otpCode.length < 6}
              className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity"
              style={{ background: "#E07B00", opacity: (loading || otpCode.length < 6) ? 0.6 : 1 }}
            >
              {loading ? "驗證中..." : "確認驗證並完成註冊"}
            </button>

            <div className="text-center space-y-2">
              <div>
                <button
                  type="button"
                  onClick={resendOtp}
                  disabled={countdown > 0 || otpSending}
                  className="text-sm bg-transparent border-0 cursor-pointer"
                  style={{ color: countdown > 0 ? "#aaa" : "#E07B00" }}
                >
                  {countdown > 0 ? `重新發送（${countdown}秒）` : otpSending ? "發送中..." : "重新發送驗證碼"}
                </button>
              </div>

              {/* ── WhatsApp 備用發送 ── */}
              {!isChinesePhone && !emailFbSent && (
                <div className="pt-1">
                  {waSent ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl mx-auto inline-flex"
                         style={{ background: "#F0FDF4", color: "#15803d" }}>
                      <span>💬</span>
                      <span>已透過 WhatsApp 發送，請查看訊息</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs mb-1.5" style={{ color: "#aaa" }}>收不到短訊？</p>
                      <button
                        type="button"
                        onClick={sendWhatsAppOtp}
                        disabled={waSending || countdown > 0}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
                        style={{
                          borderColor: "#25D366",
                          color: (waSending || countdown > 0) ? "#aaa" : "#128C7E",
                          background: (waSending || countdown > 0) ? "#f5f5f5" : "#F0FDF4",
                        }}
                      >
                        <span>💬</span>
                        {waSending ? "發送中..." : countdown > 0 ? `WhatsApp（${countdown}秒後可用）` : "改用 WhatsApp 發送驗證碼"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── 電郵 OTP 備用（短訊 40 秒後未收到時才顯示）── */}
              {showEmailFb && (
                <div className="pt-2">
                  {emailFbSent ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl"
                         style={{ background: "#EFF6FF", color: "#1d4ed8" }}>
                      <span>📧</span>
                      <span>電郵驗證碼已發送至 {emailFbAddr}</span>
                    </div>
                  ) : (
                    <div className="rounded-xl p-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                      <p className="text-xs font-medium mb-2" style={{ color: "#64748b" }}>
                        📧 仍未收到短訊？改用電郵驗證
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailFbAddr}
                          onChange={e => setEmailFbAddr(e.target.value)}
                          placeholder="輸入您的電郵地址"
                          className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                          style={{ borderColor: "#CBD5E1", background: "#fff", color: "#333" }}
                          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendEmailFallbackOtp(); }}}
                        />
                        <button
                          type="button"
                          onClick={sendEmailFallbackOtp}
                          disabled={emailFbSending || !emailFbAddr}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
                          style={{
                            background: "#0284c7",
                            opacity: (emailFbSending || !emailFbAddr) ? 0.5 : 1,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {emailFbSending ? "發送中..." : "發送"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setOtpDigits(["", "", "", "", "", ""]);
                    setWaSent(false);
                    setShowEmailFb(false);
                    setEmailFbAddr("");
                    setEmailFbSent(false);
                    setUseEmailFallback(false);
                  }}
                  className="text-xs bg-transparent border-0 cursor-pointer"
                  style={{ color: "#aaa" }}
                >
                  ← 修改手機號碼
                </button>
              </div>
            </div>
          </div>

        ) : (
          /* === FORM STEP === */
          <form onSubmit={handleFormSubmit} className="space-y-4">

            {/* REGISTER FIELDS */}
            {mode === "register" && (
              <>
                {/* Nickname */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>暱稱</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="輸入您的暱稱"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                  </div>
                </div>

                {/* Register method toggle — 早鳥入口會鎖死電話，只顯示提示 + Dialog 按鈕 */}
                {phoneOnly ? (
                  <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2"
                       style={{ background: "#FFF7ED", borderColor: "#FED7AA" }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#9A3412" }}>
                      <Phone size={14} />
                      <span>🎁 早鳥名額僅限<span className="font-semibold">手機註冊</span>領取</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSilverPerks(true)}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shrink-0 transition-colors"
                      style={{
                        background: "#FFFBEB",
                        color: "#92400E",
                        border: "1px solid #FCD34D",
                      }}
                    >
                      <Lightbulb size={11} style={{ color: "#F59E0B" }} />
                      銀牌有咩特別？
                    </button>
                  </div>
                ) : EMAIL_FEATURE_ENABLED ? (
                  /* 電郵/手機切換 toggle — EMAIL_FEATURE_ENABLED=false 時隱藏，重新啟用時改回 true */
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>註冊方式</label>
                    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#E5E5E5" }}>
                      {(["email", "phone"] as const).map(m => (
                        <button key={m} type="button" onClick={() => setRegisterMethod(m)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors"
                          style={{ background: registerMethod === m ? "#E07B00" : "#fff", color: registerMethod === m ? "#fff" : "#555" }}>
                          {m === "email" ? <><Mail size={15} />電郵</> : <><Phone size={15} />手機</>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null /* 電郵功能暫時停用，不顯示 toggle，預設使用手機 */}

                {/* Email or Phone field */}
                {registerMethod === "email" ? (
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>電郵地址</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="example@email.com" required
                        className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>
                      手機號碼
                      <span className="ml-1.5 text-xs font-normal" style={{ color: "#999" }}>（需驗證）</span>
                    </label>
                    {/* Country code selector + phone number input */}
                    <div className="flex gap-2 items-stretch">
                      {/* Custom country code dropdown */}
                      <div className="relative flex-shrink-0" ref={countryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(v => !v)}
                          className="flex items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium whitespace-nowrap h-full"
                          style={{ ...inputStyle, minWidth: "100px" }}
                        >
                          <span className="text-base leading-none">
                            {COUNTRIES.find(c => c.code === countryCode)?.flag}
                          </span>
                          <span>{countryCode}</span>
                          <ChevronDown
                            size={13}
                            className="ml-0.5 transition-transform duration-150"
                            style={{ color: "#aaa", transform: showCountryDropdown ? "rotate(180deg)" : "rotate(0deg)" }}
                          />
                        </button>

                        {/* Dropdown list */}
                        {showCountryDropdown && (
                          <div
                            className="absolute left-0 top-full mt-1.5 rounded-2xl border shadow-xl overflow-hidden z-[9999]"
                            style={{ background: "#fff", borderColor: "#E5E5E5", minWidth: "210px", maxHeight: "300px", overflowY: "auto" }}
                          >
                            {COUNTRIES.map(c => {
                              const selected = c.code === countryCode;
                              return (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => { setCountryCode(c.code); setShowCountryDropdown(false); }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors"
                                  style={{
                                    background: selected ? "#FFF3E0" : "transparent",
                                    color: selected ? "#E07B00" : "#333",
                                  }}
                                >
                                  <span className="text-lg leading-none">{c.flag}</span>
                                  <span className="font-semibold w-10 flex-shrink-0">{c.code}</span>
                                  <span style={{ color: selected ? "#E07B00" : "#666" }}>{c.name}</span>
                                  {selected && (
                                    <span className="ml-auto text-base" style={{ color: "#E07B00" }}>✓</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Local phone number */}
                      <input
                        type="tel"
                        value={localPhone}
                        onChange={e => setLocalPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder={countryCode === "+852" ? "XXXX XXXX" : countryCode === "+86" ? "1XX XXXX XXXX" : "電話號碼"}
                        required
                        className="flex-1 px-3 py-3 rounded-xl border text-sm outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>密碼</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type={showPassword ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="最少 6 個字元" required minLength={6}
                      className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>確認密碼</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="再次輸入密碼" required
                      className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }}>
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* LOGIN FIELDS */}
            {mode === "login" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>電郵 / 手機號碼</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                      placeholder="輸入電郵或手機號碼" required
                      className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium" style={{ color: "#333" }}>密碼</label>
                    <button type="button" onClick={() => switchMode("forgot")}
                      className="text-xs bg-transparent border-0 cursor-pointer p-0"
                      style={{ color: "#E07B00" }}>
                      忘記密碼？
                    </button>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input type={showPassword ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="輸入密碼" required
                      className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading || otpSending}
              className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity mt-2"
              style={{ background: "#E07B00", opacity: (loading || otpSending) ? 0.7 : 1 }}
            >
              {loading || otpSending
                ? "處理中..."
                : mode === "login"
                  ? "登入"
                  : isPhoneRegister
                    ? "發送驗證碼"
                    : "完成註冊"}
            </button>
          </form>
        )}

        {/* Switch mode link */}
        {mode !== "forgot" && !(isPhoneRegister && step === "otp") && (
          <div className="text-center mt-5">
            <span className="text-sm" style={{ color: "#666" }}>
              {mode === "login" ? "還沒有帳號？" : "已有帳號？"}
            </span>{" "}
            <button
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="text-sm font-semibold bg-transparent border-0 cursor-pointer p-0"
              style={{ color: "#E07B00" }}
            >
              {mode === "login" ? "立即註冊" : "立即登入"}
            </button>
          </div>
        )}
      </div>

      {/* 銀牌福利 Dialog */}
      {showSilverPerks && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSilverPerks(false); }}
        >
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* 頂部漸層標題 */}
            <div className="sticky top-0 z-10 rounded-t-2xl px-5 py-4"
                 style={{ background: "linear-gradient(135deg, #F59E0B, #EC4899)" }}>
              <button
                onClick={() => setShowSilverPerks(false)}
                className="absolute right-3 top-3 rounded-full p-1.5 transition-colors"
                style={{ background: "rgba(255,255,255,0.2)" }}
                aria-label="關閉"
              >
                <X size={16} style={{ color: "white" }} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-2xl"
                     style={{ background: "rgba(255,255,255,0.25)" }}>🥈</div>
                <div>
                  <div className="text-base font-extrabold text-white leading-tight">銀牌會員有乜特別？</div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.85)" }}>
                    早鳥試用期間，以下功能即刻解鎖
                  </div>
                </div>
              </div>
            </div>

            {/* 福利列表 */}
            <div className="px-5 py-4 space-y-3">
              {SILVER_PERKS_LIST.map((perk, i) => {
                const Icon = perk.icon;
                return (
                  <div key={i} className="flex gap-3 rounded-xl border p-3"
                       style={{ borderColor: "#F3F4F6", background: "#F9FAFB" }}>
                    <div className="mt-0.5 shrink-0 w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center">
                      <Icon size={16} style={{ color: perk.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "#1C1917" }}>{perk.title}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{ background: `${perk.color}18`, color: perk.color }}>
                          {perk.badge}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed mt-0.5" style={{ color: "#6B7280" }}>{perk.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 底部 CTA */}
            <div className="sticky bottom-0 rounded-b-2xl bg-white border-t px-5 py-4"
                 style={{ borderColor: "#F3F4F6" }}>
              <button
                type="button"
                onClick={() => setShowSilverPerks(false)}
                className="block w-full text-center rounded-xl py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #F59E0B, #EC4899)" }}
              >
                🎁 明白了，立即完成註冊 →
              </button>
              <p className="text-center text-[10px] mt-2" style={{ color: "#9CA3AF" }}>
                完成手機號碼驗證後即自動解鎖以上全部功能
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 強制更改密碼 Dialog（管理員修改後首次登入，不可關閉）─────────────────── */}
      {forceResetOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full mx-auto mb-3"
                   style={{ background: "#FFF3E0" }}>
                <Lock size={26} style={{ color: "#E07B00" }} />
              </div>
              <h2 className="text-center text-lg font-bold" style={{ color: "#1a1a1a" }}>請設定您的新密碼</h2>
              <p className="text-center text-sm mt-1.5" style={{ color: "#666" }}>
                管理員已為您重設密碼。為確保帳號安全，請立即設定您的專屬密碼。
              </p>
            </div>
            {/* Warning */}
            <div className="mx-6 mb-4 rounded-xl px-4 py-3 text-xs" style={{ background: "#FFF7ED", border: "1px solid #FED7AA" }}>
              <p className="font-semibold text-orange-700">⚠️ 此步驟無法跳過</p>
              <p className="text-orange-600 mt-0.5">更改成功後方可繼續使用所有功能。</p>
            </div>
            {/* Form */}
            <div className="px-6 space-y-3 pb-2">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>新密碼（至少 6 個字符）</label>
                <input
                  type="password"
                  value={forceResetPw}
                  onChange={e => setForceResetPw(e.target.value)}
                  placeholder="輸入新密碼"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{ borderColor: "#E5E5E5" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>確認新密碼</label>
                <input
                  type="password"
                  value={forceResetPw2}
                  onChange={e => setForceResetPw2(e.target.value)}
                  placeholder="再次輸入新密碼"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
                  style={{
                    borderColor: forceResetPw2.length > 0 ? (forceResetPw === forceResetPw2 ? "#22c55e" : "#ef4444") : "#E5E5E5",
                  }}
                />
                {forceResetPw2.length > 0 && forceResetPw !== forceResetPw2 && (
                  <p className="text-xs mt-1 text-red-500">兩次密碼不一致</p>
                )}
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 pb-6 pt-4">
              <button
                type="button"
                disabled={forceResetLoading || forceResetPw.length < 6 || forceResetPw !== forceResetPw2}
                onClick={async () => {
                  if (forceResetPw.length < 6) { showError("密碼至少需要6個字符"); return; }
                  if (forceResetPw !== forceResetPw2) { showError("兩次密碼不一致"); return; }
                  setForceResetLoading(true);
                  try {
                    const res = await fetch("/api/auth/change-password-forced", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ newPassword: forceResetPw }),
                    });
                    const data = await res.json();
                    if (!res.ok) { showError(data.error || "更改失敗"); return; }
                    localStorage.setItem("showLoginToast", identifier.includes("@") ? "email" : "phone");
                    window.location.href = "/";
                  } catch {
                    showError("網絡錯誤，請稍後再試");
                  } finally {
                    setForceResetLoading(false);
                  }
                }}
                className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity"
                style={{
                  background: "#E07B00",
                  opacity: (forceResetLoading || forceResetPw.length < 6 || forceResetPw !== forceResetPw2) ? 0.55 : 1,
                }}
              >
                {forceResetLoading ? "更改中..." : "確認更改密碼"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

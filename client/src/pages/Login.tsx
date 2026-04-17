import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Mail, Phone, Lock, User, ShieldCheck, ChevronDown } from "lucide-react";
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerMethod, setRegisterMethod] = useState<"email" | "phone">("email");
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const showError = (msg: string) => showToast({ icon: "⚠️", title: msg, durationMs: 4000 });

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

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
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      showError("網絡錯誤，請稍後再試");
    } finally {
      setOtpSending(false);
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) { showError("兩次輸入的密碼不一致"); return; }
    if (registerMethod === "phone" && otpCode.length < 6) { showError("請輸入完整的6位驗證碼"); return; }

    setLoading(true);
    try {
      const body: Record<string, string> = {
        password,
        name: name || (registerMethod === "email" ? email.split("@")[0] : phone),
      };
      if (registerMethod === "email") {
        body.email = email;
      } else {
        body.phone = phone;
        body.otpCode = otpCode;
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

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setStep("form");
    setPassword(""); setConfirmPassword(""); setIdentifier("");
    setEmail(""); setPhone(""); setName("");
    setOtpDigits(["", "", "", "", "", ""]);
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
          {mode === "login" ? "歡迎回來" : "歡迎加入"}
        </p>
        <p className="text-base font-bold mt-1" style={{ color: "#222" }}>
          {mode === "login" ? "登入帳號" : isPhoneRegister && step === "otp" ? "電話驗證" : "註冊帳號"}
        </p>
      </div>

      <div className="px-6 pt-2 pb-24 max-w-sm mx-auto">

        {/* === OTP STEP (phone register only) === */}
        {isPhoneRegister && step === "otp" ? (
          <div className="space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-3" style={{ background: "#FFF3E0" }}>
                <ShieldCheck size={28} style={{ color: "#E07B00" }} />
              </div>
              <p className="text-sm" style={{ color: "#555" }}>驗證碼已發送至</p>
              <p className="font-semibold mt-0.5" style={{ color: "#333" }}>{phone}</p>
              <p className="text-xs mt-1" style={{ color: "#999" }}>請於 10 分鐘內輸入 6 位驗證碼</p>
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
              <div>
                <button
                  type="button"
                  onClick={() => { setStep("form"); setOtpDigits(["", "", "", "", "", ""]); }}
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

                {/* Register method toggle */}
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
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>密碼</label>
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
        {!(isPhoneRegister && step === "otp") && (
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
    </div>
  );
}

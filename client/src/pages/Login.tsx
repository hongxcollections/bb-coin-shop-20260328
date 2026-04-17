import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, Mail, Phone, Lock, User, ShieldCheck } from "lucide-react";
import Header from "@/components/Header";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerMethod, setRegisterMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"form" | "otp">("form");

  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
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

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

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
    setError("");
    if (!phone) { setError("請輸入手機號碼"); return; }
    setOtpSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "發送失敗"); return; }
      setStep("otp");
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setOtpSending(false);
    }
  };

  const resendOtp = async () => {
    if (countdown > 0) return;
    setError("");
    setOtpSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "發送失敗"); return; }
      setCountdown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setOtpSending(false);
    }
  };

  const handleRegister = async () => {
    setError("");
    if (password !== confirmPassword) { setError("兩次輸入的密碼不一致"); return; }
    if (registerMethod === "phone" && otpCode.length < 6) { setError("請輸入完整的6位驗證碼"); return; }

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
        setError(data.error || "註冊失敗");
        return;
      }
      if (registerMethod === "phone") {
        localStorage.setItem("showWelcomeToast", "phone");
      }
      window.location.href = "/";
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "登入失敗"); return; }
      window.location.href = "/";
    } catch {
      setError("網絡錯誤，請稍後再試");
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
    setError("");
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

            {error && <div className="text-red-500 text-xs text-center">{error}</div>}

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
                  onClick={() => { setStep("form"); setError(""); setOtpDigits(["", "", "", "", "", ""]); }}
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
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                        placeholder="+852 XXXX XXXX 或 +86 1XX XXXX XXXX" required
                        className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none" style={inputStyle} />
                    </div>
                    <p className="text-xs mt-1.5" style={{ color: "#aaa" }}>
                      🇭🇰 +852 香港 · 🇨🇳 +86 大陸
                    </p>
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

            {error && <div className="text-red-500 text-xs text-center py-1">{error}</div>}

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

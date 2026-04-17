import { useState } from "react";
import { Eye, EyeOff, Mail, Phone, Lock, User } from "lucide-react";
import Header from "@/components/Header";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerMethod, setRegisterMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const body: Record<string, string> = {
          password,
          name: name || (registerMethod === "email" ? email.split("@")[0] : phone),
        };
        if (registerMethod === "email") {
          body.email = email;
        } else {
          body.phone = phone;
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "註冊失敗");
          return;
        }
        window.location.href = "/";
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "登入失敗");
          return;
        }
        window.location.href = "/";
      }
    } catch {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setMode(newMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setIdentifier("");
    setEmail("");
    setPhone("");
    setName("");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FEF6EC" }}>
      <Header />

      {/* Welcome banner — three centred lines */}
      <div className="text-center pt-[94px] pb-4">
        <p className="gold-gradient-text font-bold text-xl leading-snug">hongxcollections</p>
        <p className="text-sm font-medium mt-1" style={{ color: "#E07B00" }}>
          {mode === "login" ? "歡迎回來" : "歡迎加入"}
        </p>
        <p className="text-base font-bold mt-1" style={{ color: "#222" }}>
          {mode === "login" ? "登入帳號" : "註冊帳號"}
        </p>
      </div>

      <div className="px-6 pt-2 pb-10 max-w-sm mx-auto">

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* === REGISTER FIELDS === */}
          {mode === "register" && (
            <>
              {/* Nickname */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>暱稱</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="輸入您的暱稱"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                  />
                </div>
              </div>

              {/* Register method toggle */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>註冊方式</label>
                <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "#E5E5E5" }}>
                  <button
                    type="button"
                    onClick={() => setRegisterMethod("email")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      background: registerMethod === "email" ? "#E07B00" : "#fff",
                      color: registerMethod === "email" ? "#fff" : "#555",
                    }}
                  >
                    <Mail size={15} />
                    電郵
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterMethod("phone")}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors"
                    style={{
                      background: registerMethod === "phone" ? "#E07B00" : "#fff",
                      color: registerMethod === "phone" ? "#fff" : "#555",
                    }}
                  >
                    <Phone size={15} />
                    手機
                  </button>
                </div>
              </div>

              {/* Email or Phone field */}
              {registerMethod === "email" ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>電郵地址</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      required
                      className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>手機號碼</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+852 XXXX XXXX"
                      required
                      className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none"
                      style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>密碼</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="最少 6 個字元"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none"
                    style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#aaa" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>確認密碼</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次輸入密碼"
                    required
                    className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none"
                    style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#aaa" }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* === LOGIN FIELDS === */}
          {mode === "login" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>電郵 / 手機號碼</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="輸入電郵或手機號碼"
                    required
                    className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm outline-none"
                    style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#333" }}>密碼</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#aaa" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="輸入密碼"
                    required
                    className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm outline-none"
                    style={{ background: "#fff", borderColor: "#E5E5E5", color: "#333" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#aaa" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="text-red-500 text-xs text-center py-1">{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-opacity mt-2"
            style={{ background: "#E07B00", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "處理中..." : mode === "login" ? "登入" : "註冊"}
          </button>
        </form>

        {/* Switch mode */}
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
      </div>
    </div>
  );
}

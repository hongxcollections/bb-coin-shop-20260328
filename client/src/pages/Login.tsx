import { useState } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import Header from "@/components/Header";

export default function Login() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        // Determine if identifier is email or phone
        const isEmail = identifier.includes("@");
        const body: Record<string, string> = {
          password,
          name: name || (isEmail ? identifier.split("@")[0] : identifier),
        };
        if (isEmail) {
          body.email = identifier;
        } else {
          body.phone = identifier;
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

        // Success - redirect to home
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

        // Success - redirect to home
        window.location.href = "/";
      }
    } catch (err) {
      setError("網絡錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #1a1207 0%, #2d1f0e 50%, #1a1207 100%)" }}>
      <Header />
      <div className="flex items-center justify-center px-4" style={{ minHeight: "calc(100vh - 64px)" }}>
        <div className="w-full max-w-sm">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold gold-gradient-text mb-1">
              {mode === "login" ? "會員登入" : "會員註冊"}
            </h1>
            <p style={{ fontSize: "12px", color: "rgba(180, 130, 50, 0.6)" }}>
              {mode === "login" ? "登入您的帳號" : "建立新帳號"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "register" && (
              <div>
                <label className="block text-xs mb-1" style={{ color: "rgba(180, 130, 50, 0.7)" }}>
                  暱稱（選填）
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入您的暱稱"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm"
                  style={{
                    background: "rgba(45, 31, 14, 0.8)",
                    borderColor: "rgba(180, 130, 50, 0.3)",
                    color: "#e8d5b0",
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(180, 130, 50, 0.7)" }}>
                電郵或手機號碼
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="輸入電郵或手機號碼"
                required
                className="w-full px-3 py-2.5 rounded-lg border text-sm"
                style={{
                  background: "rgba(45, 31, 14, 0.8)",
                  borderColor: "rgba(180, 130, 50, 0.3)",
                  color: "#e8d5b0",
                }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(180, 130, 50, 0.7)" }}>
                密碼
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "設定密碼（至少6位）" : "輸入密碼"}
                required
                minLength={mode === "register" ? 6 : undefined}
                className="w-full px-3 py-2.5 rounded-lg border text-sm"
                style={{
                  background: "rgba(45, 31, 14, 0.8)",
                  borderColor: "rgba(180, 130, 50, 0.3)",
                  color: "#e8d5b0",
                }}
              />
            </div>

            {error && (
              <div className="text-red-400 text-xs text-center py-1">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-opacity"
              style={{
                background: "linear-gradient(135deg, #b8860b, #daa520, #b8860b)",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "處理中..." : mode === "login" ? "登入" : "註冊"}
            </button>
          </form>

          {/* Toggle login/register */}
          <div className="text-center mt-3">
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-xs underline bg-transparent border-0 cursor-pointer"
              style={{ color: "rgba(180, 130, 50, 0.7)" }}
            >
              {mode === "login" ? "還沒有帳號？立即註冊" : "已有帳號？立即登入"}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 h-px" style={{ background: "rgba(180, 130, 50, 0.2)" }} />
            <span className="px-3 text-xs" style={{ color: "rgba(180, 130, 50, 0.4)" }}>或</span>
            <div className="flex-1 h-px" style={{ background: "rgba(180, 130, 50, 0.2)" }} />
          </div>

          {/* Google Login */}
          <a
            href={getLoginUrl()}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border text-sm no-underline transition-opacity hover:opacity-80"
            style={{
              borderColor: "rgba(180, 130, 50, 0.3)",
              background: "rgba(45, 31, 14, 0.5)",
              color: "#e8d5b0",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 帳號登入
          </a>
        </div>
      </div>
    </div>
  );
}

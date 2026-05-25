import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { User } from "lucide-react";

export default function Header() {
  const { user, isAuthenticated } = useAuth();

  return (
    <>
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="container flex items-center justify-between px-4" style={{ height: "64px" }}>
          {/* Left: logo */}
          <div className="flex items-center gap-1.5">
            <span className="text-xl leading-none" style={{ marginTop: "-2px" }}>💰</span>
            <div className="flex flex-col items-end">
              <Link href="/" className="no-underline">
                <span className="gold-gradient-text font-bold text-lg leading-none tracking-tight">
                  hongxcollections
                </span>
              </Link>
              <span
                className="block"
                style={{
                  fontSize: "6px",
                  color: "rgba(180, 130, 50, 0.5)",
                  lineHeight: 1,
                  letterSpacing: "0.02em",
                  marginTop: "0px",
                }}
              >
                Powered by 大BB錢幣店
              </span>
            </div>
          </div>

          {/* Right: user avatar + name — aligned near bottom of nav */}
          {isAuthenticated && user && (
            <Link
              href="/profile"
              className="no-underline flex items-center gap-1.5 self-end pb-2"
            >
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name ?? ""}
                  className="rounded-full object-cover flex-shrink-0"
                  style={{ width: "12px", height: "12px" }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ width: "12px", height: "12px", background: "#F5DEB3" }}
                >
                  <User size={7} style={{ color: "#E07B00" }} />
                </div>
              )}
              <span
                className="font-medium leading-none max-w-[100px] truncate"
                style={{ fontSize: "8px", color: "#333" }}
              >
                {user.name ?? "用戶"}
              </span>
            </Link>
          )}
        </div>
      </nav>
      {/* Spacer for fixed nav */}
      <div style={{ height: "64px" }} />
    </>
  );
}

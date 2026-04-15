import { Link } from "wouter";

export default function Header() {
  return (
    <>
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="container flex items-center px-4" style={{ height: "64px" }}>
          <div className="flex items-center gap-1.5 w-full">
            {/* 💰 icon */}
            <span className="text-xl leading-none" style={{ marginTop: "-2px" }}>💰</span>
            {/* 兩行文字區域 */}
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
        </div>
      </nav>
      {/* Spacer for fixed nav */}
      <div style={{ height: "64px" }} />
    </>
  );
}

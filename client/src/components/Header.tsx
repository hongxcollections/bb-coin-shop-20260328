import { Link } from "wouter";

export default function Header() {
  return (
    <>
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="container flex items-center h-12 px-4">
          <div className="flex flex-col items-start w-full">
            <Link href="/" className="no-underline">
              <span className="gold-gradient-text font-bold text-lg leading-tight tracking-tight">
                hongxcollections
              </span>
            </Link>
            <span
              className="block text-right w-full"
              style={{
                fontSize: "6px",
                color: "rgba(180, 130, 50, 0.55)",
                lineHeight: 1.2,
                letterSpacing: "0.02em",
                marginTop: "-1px",
              }}
            >
              Powered by 大BB錢幣店
            </span>
          </div>
        </div>
      </nav>
      {/* Spacer for fixed nav */}
      <div className="h-12" />
    </>
  );
}

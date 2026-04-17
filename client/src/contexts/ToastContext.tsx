import { createContext, useContext, useRef, useState, useCallback, ReactNode } from "react";

export interface ToastOptions {
  title: string;
  desc?: string;
  icon?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((opts: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(opts);
    timerRef.current = setTimeout(
      () => setToast(null),
      opts.durationMs ?? 3000
    );
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="bottom-nav-toast">
          <div className="bottom-nav-toast-inner">
            {toast.icon && (
              <span className="bottom-nav-toast-icon">{toast.icon}</span>
            )}
            <div>
              <div className="bottom-nav-toast-title">{toast.title}</div>
              {toast.desc && (
                <div className="bottom-nav-toast-desc">{toast.desc}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

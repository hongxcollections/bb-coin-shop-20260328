import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmTone = "default" | "danger" | "warning";

export interface ConfirmOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = React.createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingState | null>(null);

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    if (pending) pending.resolve(result);
    setPending(null);
  };

  const tone = pending?.tone ?? "default";
  const titleClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-orange-600"
        : "";
  const actionClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : tone === "warning"
        ? "bg-orange-500 hover:bg-orange-600"
        : "";

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={titleClass}>
              {pending?.title ?? "請確認"}
            </AlertDialogTitle>
            {pending?.description != null && (
              <AlertDialogDescription asChild>
                <div className="whitespace-pre-line text-sm text-muted-foreground">
                  {pending.description}
                </div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {pending?.cancelText ?? "取消"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={actionClass}
            >
              {pending?.confirmText ?? "確定"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmCtx);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx;
}

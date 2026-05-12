import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

function compressImage(file: File, maxPx = 1600, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) { resolve(file); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => resolve(file);
    img.src = objUrl;
  });
}

interface Props {
  value: string;
  onChange: (url: string) => void;
}

export function CoverImageUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const signUpload = trpc.merchants.signImageUpload.useMutation();
  const uploadImage = trpc.merchants.uploadProductImage.useMutation();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("請揀圖片檔"); return; }
    if (file.size > MAX_FILE_SIZE * 4) { toast.error("圖片太大（>32MB）"); return; }
    setUploading(true);
    try {
      const processed = await compressImage(file);
      let finalUrl = "";
      try {
        const signed = await signUpload.mutateAsync({
          kind: "product",
          mimeType: processed.type || "image/jpeg",
          fileName: processed.name,
        });
        if (signed.mode === "direct") {
          const putRes = await fetch(signed.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": processed.type || "image/jpeg" },
            body: processed,
          });
          if (!putRes.ok) throw new Error(`S3 直傳失敗 ${putRes.status}`);
          finalUrl = signed.finalUrl;
        }
      } catch (e) {
        console.warn("[cover-upload] direct upload failed, fallback to server", e);
      }
      if (!finalUrl) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = () => reject(new Error("讀取圖片失敗"));
          reader.readAsDataURL(processed);
        });
        const { url } = await uploadImage.mutateAsync({
          imageData: base64,
          fileName: processed.name,
          mimeType: processed.type || "image/jpeg",
        });
        finalUrl = url;
      }
      onChange(finalUrl);
      toast.success("封面已上載");
    } catch (err: any) {
      toast.error(err?.message ?? "上載失敗");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="cover" className="max-h-40 rounded-lg object-cover border border-amber-200" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full w-6 h-6 flex items-center justify-center shadow"
            title="移除封面"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
              更換封面
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-xl py-6 px-4 flex flex-col items-center justify-center gap-1 text-sm text-amber-700 hover:bg-amber-50/50 transition disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="font-medium">{uploading ? "上載中…" : "點此上載封面圖"}</span>
          <span className="text-[11px] text-gray-400">建議 1200×630，會自動壓縮</span>
        </button>
      )}
    </div>
  );
}

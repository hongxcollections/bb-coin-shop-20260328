import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  ChevronLeft, ChevronDown, Plus, Loader2, Trash2, X, Upload, Save,
  EyeOff, Images, FileImage, Check, Download,
} from "lucide-react";
import { GalleryShareMenu } from "@/components/ShareMenu";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface GalleryRow {
  id: number; merchantId: number; merchantName: string; title: string;
  description: string | null; coverImageUrl: string | null; columnsPerRow: number;
  status: string; itemCount: number;
}

interface GalleryItem {
  id: number; galleryId: number; merchantId: number; itemName: string;
  itemNumber: string | null; price: string; currency: string; imageUrl: string;
  s3Key: string | null; status: string; sortOrder: number;
}

type View = 'list' | 'create' | 'edit';
type EditTab = 'info' | 'items' | 'publish';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = { draft: '草稿', active: '已發佈', hidden: '已下架' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-orange-100 text-orange-700',
  active: 'bg-green-100 text-green-700',
  hidden: 'bg-gray-100 text-gray-500',
};
const ITEM_STATUS_LABELS: Record<string, string> = { active: '在售', sold: '已售', hidden: '下架' };

const compressImage = (file: File, maxPx = 1280, quality = 0.78): Promise<File> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg', quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = objUrl;
  });

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function MerchantGallery() {
  const { isAuthenticated } = useAuth();
  const confirm = useConfirm();

  const [view, setView] = useState<View>('list');
  const [editTab, setEditTab] = useState<EditTab>('info');
  const [editGalleryId, setEditGalleryId] = useState<number | null>(null);

  // Create form state
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCols, setCreateCols] = useState<number>(3);

  // Edit info form state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCols, setEditCols] = useState<number>(3);

  // Items local draft state
  const [draftItems, setDraftItems] = useState<GalleryItem[]>([]);
  const didSyncRef = useRef(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox + pinch-zoom
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  // Batch edit panel
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchStartNum, setBatchStartNum] = useState('1');
  const [batchPrice, setBatchPrice] = useState('');

  // Gallery poster modal
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [savingPoster, setSavingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  // ── tRPC ──
  const galleriesQ = trpc.productGalleries.myGalleries.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const getForEditQ = trpc.productGalleries.getForEdit.useQuery(
    { id: editGalleryId! },
    { enabled: editGalleryId !== null, refetchOnWindowFocus: false }
  );

  const createM = trpc.productGalleries.createGallery.useMutation({
    onSuccess: (data) => { galleriesQ.refetch(); openEdit(data.id); toast.success('圖片集已建立'); },
    onError: (e) => toast.error(e.message),
  });
  const updateInfoM = trpc.productGalleries.updateGallery.useMutation({
    onSuccess: () => { galleriesQ.refetch(); toast.success('設定已儲存'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGalleryM = trpc.productGalleries.deleteGallery.useMutation({
    onSuccess: () => { galleriesQ.refetch(); setView('list'); toast.success('圖片集已刪除'); },
    onError: (e) => toast.error(e.message),
  });
  const signUploadM = trpc.productGalleries.signItemImageUpload.useMutation();
  const addItemsM = trpc.productGalleries.addItems.useMutation();
  const batchUpdateM = trpc.productGalleries.batchUpdateItems.useMutation({
    onSuccess: () => toast.success('已儲存所有變更'),
    onError: (e) => toast.error(e.message),
  });
  const deleteItemM = trpc.productGalleries.deleteItem.useMutation({
    onError: (e) => toast.error(e.message),
  });

  // Sync on first load of a gallery
  useEffect(() => {
    const d = getForEditQ.data;
    if (!d || didSyncRef.current) return;
    setEditTitle(d.gallery.title);
    setEditDesc((d.gallery as any).description ?? '');
    setEditCols((d.gallery as any).columnsPerRow ?? 3);
    setDraftItems(d.items as GalleryItem[]);
    didSyncRef.current = true;
  }, [getForEditQ.data]);

  function openEdit(id: number) {
    setEditGalleryId(id);
    setView('edit');
    setEditTab('info');
    didSyncRef.current = false;
    setDraftItems([]);
  }

  function goList() {
    setView('list');
    setEditGalleryId(null);
    setCreateTitle('');
    setCreateDesc('');
  }

  async function handleCreate() {
    if (!createTitle.trim()) { toast.error('請輸入圖片集名稱'); return; }
    createM.mutate({ title: createTitle.trim(), description: createDesc.trim() || undefined, columnsPerRow: createCols });
  }

  async function handleSaveInfo() {
    if (!editGalleryId) return;
    if (!editTitle.trim()) { toast.error('請輸入圖片集名稱'); return; }
    updateInfoM.mutate({ id: editGalleryId, title: editTitle.trim(), description: editDesc.trim() || undefined, columnsPerRow: editCols });
  }

  async function handleSetStatus(status: 'draft' | 'active' | 'hidden') {
    if (!editGalleryId) return;
    updateInfoM.mutate({ id: editGalleryId, status }, {
      onSuccess: () => {
        getForEditQ.refetch();
        galleriesQ.refetch();
        const msgs: Record<string, string> = { draft: '已設為草稿', active: '已發佈', hidden: '已下架' };
        toast.success(msgs[status]);
      },
    });
  }

  async function handleDeleteGallery() {
    if (!editGalleryId) return;
    const ok = await confirm({
      title: '刪除圖片集',
      description: '確定刪除整個圖片集及所有圖片？此動作不可還原。',
      confirmText: '確定刪除',
      cancelText: '取消',
    });
    if (!ok) return;
    deleteGalleryM.mutate({ id: editGalleryId });
  }

  async function handleSavePoster() {
    setSavingPoster(true);
    try {
      const cols = editCols;
      const items = draftItems.filter(i => i.status !== 'hidden');
      const title = currentGallery?.title ?? '';
      const merchantName = (currentGallery?.merchantName as string | undefined) ?? '';
      const description = (currentGallery as any)?.description ?? '';

      const W = 1080;
      const pad = 28;
      const gap = 8;
      const cellW = Math.floor((W - pad * 2 - gap * (cols - 1)) / cols);
      const imgH = cellW;
      const textH = 44;
      const cellH = imgH + textH;
      const rows = Math.ceil(items.length / cols);

      // measure header height
      const tmpCtx = document.createElement('canvas').getContext('2d')!;
      let headerH = pad + 48; // title
      if (merchantName) headerH += 28;
      if (description) {
        tmpCtx.font = '22px sans-serif';
        const maxW = W - pad * 2;
        let line = '';
        let lineCount = 0;
        for (const ch of description) {
          const test = line + ch;
          if (tmpCtx.measureText(test).width > maxW && line) { lineCount++; line = ch; }
          else line = test;
        }
        if (line) lineCount++;
        headerH += lineCount * 28 + 16;
      }
      const H = headerH + rows * (cellH + gap) + pad;

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // title
      let y = pad;
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 38px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, W / 2, y + 38);
      y += 52;

      if (merchantName) {
        ctx.fillStyle = '#888888';
        ctx.font = '24px sans-serif';
        ctx.fillText(merchantName, W / 2, y + 22);
        y += 32;
      }

      if (description) {
        ctx.fillStyle = '#555555';
        ctx.font = '22px sans-serif';
        const maxW = W - pad * 2;
        let line = '';
        for (const ch of description) {
          const test = line + ch;
          if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, W / 2, y + 22);
            y += 28;
            line = ch;
          } else line = test;
        }
        if (line) { ctx.fillText(line, W / 2, y + 22); y += 28; }
        y += 12;
      }

      // load images via fetch→blob (avoids canvas CORS taint)
      const loadedImgs = await Promise.all(items.map(async (item) => {
        try {
          const resp = await fetch(item.imageUrl);
          const blob = await resp.blob();
          const burl = URL.createObjectURL(blob);
          return await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(burl); resolve(img); };
            img.onerror = reject;
            img.src = burl;
          });
        } catch { return null; }
      }));

      // draw item cards
      const r = 10;
      items.forEach((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = pad + col * (cellW + gap);
        const iy = y + row * (cellH + gap);

        // card shadow + border
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        (ctx as any).roundRect(x, iy, cellW, cellH, r);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        (ctx as any).roundRect(x, iy, cellW, cellH, r);
        ctx.stroke();

        // clip image to top rounded corners
        ctx.save();
        ctx.beginPath();
        (ctx as any).roundRect(x, iy, cellW, imgH, [r, r, 0, 0]);
        ctx.clip();
        const img = loadedImgs[idx];
        if (img) {
          const aspect = img.width / img.height;
          let sw = img.width, sh = img.height, sx = 0, sy = 0;
          if (aspect > 1) { sw = img.height; sx = (img.width - sw) / 2; }
          else { sh = img.width; sy = (img.height - sh) / 2; }
          ctx.drawImage(img, sx, sy, sw, sh, x, iy, cellW, imgH);
        } else {
          ctx.fillStyle = '#f3f4f6';
          ctx.fillRect(x, iy, cellW, imgH);
        }
        ctx.restore();

        // name
        const fs = Math.max(13, Math.floor(cellW / 7));
        ctx.fillStyle = '#374151';
        ctx.font = `${fs}px sans-serif`;
        ctx.textAlign = 'center';
        const nameMax = Math.floor(cellW / (fs * 0.6));
        const nameText = item.itemName.length > nameMax ? item.itemName.slice(0, nameMax - 1) + '…' : item.itemName;
        ctx.fillText(nameText, x + cellW / 2, iy + imgH + 16);

        // price
        if (Number(item.price) > 0) {
          ctx.fillStyle = '#ea580c';
          ctx.font = `bold ${fs}px sans-serif`;
          ctx.fillText(`HK$${item.price}`, x + cellW / 2, iy + imgH + 34);
        }
      });

      canvas.toBlob((blob) => {
        if (!blob) { toast.error('生成失敗'); setSavingPoster(false); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gallery-${editGalleryId}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('圖片已儲存');
        setSavingPoster(false);
      }, 'image/png');
    } catch {
      toast.error('生成圖片失敗，請重試');
      setSavingPoster(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !editGalleryId) return;

    const maxNew = 200 - draftItems.length;
    if (maxNew <= 0) { toast.error('已達最多 200 張上限'); return; }
    const allFiles = Array.from(files);
    e.target.value = '';
    const fileArr = allFiles.slice(0, maxNew);
    if (fileArr.length < allFiles.length) toast.info(`已達上限，只上載首 ${maxNew} 張`);

    setUploading(true);
    setUploadDone(0);
    setUploadTotal(fileArr.length);

    const uploaded: { imageUrl: string; s3Key: string }[] = [];
    for (const file of fileArr) {
      try {
        const compressed = await compressImage(file);
        const { uploadUrl, finalUrl, key } = await signUploadM.mutateAsync({
          mimeType: 'image/jpeg',
          fileName: compressed.name,
        });
        await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/jpeg' } });
        uploaded.push({ imageUrl: finalUrl, s3Key: key });
      } catch {
        toast.error(`上載失敗: ${file.name}`);
      }
      setUploadDone(d => d + 1);
    }

    if (uploaded.length > 0) {
      try {
        await addItemsM.mutateAsync({ galleryId: editGalleryId, items: uploaded });
        const refreshed = await getForEditQ.refetch();
        if (refreshed.data) {
          const serverItems = refreshed.data.items as GalleryItem[];
          setDraftItems(prev => {
            const prevMap = new Map(prev.map(i => [i.id, i]));
            return serverItems.map(si => prevMap.get(si.id) ?? si);
          });
        }
        toast.success(`成功上載 ${uploaded.length} 張`);
      } catch (err: any) {
        toast.error(err.message ?? '儲存失敗');
      }
    }
    setUploading(false);
  }

  function updateDraftItem(id: number, patch: Partial<GalleryItem>) {
    setDraftItems(items => items.map(i => i.id === id ? { ...i, ...patch } : i));
  }

  async function handleBatchSave() {
    if (!editGalleryId) return;
    batchUpdateM.mutate({
      galleryId: editGalleryId,
      items: draftItems.map(i => ({
        id: i.id,
        itemName: i.itemName,
        itemNumber: i.itemNumber ?? '',
        price: parseFloat(i.price) || 0,
        status: i.status as 'active' | 'sold' | 'hidden',
      })),
    });
  }

  async function handleDeleteItem(id: number) {
    const ok = await confirm({ title: '刪除圖片', description: '確定刪除此圖片商品？', confirmText: '刪除', cancelText: '取消' });
    if (!ok) return;
    deleteItemM.mutate({ id }, {
      onSuccess: () => setDraftItems(items => items.filter(i => i.id !== id)),
    });
  }

  const currentGallery = getForEditQ.data?.gallery as any;
  const galleries = (galleriesQ.data ?? []) as GalleryRow[];

  if (!isAuthenticated) return null;

  // ── Lightbox helpers ──
  function openLightbox(src: string) {
    setLightboxSrc(src);
    setLbZoom(1); setLbPanX(0); setLbPanY(0);
  }
  function lbPinchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function lbTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinchStartDist.current = lbPinchDist(e.touches);
      pinchStartZoom.current = lbZoom;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTime.current < 280) { setLbZoom(1); setLbPanX(0); setLbPanY(0); }
      lastTapTime.current = now;
      panStartTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartOffset.current = { x: lbPanX, y: lbPanY };
    }
  }
  function lbTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const z = Math.min(6, Math.max(1, pinchStartZoom.current * (lbPinchDist(e.touches) / pinchStartDist.current)));
      setLbZoom(z);
    } else if (e.touches.length === 1 && lbZoom > 1) {
      setLbPanX(panStartOffset.current.x + e.touches[0].clientX - panStartTouch.current.x);
      setLbPanY(panStartOffset.current.y + e.touches[0].clientY - panStartTouch.current.y);
    }
  }

  // ── Batch helpers ──
  function applyBatchName() {
    if (!batchName.trim()) { toast.error('請輸入名稱前綴'); return; }
    const start = parseInt(batchStartNum, 10) || 1;
    setDraftItems(items => items.map((item, idx) => ({
      ...item, itemName: `${batchName.trim()} ${String(start + idx).padStart(3, '0')}`,
    })));
    toast.success('批量命名完成');
  }
  function applyBatchPrice() {
    if (!batchPrice) { toast.error('請輸入價錢'); return; }
    setDraftItems(items => items.map(item => ({ ...item, price: batchPrice })));
    toast.success('批量設價完成');
  }

  // ── Lightbox overlay ──
  if (lightboxSrc) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={() => { if (lbZoom <= 1) setLightboxSrc(null); }}
      >
        <button
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
          onClick={() => setLightboxSrc(null)}
        >
          <X className="w-5 h-5 text-white" />
        </button>
        {lbZoom > 1 && (
          <button
            className="absolute top-4 left-4 text-white/70 text-xs px-3 py-1.5 rounded-xl bg-black/50"
            onClick={() => { setLbZoom(1); setLbPanX(0); setLbPanY(0); }}
          >
            重設縮放
          </button>
        )}
        <img
          src={lightboxSrc}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          style={{
            transform: `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`,
            transformOrigin: 'center center',
            touchAction: 'none',
            cursor: lbZoom > 1 ? 'grab' : 'default',
          }}
          onClick={e => e.stopPropagation()}
          onTouchStart={lbTouchStart}
          onTouchMove={lbTouchMove}
          alt=""
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F5' }}>
      <Header />

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-20">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/merchant-dashboard" className="p-1 rounded-full hover:bg-gray-100">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900 flex-1">圖片集商品</h1>
          </div>

          <button
            onClick={() => setView('create')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl mb-4 font-semibold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
          >
            <Plus className="w-4 h-4" />
            新增圖片集
          </button>

          {galleriesQ.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : galleries.length === 0 ? (
            <div className="text-center py-16">
              <Images className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">未有圖片集</p>
              <p className="text-gray-300 text-xs mt-1">建立第一個圖片集，批量展示商品</p>
            </div>
          ) : (
            <div className="space-y-3">
              {galleries.map(g => (
                <div key={g.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  {g.coverImageUrl ? (
                    <img src={g.coverImageUrl} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Images className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold text-sm text-gray-900 truncate">{g.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[g.status] ?? ''}`}>
                        {STATUS_LABELS[g.status] ?? g.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{g.itemCount} 張圖片 · {g.columnsPerRow} 列</p>
                  </div>
                  <button
                    onClick={() => openEdit(g.id)}
                    className="text-xs font-semibold text-orange-600 px-3 py-1.5 rounded-xl border border-orange-200 hover:border-orange-300 flex-shrink-0"
                  >
                    管理
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE VIEW ── */}
      {view === 'create' && (
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-20">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={goList} className="p-1 rounded-full hover:bg-gray-100">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">新增圖片集</h1>
          </div>

          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">圖片集名稱 *</label>
              <input
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                placeholder="例：2024 波卡 SR 卡冊"
                maxLength={200}
                className="w-full px-3 py-2.5 text-sm outline-none"
                style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">描述（選填）</label>
              <textarea
                value={createDesc}
                onChange={e => setCreateDesc(e.target.value)}
                placeholder="例：全新未玩，有碼有盒..."
                maxLength={2000}
                rows={3}
                className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px' }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">公開版面每行顯示（預設 3）</label>
              <div className="flex gap-1.5">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    onClick={() => setCreateCols(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                      createCols === n ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 bg-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={createM.isPending || !createTitle.trim()}
            className="w-full mt-4 py-3 rounded-2xl font-semibold text-white text-sm disabled:opacity-50 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
          >
            {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '建立圖片集'}
          </button>
        </div>
      )}

      {/* ── EDIT VIEW ── */}
      {view === 'edit' && editGalleryId !== null && (
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-20">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={goList} className="p-1 rounded-full hover:bg-gray-100">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <p className="flex-1 font-bold text-base text-gray-900 truncate">{editTitle || '圖片集'}</p>
            {currentGallery && (
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[currentGallery.status] ?? ''}`}>
                {STATUS_LABELS[currentGallery.status] ?? currentGallery.status}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="flex bg-white rounded-xl border border-gray-100 p-1 mb-4 gap-0.5">
            {([['info', '基本設定'], ['items', '圖片商品'], ['publish', '發佈']] as [EditTab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setEditTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  editTab === tab ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {getForEditQ.isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : (
            <>
              {/* Tab: 基本設定 */}
              {editTab === 'info' && (
                <div className="bg-white rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">圖片集名稱 *</label>
                    <input
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      maxLength={200}
                      className="w-full px-3 py-2.5 text-sm outline-none"
                      style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">描述</label>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">公開版面每行顯示（預設 3）</label>
                    <div className="flex gap-1.5">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button
                          key={n}
                          onClick={() => setEditCols(n)}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                            editCols === n ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 bg-white'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleSaveInfo}
                    disabled={updateInfoM.isPending}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                  >
                    {updateInfoM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '儲存設定'}
                  </button>
                </div>
              )}

              {/* Tab: 圖片商品 */}
              {editTab === 'items' && (
                <div>
                  <div className="bg-white rounded-2xl p-3 mb-3 flex items-center gap-3 flex-wrap">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || draftItems.length >= 200}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? `上載中 ${uploadDone}/${uploadTotal}` : '上載圖片'}
                    </button>
                    <span className="text-xs text-gray-400">{draftItems.length} / 200</span>
                    {draftItems.length > 0 && (
                      <button
                        onClick={handleBatchSave}
                        disabled={batchUpdateM.isPending}
                        className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: '#22C55E' }}
                      >
                        <Save className="w-3.5 h-3.5" />
                        {batchUpdateM.isPending ? '儲存中…' : '儲存所有'}
                      </button>
                    )}
                  </div>

                  {/* Batch edit panel */}
                  {draftItems.length > 0 && (
                    <div className="bg-white rounded-2xl mb-3 overflow-hidden">
                      <button
                        onClick={() => setShowBatchPanel(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700"
                      >
                        <span>批量設定</span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showBatchPanel ? 'rotate-180' : ''}`} />
                      </button>
                      {showBatchPanel && (
                        <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1.5">批量命名（前綴＋流水號）</p>
                            <div className="flex gap-2">
                              <input
                                value={batchName}
                                onChange={e => setBatchName(e.target.value)}
                                placeholder="名稱前綴"
                                maxLength={50}
                                className="flex-1 px-2.5 py-1.5 text-sm outline-none"
                                style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '10px' }}
                              />
                              <input
                                value={batchStartNum}
                                onChange={e => setBatchStartNum(e.target.value)}
                                placeholder="起始#"
                                inputMode="numeric"
                                className="w-14 px-2 py-1.5 text-sm outline-none text-center"
                                style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '10px' }}
                              />
                              <button
                                onClick={applyBatchName}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                              >套用</button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">例：前綴「銀幣」起始 1 → 銀幣 001、銀幣 002…</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1.5">批量統一價錢</p>
                            <div className="flex gap-2">
                              <input
                                value={batchPrice}
                                onChange={e => setBatchPrice(e.target.value)}
                                placeholder="HKD$ 價格"
                                inputMode="decimal"
                                className="flex-1 px-2.5 py-1.5 text-sm outline-none"
                                style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '10px' }}
                              />
                              <button
                                onClick={applyBatchPrice}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                                style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                              >套用</button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">套用後仍可個別修改各商品價錢</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {draftItems.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center">
                      <FileImage className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">點擊「上載圖片」開始添加商品</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        {draftItems.map(item => (
                          <div key={item.id} className="bg-white rounded-xl overflow-hidden border border-gray-100">
                            <div className="relative">
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="w-full aspect-square object-cover cursor-zoom-in"
                                onClick={() => openLightbox(item.imageUrl)}
                              />
                              {item.status === 'sold' && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <span className="text-white text-xs font-bold bg-black/60 px-2 py-0.5 rounded-full">已售出</span>
                                </div>
                              )}
                              {item.status === 'hidden' && (
                                <div className="absolute top-1.5 right-1.5">
                                  <EyeOff className="w-4 h-4 text-white drop-shadow-sm" />
                                </div>
                              )}
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                            <div className="p-2 space-y-1.5">
                              <input
                                value={item.itemNumber ?? ''}
                                onChange={e => updateDraftItem(item.id, { itemNumber: e.target.value })}
                                placeholder="#編號"
                                maxLength={100}
                                className="w-full px-2 py-1 text-xs outline-none"
                                style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '8px' }}
                              />
                              <input
                                value={item.itemName}
                                onChange={e => updateDraftItem(item.id, { itemName: e.target.value })}
                                placeholder="商品名稱"
                                maxLength={200}
                                className="w-full px-2 py-1 text-xs outline-none"
                                style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '8px' }}
                              />
                              <input
                                value={item.price}
                                onChange={e => updateDraftItem(item.id, { price: e.target.value })}
                                placeholder="HKD$ 價格"
                                inputMode="decimal"
                                className="w-full px-2 py-1 text-xs outline-none"
                                style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '8px' }}
                              />
                              <div className="flex gap-1">
                                {(['active', 'sold', 'hidden'] as const).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => updateDraftItem(item.id, { status: s })}
                                    className={`flex-1 py-1 rounded text-[9px] font-semibold transition-colors ${
                                      item.status === s
                                        ? s === 'active' ? 'bg-green-500 text-white'
                                          : s === 'sold' ? 'bg-gray-400 text-white'
                                          : 'bg-yellow-400 text-white'
                                        : 'bg-gray-100 text-gray-400'
                                    }`}
                                  >
                                    {ITEM_STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={handleBatchSave}
                        disabled={batchUpdateM.isPending}
                        className="w-full mt-4 py-3 rounded-2xl font-semibold text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                      >
                        {batchUpdateM.isPending
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Save className="w-4 h-4" />儲存所有變更</>
                        }
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Tab: 發佈 */}
              {editTab === 'publish' && (
                <div className="space-y-3">
                  <div className="bg-white rounded-2xl p-3">
                    <p className="text-xs font-semibold text-gray-400 mb-2">發佈狀態</p>
                    <div className="flex gap-2">
                      {([
                        ['draft',  '草稿'],
                        ['active', '已發佈'],
                        ['hidden', '已下架'],
                      ] as [string, string][]).map(([s, label]) => (
                        <button
                          key={s}
                          onClick={() => handleSetStatus(s as 'draft' | 'active' | 'hidden')}
                          disabled={updateInfoM.isPending}
                          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 ${
                            currentGallery?.status === s
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {currentGallery?.status === 'active' && (
                    <div className="bg-white rounded-2xl p-3">
                      <p className="text-xs font-semibold text-gray-400 mb-2">公開連結</p>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs text-blue-600 break-all flex-1 leading-relaxed">
                          {window.location.origin}/gallery/{editGalleryId}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/gallery/${editGalleryId}`);
                            toast.success('已複製連結');
                          }}
                          className="text-xs text-gray-500 px-2.5 py-1.5 rounded-lg bg-gray-100 flex-shrink-0"
                        >
                          複製
                        </button>
                      </div>
                      <GalleryShareMenu
                        galleryId={editGalleryId!}
                        title={currentGallery?.title ?? ''}
                        merchantName={currentGallery?.merchantName ?? null}
                      />
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-3">
                    <button
                      onClick={() => setShowPosterModal(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}
                    >
                      <Images className="w-4 h-4" />
                      生成圖片集
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl p-3">
                    <p className="text-xs font-semibold text-red-400 mb-2">危險操作</p>
                    <button
                      onClick={handleDeleteGallery}
                      disabled={deleteGalleryM.isPending}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除此圖片集
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Gallery Poster Modal — z-[300] > BottomNav z-[200] */}
      {showPosterModal && (
        <div className="fixed inset-0 z-[300] bg-black/70 flex flex-col" style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 3 }}>
          <div className="flex-1 bg-white rounded-t-2xl flex flex-col overflow-hidden">
            {/* scrollable preview — min-h-0 stops flex overflow leak */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div ref={posterRef} className="p-3 bg-white">
                <p className="text-sm font-bold text-gray-900 mb-0.5 text-center">{currentGallery?.title}</p>
                {(currentGallery as any)?.merchantName && (
                  <p className="text-[10px] text-gray-400 text-center mb-1">{(currentGallery as any).merchantName}</p>
                )}
                {(currentGallery as any)?.description && (
                  <p className="text-[10px] text-gray-500 text-center mb-2 leading-relaxed px-2">{(currentGallery as any).description}</p>
                )}
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${editCols}, 1fr)` }}
                >
                  {draftItems.filter(i => i.status !== 'hidden').map(item => (
                    <div key={item.id} className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
                      <img
                        src={item.imageUrl}
                        alt={item.itemName}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="px-1 py-1">
                        <p className="text-[8px] text-center text-gray-700 truncate leading-tight">{item.itemName}</p>
                        {Number(item.price) > 0 && (
                          <p className="text-[8px] text-center text-orange-600 font-semibold leading-tight">HK${item.price}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {draftItems.filter(i => i.status !== 'hidden').length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">未有商品可顯示</p>
                )}
              </div>
            </div>
            {/* bottom action buttons — safe-area padding for iPhone notch */}
            <div
              className="flex gap-3 px-4 pt-3 bg-white border-t border-gray-100"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <button
                onClick={() => setShowPosterModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSavePoster}
                disabled={savingPoster}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}
              >
                {savingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {savingPoster ? '生成中…' : '儲存圖片'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

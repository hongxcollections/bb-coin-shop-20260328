import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  ChevronLeft, ChevronDown, Plus, Loader2, Trash2, X, Upload, Save,
  Images, Check, ExternalLink,
} from "lucide-react";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

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

interface GalleryImageRow {
  id: number; galleryId: number; merchantId: number; itemId: number | null;
  imageUrl: string; s3Key: string | null; sortOrder: number;
}

type View = 'list' | 'create' | 'edit';

const STATUS_LABELS: Record<string, string> = { draft: '草稿', active: '已發佈', hidden: '已下架' };
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-orange-100 text-orange-700',
  active: 'bg-green-100 text-green-700',
  hidden: 'bg-gray-100 text-gray-500',
};
const ITEM_STATUS_LABELS: Record<string, string> = { active: '在售', sold: '已售', hidden: '下架' };
const ITEM_STATUS_COLORS: Record<string, string> = {
  active: '#22C55E', sold: '#EF4444', hidden: '#9CA3AF',
};

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

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function UserGallery({ onClose }: Props) {
  const { isAuthenticated } = useAuth();
  const confirm = useConfirm();

  const [view, setView] = useState<View>('list');
  const [editGalleryId, setEditGalleryId] = useState<number | null>(null);

  // Create form
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createCols, setCreateCols] = useState(3);

  // Edit info form
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCols, setEditCols] = useState(3);

  // Items draft
  const [draftItems, setDraftItems] = useState<GalleryItem[]>([]);
  const didSyncRef = useRef(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxImgIdx, setLightboxImgIdx] = useState(0);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
  const lightboxItemIdRef = useRef<number | null>(null);
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const panStartTouch = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const lbSwipeTouchX = useRef(0);

  // Batch edit panel
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [batchStartNum, setBatchStartNum] = useState('1');
  const [batchPrice, setBatchPrice] = useState('');

  // Pool assign picker
  const [assignPickerImageId, setAssignPickerImageId] = useState<number | null>(null);

  // Batch select
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<number>>(new Set());

  // Copy to other galleries picker
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [copyTargetIds, setCopyTargetIds] = useState<Set<number>>(new Set());

  // Pool batch select
  const [poolBatchMode, setPoolBatchMode] = useState(false);
  const [poolSelectedIds, setPoolSelectedIds] = useState<Set<number>>(new Set());
  const [poolAssignItemId, setPoolAssignItemId] = useState<number | null>(null);

  const scrollToItemIdRef = useRef<number | null>(null);

  // ─── tRPC ───
  const galleriesQ = trpc.productGalleries.userMyGalleries.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const getForEditQ = trpc.productGalleries.userGetForEdit.useQuery(
    { id: editGalleryId! },
    { enabled: editGalleryId !== null, refetchOnWindowFocus: false }
  );
  const galleryImagesQ = trpc.productGalleries.userGetGalleryImages.useQuery(
    { galleryId: editGalleryId! },
    { enabled: editGalleryId !== null && view === 'edit', refetchOnWindowFocus: false }
  );

  const createM = trpc.productGalleries.userCreateGallery.useMutation({
    onSuccess: (data) => { galleriesQ.refetch(); openEdit(data.id); toast.success('圖片集已建立'); },
    onError: (e) => toast.error(e.message),
  });
  const updateInfoM = trpc.productGalleries.userUpdateGallery.useMutation({
    onSuccess: () => { galleriesQ.refetch(); getForEditQ.refetch(); toast.success('設定已儲存'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGalleryM = trpc.productGalleries.userDeleteGallery.useMutation({
    onSuccess: () => { galleriesQ.refetch(); setView('list'); setEditGalleryId(null); toast.success('圖片集已刪除'); },
    onError: (e) => toast.error(e.message),
  });
  const signUploadM = trpc.productGalleries.userSignImageUpload.useMutation();
  const addToPoolM = trpc.productGalleries.userAddToPool.useMutation();
  const batchUpdateM = trpc.productGalleries.userBatchUpdateItems.useMutation({
    onSuccess: () => toast.success('已儲存所有變更'),
    onError: (e) => toast.error(e.message),
  });
  const deleteItemM = trpc.productGalleries.userDeleteItem.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const deletePoolImageM = trpc.productGalleries.userDeleteGalleryImage.useMutation({
    onSuccess: () => galleryImagesQ.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const assignImageM = trpc.productGalleries.userAssignImage.useMutation({
    onSuccess: () => { galleryImagesQ.refetch(); getForEditQ.refetch(); setAssignPickerImageId(null); setPoolAssignItemId(null); setPoolSelectedIds(new Set()); setPoolBatchMode(false); },
    onError: (e) => toast.error(e.message),
  });
  const createEmptyItemM = trpc.productGalleries.userCreateEmptyItem.useMutation({
    onSuccess: async () => {
      const refreshed = await getForEditQ.refetch();
      if (refreshed.data) {
        const serverItems = refreshed.data.items as GalleryItem[];
        setDraftItems(prev => {
          const prevMap = new Map(prev.map(i => [i.id, i]));
          const newItems = serverItems.filter(si => !prevMap.has(si.id));
          if (newItems.length > 0) scrollToItemIdRef.current = newItems[newItems.length - 1].id;
          return serverItems.map(si => prevMap.get(si.id) ?? si);
        });
      }
      toast.success('已新增空白商品');
    },
    onError: (e) => toast.error(e.message),
  });
  const copyItemsM = trpc.productGalleries.userCopyItemsToGalleries.useMutation({
    onSuccess: (data) => {
      toast.success(`已複製 ${data.created} 件至其他圖片集`);
      setBatchSelectMode(false);
      setBatchSelectedIds(new Set());
      setCopyPickerOpen(false);
      setCopyTargetIds(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  // Sync items on load
  useEffect(() => {
    const d = getForEditQ.data;
    if (!d || didSyncRef.current) return;
    setEditTitle(d.gallery.title);
    setEditDesc((d.gallery as any).description ?? '');
    setEditCols((d.gallery as any).columnsPerRow ?? 3);
    setDraftItems(d.items as GalleryItem[]);
    didSyncRef.current = true;
  }, [getForEditQ.data]);

  // Scroll to newly added item
  useEffect(() => {
    const target = scrollToItemIdRef.current;
    if (target === null || draftItems.length === 0) return;
    scrollToItemIdRef.current = null;
    const itemId = target === -1 ? draftItems[draftItems.length - 1].id : target;
    requestAnimationFrame(() => {
      document.getElementById(`ug-item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }, [draftItems]);

  function openEdit(id: number) {
    setEditGalleryId(id);
    setView('edit');
    didSyncRef.current = false;
    setDraftItems([]);
    setBatchSelectMode(false);
    setBatchSelectedIds(new Set());
  }

  function goList() {
    setView('list');
    setEditGalleryId(null);
    setCreateTitle('');
    setCreateDesc('');
    setBatchSelectMode(false);
    setBatchSelectedIds(new Set());
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
      confirmText: '刪除',
      cancelText: '取消',
    });
    if (!ok) return;
    deleteGalleryM.mutate({ id: editGalleryId });
  }

  async function processFiles(allFiles: File[]) {
    if (allFiles.length === 0 || !editGalleryId) return;
    setUploading(true);
    setUploadDone(0);
    setUploadTotal(allFiles.length);
    const uploaded: { imageUrl: string; s3Key: string }[] = [];
    for (const file of allFiles) {
      try {
        const compressed = await compressImage(file);
        const { uploadUrl, finalUrl, key } = await signUploadM.mutateAsync({ mimeType: 'image/jpeg', fileName: compressed.name });
        await fetch(uploadUrl, { method: 'PUT', body: compressed, headers: { 'Content-Type': 'image/jpeg' } });
        uploaded.push({ imageUrl: finalUrl, s3Key: key });
      } catch { toast.error(`上載失敗: ${file.name}`); }
      setUploadDone(d => d + 1);
    }
    if (uploaded.length > 0) {
      try {
        await addToPoolM.mutateAsync({ galleryId: editGalleryId!, images: uploaded });
        await galleryImagesQ.refetch();
        toast.success(`成功上載 ${uploaded.length} 張`);
      } catch (err: any) { toast.error(err.message ?? '儲存失敗'); }
    }
    setUploading(false);
  }

  async function handleUploadClick() {
    if (uploading) return;
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await (window as any).showOpenFilePicker({
          multiple: true,
          types: [{ description: 'Images', accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'] } }],
        });
        const files: File[] = await Promise.all(handles.map((h: any) => h.getFile()));
        await processFiles(files);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    fileInputRef.current?.click();
  }

  function handleUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    processFiles(files);
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

  // ─── Lightbox helpers ───
  function openLightbox(src: string, images?: string[], itemId?: number) {
    const imgs = images && images.length > 0 ? images : [src];
    const idx = imgs.indexOf(src);
    setLightboxImages(imgs);
    setLightboxImgIdx(idx >= 0 ? idx : 0);
    setLightboxSrc(src);
    setLbZoom(1); setLbPanX(0); setLbPanY(0);
    lightboxItemIdRef.current = itemId ?? null;
  }

  function closeLightbox() {
    const itemId = lightboxItemIdRef.current;
    setLightboxSrc(null);
    if (itemId !== null) {
      setTimeout(() => {
        document.getElementById(`ug-item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }, 60);
    }
  }

  function lbPinchDist(t: React.TouchList) {
    const dx = t[0].clientX - t[1].clientX; const dy = t[0].clientY - t[1].clientY;
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
      lbSwipeTouchX.current = e.touches[0].clientX;
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
  function lbTouchEnd(e: React.TouchEvent) {
    if (lbZoom > 1 || lightboxImages.length <= 1) return;
    const diff = lbSwipeTouchX.current - e.changedTouches[0].clientX;
    if (diff > 50 && lightboxImgIdx < lightboxImages.length - 1) {
      setLightboxImgIdx(i => i + 1); setLbZoom(1); setLbPanX(0); setLbPanY(0);
    } else if (diff < -50 && lightboxImgIdx > 0) {
      setLightboxImgIdx(i => i - 1); setLbZoom(1); setLbPanX(0); setLbPanY(0);
    }
  }

  const currentGallery = getForEditQ.data?.gallery as any;
  const galleries = (galleriesQ.data ?? []) as GalleryRow[];

  if (!isAuthenticated) return null;

  // ─── Lightbox overlay ───
  if (lightboxSrc) {
    const lbCurSrc = lightboxImages[lightboxImgIdx] ?? lightboxSrc;
    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={() => { if (lbZoom <= 1) closeLightbox(); }}
        onTouchEnd={lbTouchEnd}
      >
        <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10" onClick={closeLightbox}>
          <X className="w-5 h-5 text-white" />
        </button>
        {lbZoom > 1 && (
          <button className="absolute top-4 left-4 text-white/70 text-xs px-3 py-1.5 rounded-xl bg-black/50" onClick={() => { setLbZoom(1); setLbPanX(0); setLbPanY(0); }}>
            重設縮放
          </button>
        )}
        <img
          src={lbCurSrc}
          className="max-w-full max-h-full object-contain rounded-lg select-none"
          style={{ transform: `translate(${lbPanX}px, ${lbPanY}px) scale(${lbZoom})`, transformOrigin: 'center center', touchAction: 'none', cursor: lbZoom > 1 ? 'grab' : 'default' }}
          onClick={e => e.stopPropagation()}
          onTouchStart={lbTouchStart}
          onTouchMove={lbTouchMove}
          alt=""
          draggable={false}
        />
        {lightboxImages.length > 1 && (
          <div className="absolute flex gap-1.5 pointer-events-none" style={{ bottom: 32, left: 0, right: 0, justifyContent: 'center' }}>
            {lightboxImages.map((_, i) => (
              <div key={i} style={{
                width: i === lightboxImgIdx ? 14 : 6, height: 6, borderRadius: 3,
                background: i === lightboxImgIdx ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'width 0.2s',
              }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Assign picker overlay ───
  if (assignPickerImageId !== null && draftItems.length > 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setAssignPickerImageId(null)}>
        <div className="w-full bg-white rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <p className="text-sm font-bold text-gray-800 mb-3">選擇指定商品</p>
          <div className="space-y-2">
            {draftItems.map(item => (
              <button
                key={item.id}
                onClick={() => assignImageM.mutate({ imageId: assignPickerImageId, itemId: item.id })}
                className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border border-gray-100 hover:border-orange-300 text-left"
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.itemName || '(未命名)'}</p>
                  {item.itemNumber && <p className="text-xs text-gray-400">#{item.itemNumber}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Copy picker overlay ───
  if (copyPickerOpen && editGalleryId !== null) {
    const otherGalleries = galleries.filter(g => g.id !== editGalleryId);
    return (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setCopyPickerOpen(false)}>
        <div className="w-full bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <p className="text-sm font-bold text-gray-800 mb-1">複製到圖片集</p>
          <p className="text-xs text-gray-400 mb-3">選擇目標圖片集（可多選）</p>
          {otherGalleries.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">沒有其他圖片集</p>
          ) : (
            <div className="space-y-2 mb-4">
              {otherGalleries.map(g => {
                const selected = copyTargetIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => setCopyTargetIds(prev => {
                      const next = new Set(prev);
                      selected ? next.delete(g.id) : next.add(g.id);
                      return next;
                    })}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border text-left"
                    style={{ borderColor: selected ? '#FF8C00' : '#E5E5E5', background: selected ? '#FFF7ED' : '#fff' }}
                  >
                    {g.coverImageUrl ? (
                      <img src={g.coverImageUrl} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                        <Images className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{g.title}</p>
                      <p className="text-xs text-gray-400">{g.itemCount} 件</p>
                    </div>
                    {selected && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setCopyPickerOpen(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#F0F0F0', color: '#555' }}>取消</button>
            <button
              disabled={copyTargetIds.size === 0 || copyItemsM.isPending}
              onClick={() => {
                if (!editGalleryId) return;
                copyItemsM.mutate({
                  sourceGalleryId: editGalleryId,
                  itemIds: Array.from(batchSelectedIds),
                  targetGalleryIds: Array.from(copyTargetIds),
                });
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1"
              style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
            >
              {copyItemsM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `複製（${batchSelectedIds.size} 件）`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#F5F5F5' }} className="rounded-2xl overflow-hidden">

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <h2 className="text-base font-bold text-gray-900 flex-1">我的圖片集</h2>
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
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : galleries.length === 0 ? (
            <div className="text-center py-12">
              <Images className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">未有圖片集</p>
              <p className="text-gray-300 text-xs mt-1">建立第一個圖片集，批量展示你的商品</p>
            </div>
          ) : (
            <div className="space-y-3">
              {galleries.map(g => (
                <div key={g.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                  {g.coverImageUrl ? (
                    <img src={g.coverImageUrl} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Images className="w-5 h-5 text-gray-300" />
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
                  <div className="flex items-center gap-2">
                    {g.status === 'active' && (
                      <a
                        href={`/gallery/${g.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                        title="查看公開頁面"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    )}
                    <button
                      onClick={() => openEdit(g.id)}
                      className="text-xs font-semibold text-orange-600 px-3 py-1.5 rounded-xl border border-orange-200 hover:border-orange-300 flex-shrink-0"
                    >
                      管理
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE VIEW ── */}
      {view === 'create' && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={goList} className="p-1 rounded-full hover:bg-gray-200">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-base font-bold text-gray-900">新增圖片集</h2>
          </div>

          <div className="bg-white rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">圖片集名稱 *</label>
              <input
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                placeholder="例：2024 銀幣精選"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">公開版面每行顯示</label>
              <div className="flex gap-1.5 flex-wrap">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    onClick={() => setCreateCols(n)}
                    className={`w-8 h-8 rounded-xl text-sm font-bold border transition-colors ${
                      createCols === n ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-500 bg-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={createM.isPending || !createTitle.trim()}
              className="w-full py-3 rounded-2xl font-semibold text-white text-sm disabled:opacity-50 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
            >
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '建立圖片集'}
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT VIEW (single-page, no tabs) ── */}
      {view === 'edit' && editGalleryId !== null && (
        <div className="px-4 py-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={goList} className="p-1 rounded-full hover:bg-gray-200">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <p className="flex-1 font-bold text-base text-gray-900 truncate">{editTitle || '圖片集'}</p>
            {currentGallery && (
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[currentGallery.status] ?? ''}`}>
                {STATUS_LABELS[currentGallery.status] ?? currentGallery.status}
              </span>
            )}
          </div>

          {getForEditQ.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : (
            <div className="space-y-4">

              {/* ── 基本設定 ── */}
              <div className="bg-white rounded-2xl p-4 space-y-4">
                <p className="text-sm font-bold text-gray-700">基本設定</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">圖片集名稱 *</label>
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    maxLength={200}
                    className="w-full px-3 py-2.5 text-sm outline-none"
                    style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">描述</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    maxLength={2000}
                    rows={2}
                    className="w-full px-3 py-2.5 text-sm outline-none resize-none"
                    style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '12px' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">公開版面每行顯示</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        onClick={() => setEditCols(n)}
                        className={`w-8 h-8 rounded-xl text-sm font-bold border transition-colors ${
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

              {/* ── 發佈狀態 ── */}
              <div className="bg-white rounded-2xl p-4">
                <p className="text-sm font-bold text-gray-700 mb-3">發佈狀態</p>
                <div className="flex gap-2">
                  {(['draft', 'active', 'hidden'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => handleSetStatus(s)}
                      disabled={updateInfoM.isPending}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                        currentGallery?.status === s
                          ? s === 'active' ? 'border-green-400 bg-green-50 text-green-700'
                            : s === 'hidden' ? 'border-gray-300 bg-gray-100 text-gray-500'
                            : 'border-orange-400 bg-orange-50 text-orange-600'
                          : 'border-gray-200 text-gray-400 bg-white'
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                {currentGallery?.status === 'active' && (
                  <a
                    href={`/gallery/${editGalleryId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-orange-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    查看公開頁面
                  </a>
                )}
              </div>

              {/* ── 相片池 ── */}
              <div className="bg-white rounded-2xl p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
                  onChange={handleUploadChange}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                    <Images className="w-4 h-4 text-orange-500" />
                    相片池
                  </p>
                  <button
                    onClick={handleUploadClick}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? `上載中 ${uploadDone}/${uploadTotal}` : '上載圖片'}
                  </button>
                </div>

                {(() => {
                  const poolImages = ((galleryImagesQ.data ?? []) as GalleryImageRow[]).filter(img => img.itemId === null);
                  if (poolImages.length === 0) {
                    return <p className="text-xs text-gray-400 text-center py-4">上載圖片後會顯示於此，再指定給各商品</p>;
                  }
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400">{poolImages.length} 張待指定</p>
                        {poolImages.length > 0 && (
                          <button
                            onClick={() => { setPoolBatchMode(v => !v); setPoolSelectedIds(new Set()); }}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: poolBatchMode ? 'rgba(255,120,0,0.12)' : '#F0F0F0', color: poolBatchMode ? '#FF6B00' : '#555' }}
                          >
                            {poolBatchMode ? `批選（${poolSelectedIds.size}）` : '批量選擇'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {poolImages.map(img => {
                          const isSelected = poolSelectedIds.has(img.id);
                          return (
                            <div
                              key={img.id}
                              className="relative rounded-lg overflow-hidden bg-gray-100"
                              style={{ aspectRatio: '1/1', outline: isSelected ? '2px solid #FF6B00' : 'none' }}
                              onClick={poolBatchMode ? () => {
                                setPoolSelectedIds(prev => {
                                  const next = new Set(prev);
                                  next.has(img.id) ? next.delete(img.id) : next.add(img.id);
                                  return next;
                                });
                              } : undefined}
                            >
                              <img
                                src={img.imageUrl} alt="" className="w-full h-full object-cover"
                                style={{ cursor: poolBatchMode ? 'pointer' : 'zoom-in' }}
                                onClick={!poolBatchMode ? () => openLightbox(img.imageUrl) : undefined}
                              />
                              {poolBatchMode ? (
                                <div className="absolute top-0.5 left-0.5 pointer-events-none">
                                  <div className="w-4 h-4 rounded flex items-center justify-center"
                                    style={{ background: isSelected ? '#FF6B00' : 'rgba(255,255,255,0.85)', border: '1.5px solid #ccc' }}>
                                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                </div>
                              ) : (
                                <div className="absolute inset-0 flex flex-col pointer-events-none">
                                  <div className="flex justify-end p-0.5 pointer-events-auto">
                                    <button onClick={() => deletePoolImageM.mutate({ imageId: img.id })} className="w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                                      <X className="w-2.5 h-2.5 text-white" />
                                    </button>
                                  </div>
                                  <div className="mt-auto p-0.5 pointer-events-auto">
                                    <button
                                      onClick={() => setAssignPickerImageId(img.id)}
                                      disabled={draftItems.length === 0}
                                      className="w-full text-[9px] font-bold text-white rounded py-0.5 disabled:opacity-50"
                                      style={{ background: 'rgba(255,120,0,0.85)' }}
                                    >
                                      指定商品
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {poolBatchMode && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setPoolSelectedIds(poolSelectedIds.size === poolImages.length ? new Set() : new Set(poolImages.map(i => i.id)))}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold"
                            style={{ background: '#F0F0F0', color: '#555' }}
                          >
                            {poolSelectedIds.size === poolImages.length ? '取消全選' : '全選'}
                          </button>
                          <button
                            disabled={poolSelectedIds.size === 0 || draftItems.length === 0}
                            onClick={() => {
                              if (poolSelectedIds.size === 0 || draftItems.length === 0) return;
                              setPoolAssignItemId(draftItems[0].id);
                            }}
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg,#FF8C00,#FF6B00)' }}
                          >
                            指定到商品
                          </button>
                          <button onClick={() => { setPoolBatchMode(false); setPoolSelectedIds(new Set()); }} className="px-3 py-2 rounded-xl text-xs font-semibold" style={{ background: '#F0F0F0', color: '#555' }}>
                            取消
                          </button>
                        </div>
                      )}
                      {poolAssignItemId !== null && (
                        <div className="mt-3 p-3 rounded-xl bg-orange-50 border border-orange-200">
                          <p className="text-xs font-semibold text-orange-700 mb-2">選擇商品（指定 {poolSelectedIds.size} 張）</p>
                          <div className="space-y-1.5">
                            {draftItems.map(item => (
                              <button
                                key={item.id}
                                onClick={async () => {
                                  for (const imgId of Array.from(poolSelectedIds)) {
                                    await assignImageM.mutateAsync({ imageId: imgId, itemId: item.id });
                                  }
                                  setPoolAssignItemId(null);
                                }}
                                className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-left hover:bg-orange-100"
                              >
                                <p className="text-xs font-medium text-gray-900 truncate flex-1">{item.itemName || '(未命名)'}</p>
                                {item.itemNumber && <p className="text-[10px] text-gray-400">#{item.itemNumber}</p>}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setPoolAssignItemId(null)} className="mt-2 text-xs text-gray-400">取消</button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* ── 圖片商品 ── */}
              <div className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700">圖片商品 {draftItems.length > 0 ? `(${draftItems.length})` : ''}</p>
                  <div className="flex items-center gap-2">
                    {draftItems.length > 0 && (
                      <button
                        onClick={handleBatchSave}
                        disabled={batchUpdateM.isPending}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: '#22C55E' }}
                      >
                        <Save className="w-3 h-3" />
                        {batchUpdateM.isPending ? '儲存…' : '儲存所有'}
                      </button>
                    )}
                    <button
                      onClick={() => editGalleryId && createEmptyItemM.mutate({ galleryId: editGalleryId })}
                      disabled={createEmptyItemM.isPending}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                      style={{ background: '#F0F0F0', color: '#555' }}
                    >
                      <Plus className="w-3 h-3" />
                      新增
                    </button>
                  </div>
                </div>

                {/* Batch tools */}
                {draftItems.length > 0 && (
                  <div className="mb-3">
                    <button
                      onClick={() => setShowBatchPanel(v => !v)}
                      className="flex items-center justify-between w-full text-xs font-semibold text-gray-500 px-3 py-2 rounded-xl"
                      style={{ background: '#F8F8F8' }}
                    >
                      <span>批量設定</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBatchPanel ? 'rotate-180' : ''}`} />
                    </button>
                    {showBatchPanel && (
                      <div className="mt-2 space-y-3 px-1">
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">批量命名（前綴＋流水號）</p>
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
                              placeholder="起#"
                              inputMode="numeric"
                              className="w-12 px-2 py-1.5 text-sm outline-none text-center"
                              style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '10px' }}
                            />
                            <button onClick={applyBatchName} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}>套用</button>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-gray-400 mb-1.5">批量統一價錢</p>
                          <div className="flex gap-2">
                            <input
                              value={batchPrice}
                              onChange={e => setBatchPrice(e.target.value)}
                              placeholder="HKD$ 價格"
                              inputMode="decimal"
                              className="flex-1 px-2.5 py-1.5 text-sm outline-none"
                              style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '10px' }}
                            />
                            <button onClick={applyBatchPrice} className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}>套用</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Batch select mode */}
                {draftItems.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => { setBatchSelectMode(v => !v); setBatchSelectedIds(new Set()); }}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{ background: batchSelectMode ? 'rgba(255,120,0,0.12)' : '#F0F0F0', color: batchSelectMode ? '#FF6B00' : '#555' }}
                    >
                      {batchSelectMode ? `批選（${batchSelectedIds.size}）` : '批量選擇'}
                    </button>
                    {batchSelectMode && batchSelectedIds.size > 0 && (
                      <button
                        onClick={() => { setCopyTargetIds(new Set()); setCopyPickerOpen(true); }}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white"
                        style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                      >
                        複製到圖片集
                      </button>
                    )}
                    {batchSelectMode && (
                      <button
                        onClick={() => setBatchSelectedIds(batchSelectedIds.size === draftItems.length ? new Set() : new Set(draftItems.map(i => i.id)))}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: '#F0F0F0', color: '#555' }}
                      >
                        {batchSelectedIds.size === draftItems.length ? '取消全選' : '全選'}
                      </button>
                    )}
                  </div>
                )}

                {draftItems.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">尚未有圖片商品，點「新增」或從相片池指定圖片</p>
                ) : (
                  <div className="space-y-3">
                    {draftItems.map(item => {
                      const isSelected = batchSelectedIds.has(item.id);
                      const itemImages = ((galleryImagesQ.data ?? []) as GalleryImageRow[])
                        .filter(img => img.itemId === item.id)
                        .map(img => img.imageUrl);
                      const displaySrc = itemImages[0] ?? item.imageUrl;

                      return (
                        <div
                          key={item.id}
                          id={`ug-item-${item.id}`}
                          className="rounded-xl border p-3"
                          style={{ borderColor: isSelected ? '#FF8C00' : '#E8E8E8', background: isSelected ? '#FFF7ED' : '#FAFAFA' }}
                          onClick={batchSelectMode ? () => {
                            setBatchSelectedIds(prev => {
                              const next = new Set(prev);
                              next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                              return next;
                            });
                          } : undefined}
                        >
                          <div className="flex gap-3">
                            {/* Image thumbnail */}
                            <div
                              className="flex-shrink-0 rounded-xl overflow-hidden bg-gray-100"
                              style={{ width: 72, height: 72, cursor: displaySrc ? 'zoom-in' : 'default' }}
                              onClick={!batchSelectMode && displaySrc ? (e) => { e.stopPropagation(); openLightbox(displaySrc, itemImages, item.id); } : undefined}
                            >
                              {displaySrc ? (
                                <img src={displaySrc} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Images className="w-6 h-6 text-gray-300" />
                                </div>
                              )}
                            </div>

                            {/* Fields */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <input
                                value={item.itemName}
                                onChange={e => updateDraftItem(item.id, { itemName: e.target.value })}
                                placeholder="商品名稱"
                                maxLength={200}
                                onClick={e => e.stopPropagation()}
                                className="w-full px-2.5 py-1.5 text-sm outline-none"
                                style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                              />
                              <div className="flex gap-1.5">
                                <input
                                  value={item.itemNumber ?? ''}
                                  onChange={e => updateDraftItem(item.id, { itemNumber: e.target.value })}
                                  placeholder="#編號"
                                  maxLength={100}
                                  onClick={e => e.stopPropagation()}
                                  className="w-20 px-2 py-1.5 text-xs outline-none"
                                  style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                                />
                                <input
                                  value={item.price}
                                  onChange={e => updateDraftItem(item.id, { price: e.target.value })}
                                  placeholder="HK$ 價錢"
                                  inputMode="decimal"
                                  onClick={e => e.stopPropagation()}
                                  className="flex-1 px-2 py-1.5 text-xs outline-none"
                                  style={{ background: '#fff', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                                />
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <select
                                  value={item.status}
                                  onChange={e => updateDraftItem(item.id, { status: e.target.value as any })}
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs px-2 py-1.5 outline-none rounded-lg border border-gray-200 bg-white"
                                  style={{ color: ITEM_STATUS_COLORS[item.status] ?? '#555' }}
                                >
                                  {Object.entries(ITEM_STATUS_LABELS).map(([v, l]) => (
                                    <option key={v} value={v}>{l}</option>
                                  ))}
                                </select>
                                <div className="flex-1" />
                                {!batchSelectMode && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: '#FEE2E2' }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── 刪除圖片集 ── */}
              <div className="bg-white rounded-2xl p-4">
                <p className="text-sm font-bold text-gray-700 mb-3">危險操作</p>
                <button
                  onClick={handleDeleteGallery}
                  disabled={deleteGalleryM.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:border-red-400 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  刪除整個圖片集
                </button>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}

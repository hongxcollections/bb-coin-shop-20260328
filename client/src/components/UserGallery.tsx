import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  ChevronLeft, ChevronDown, Plus, Loader2, Trash2, X, Upload, Save,
  Images, Check, ExternalLink, Download,
} from "lucide-react";
import { Link } from "wouter";
import { GalleryShareMenu } from "@/components/ShareMenu";

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
type EditTab = 'info' | 'items' | 'publish';

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
  const [editTab, setEditTab] = useState<EditTab>('info');
  const [itemsScrollMode, setItemsScrollMode] = useState(true);

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

  // Poster modal
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [posterFromList, setPosterFromList] = useState(false);
  const [savingPoster, setSavingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  // Cover image picker
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverPickerSelectedIds, setCoverPickerSelectedIds] = useState<Set<number>>(new Set());
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string | null>(null);

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

  // Delete confirm (name input required)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

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
    { enabled: editGalleryId !== null && view === 'edit' && editTab === 'items', refetchOnWindowFocus: false }
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
  const generateCoverM = trpc.productGalleries.userGenerateGalleryCover.useMutation({
    onSuccess: (data) => { setGeneratedCoverUrl(data.coverImageUrl); getForEditQ.refetch(); toast.success('主題圖片已生成並儲存'); },
    onError: (e) => toast.error(e.message),
  });
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
          return serverItems.map(si => prevMap.get(si.id) ?? { ...si, price: normalizePrice(si.price) });
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

  function normalizePrice(raw: unknown): string {
    const n = Number(raw);
    if (!raw || n === 0) return '';
    return String(raw);
  }

  async function handleSavePoster() {
    setSavingPoster(true);
    try {
      const items = draftItems.filter(i => i.status !== 'hidden');
      const cols = editCols;
      const activeCount = items.filter(i => i.status === 'active').length;
      const soldCount   = items.filter(i => i.status === 'sold').length;
      const title       = currentGallery?.title ?? '';
      const merchantName = (currentGallery as any)?.merchantName ?? '';
      const description  = (currentGallery as any)?.description ?? '';

      const S = 2; let CW = 375;
      const M = 12; const hPX = 16; const hPT = 16; const hPB = 16; const hR = 16;
      const heroX = M; let heroW = CW - M * 2;

      const tmp = document.createElement('canvas');
      tmp.width = heroW * S; tmp.height = 4;
      const tc = tmp.getContext('2d')!;
      let descLines = 0;
      if (description) {
        tc.font = `${11 * S}px sans-serif`;
        const maxDescW = (heroW - hPX * 2) * S;
        let line = '';
        for (const ch of description) {
          const t = line + ch;
          if (tc.measureText(t).width > maxDescW && line) { descLines++; line = ch; } else line = t;
        }
        if (line) descLines++;
      }

      const nameLineH = 16; const titleLineH = 24; const descLineH = 18; const badgeRowH = 18;
      const heroContentH = nameLineH + 8 + titleLineH + 6 + (descLines > 0 ? descLines * descLineH + 10 : 0) + badgeRowH;
      const heroH = hPT + heroContentH + hPB;

      const gridPX = 12; const gridPB = 12;
      const gridGap = cols >= 8 ? 2 : 5;
      const BASE_CW = 375; const BASE_INNER = BASE_CW - M * 2 - gridPX * 2;
      const cellW = Math.floor((BASE_INNER - gridGap * (3 - 1)) / 3);
      const totalGridW = cols * cellW + (cols - 1) * gridGap + gridPX * 2;
      CW = Math.max(BASE_CW, M * 2 + totalGridW);
      heroW = CW - M * 2;
      const cardH = cellW;
      const rows = Math.ceil(items.length / cols);
      const gridH = rows * (cardH + gridGap) - gridGap + gridPB;
      const footerFontSz = 5; const footerPY = 10; const footerH = footerPY * 2 + footerFontSz;
      const totalH = M + heroH + M + gridH + footerH;

      const canvas = document.createElement('canvas');
      canvas.width = CW * S; canvas.height = totalH * S;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(S, S);

      const rrect = (x: number, y: number, w: number, h: number, r: number) => {
        const rv = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rv, y); ctx.lineTo(x + w - rv, y);
        ctx.arcTo(x + w, y, x + w, y + rv, rv);
        ctx.lineTo(x + w, y + h - rv);
        ctx.arcTo(x + w, y + h, x + w - rv, y + h, rv);
        ctx.lineTo(x + rv, y + h);
        ctx.arcTo(x, y + h, x, y + h - rv, rv);
        ctx.lineTo(x, y + rv);
        ctx.arcTo(x, y, x + rv, y, rv);
        ctx.closePath();
      };

      ctx.fillStyle = '#ECECEC'; ctx.fillRect(0, 0, CW, totalH);

      const heroY = M;
      ctx.save();
      rrect(heroX, heroY, heroW, heroH, hR); ctx.clip();
      const hGrad = ctx.createLinearGradient(heroX, heroY, heroX + heroW * 0.6, heroY + heroH * 0.85);
      hGrad.addColorStop(0, '#0D1B2A'); hGrad.addColorStop(0.4, '#1B263B'); hGrad.addColorStop(1, '#1F3A5F');
      ctx.fillStyle = hGrad; ctx.fillRect(heroX, heroY, heroW, heroH);
      ctx.fillStyle = 'rgba(255,179,71,0.1)';
      ctx.beginPath(); ctx.arc(heroX + heroW - 32, heroY + 32, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(74,144,217,0.1)';
      ctx.beginPath(); ctx.arc(heroX + 32, heroY + heroH - 16, 48, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      const cX = heroX + hPX; const cMaxW = heroW - hPX * 2;
      let cY = heroY + hPT;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#FFB347'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(merchantName, cX, cY); cY += nameLineH + 8;
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 17px sans-serif';
      ctx.fillText(title, cX, cY); cY += titleLineH + 6;
      if (description) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '11px sans-serif';
        let line = '';
        for (const ch of description) {
          const t = line + ch;
          if (ctx.measureText(t).width > cMaxW && line) { ctx.fillText(line, cX, cY); cY += descLineH; line = ch; } else line = t;
        }
        if (line) { ctx.fillText(line, cX, cY); cY += descLineH; }
        cY += 10;
      }
      let bX = cX;
      const bPX = 10; const bPY = 4; const bFSz = 10;
      const bH2 = bFSz + bPY * 2; const bR2 = bH2 / 2;
      ctx.font = `bold ${bFSz}px sans-serif`; ctx.textBaseline = 'middle';
      if (activeCount > 0) {
        const tW = ctx.measureText(`${activeCount} 件展示`).width;
        const bW = bPX * 2 + 10 + tW;
        ctx.fillStyle = 'rgba(34,197,94,0.2)'; rrect(bX, cY, bW, bH2, bR2); ctx.fill();
        ctx.strokeStyle = 'rgba(34,197,94,0.25)'; ctx.lineWidth = 1; rrect(bX, cY, bW, bH2, bR2); ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath(); ctx.arc(bX + bPX + 3, cY + bH2 / 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(`${activeCount} 件展示`, bX + bPX + 10, cY + bH2 / 2); bX += bW + 8;
      }
      if (soldCount > 0) {
        const tW = ctx.measureText(`${soldCount} 件已售`).width;
        const bW = bPX * 2 + tW;
        ctx.fillStyle = 'rgba(239,68,68,0.18)'; rrect(bX, cY, bW, bH2, bR2); ctx.fill();
        ctx.strokeStyle = 'rgba(239,68,68,0.2)'; ctx.lineWidth = 1; rrect(bX, cY, bW, bH2, bR2); ctx.stroke();
        ctx.fillStyle = '#FCA5A5'; ctx.fillText(`${soldCount} 件已售`, bX + bPX, cY + bH2 / 2);
      }

      const loadedImgs = await Promise.all(items.map(async (item) => {
        try {
          const resp = await fetch(item.imageUrl);
          const blob = await resp.blob();
          const burl = URL.createObjectURL(blob);
          return await new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(burl); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(burl); resolve(null); };
            img.src = burl;
          });
        } catch { return null; }
      }));

      const gridTop = M + heroH + M; const gridLeft = heroX + gridPX;
      const cardR = 10; const rs = 46;
      const numFSz = 8; const nameFSz = 10; const priceFSz = 10;

      items.forEach((item, idx) => {
        const col = idx % cols; const row = Math.floor(idx / cols);
        const cx = gridLeft + col * (cellW + gridGap);
        const cy = gridTop + row * (cardH + gridGap);
        const isSold = item.status === 'sold';
        const price = parseFloat(item.price);
        const img = loadedImgs[idx];

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#fff'; rrect(cx, cy, cellW, cardH, cardR); ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        const rv2 = Math.min(cardR, cellW / 2);
        ctx.moveTo(cx + rv2, cy); ctx.lineTo(cx + cellW - rv2, cy);
        ctx.arcTo(cx + cellW, cy, cx + cellW, cy + rv2, rv2);
        ctx.lineTo(cx + cellW, cy + cellW); ctx.lineTo(cx, cy + cellW);
        ctx.lineTo(cx, cy + rv2); ctx.arcTo(cx, cy, cx + rv2, cy, rv2);
        ctx.closePath(); ctx.clip();

        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          try {
            if (isSold) ctx.filter = 'grayscale(50%) brightness(0.88)';
            const nw = img.naturalWidth, nh = img.naturalHeight;
            let sx = 0, sy = 0, sw = nw, sh = nh;
            if (nw / nh > 1) { sw = nh; sx = (nw - sw) / 2; } else { sh = nw; sy = (nh - sh) / 2; }
            ctx.drawImage(img, sx, sy, sw, sh, cx, cy, cellW, cellW);
            ctx.filter = 'none';
          } catch { ctx.filter = 'none'; ctx.fillStyle = '#f3f4f6'; ctx.fillRect(cx, cy, cellW, cellW); }
        } else {
          ctx.fillStyle = '#f3f4f6'; ctx.fillRect(cx, cy, cellW, cellW);
        }

        if (item.itemNumber || item.itemName || price > 0) {
          const ovH = Math.round(cellW * 0.55);
          const ovG = ctx.createLinearGradient(0, cy + cellW - ovH, 0, cy + cellW);
          ovG.addColorStop(0, 'transparent'); ovG.addColorStop(0.4, 'rgba(0,0,0,0.25)'); ovG.addColorStop(1, 'rgba(0,0,0,0.68)');
          ctx.fillStyle = ovG; ctx.fillRect(cx, cy + cellW - ovH, cellW, ovH);
          let ty = cy + cellW - 5;
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          if (price > 0) {
            ctx.fillStyle = '#FFD580'; ctx.font = `bold ${priceFSz}px sans-serif`;
            ctx.fillText(`HK$${price.toLocaleString('en-HK')}`, cx + 6, ty); ty -= priceFSz + 2;
          }
          if (item.itemName) {
            ctx.fillStyle = '#fff'; ctx.font = `600 ${nameFSz}px sans-serif`;
            let nm = item.itemName;
            while (nm.length > 1 && ctx.measureText(nm).width > cellW - 12) nm = nm.slice(0, -1);
            if (nm !== item.itemName) nm += '…';
            ctx.fillText(nm, cx + 6, ty); ty -= nameFSz + 2;
          }
          if (item.itemNumber) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `${numFSz}px monospace`;
            ctx.fillText(`#${item.itemNumber}`, cx + 6, ty);
          }
        }

        if (isSold) {
          ctx.beginPath();
          ctx.moveTo(cx + cellW - rs, cy); ctx.lineTo(cx + cellW, cy); ctx.lineTo(cx + cellW, cy + rs);
          ctx.closePath(); ctx.fillStyle = '#DC2626'; ctx.fill();
          ctx.save();
          ctx.translate(cx + cellW - rs * 0.38, cy + rs * 0.38);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fff'; ctx.font = 'bold 7px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('已售', 0, 0);
          ctx.restore();
        }
        ctx.restore();

      });

      const footerY = M + heroH + M + gridH;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#999999'; ctx.font = `${footerFontSz}px sans-serif`;
      ctx.fillText('- hongxcollections -', CW / 2, footerY + footerPY + footerFontSz / 2);

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `gallery-${editGalleryId}.png`;
      a.href = dataUrl; a.click();
      toast.success('圖片已儲存');
      setSavingPoster(false);
    } catch (err) {
      console.error('[poster] error:', err);
      toast.error('生成圖片失敗，請重試');
      setSavingPoster(false);
    }
  }

  // Sync items on load
  useEffect(() => {
    const d = getForEditQ.data;
    if (!d || didSyncRef.current) return;
    setEditTitle(d.gallery.title);
    setEditDesc((d.gallery as any).description ?? '');
    setEditCols((d.gallery as any).columnsPerRow ?? 3);
    setDraftItems((d.items as GalleryItem[]).map(i => ({ ...i, price: normalizePrice(i.price) })));
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
    setGeneratedCoverUrl(null);
    setView('edit');
    setEditTab('info');
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
      confirmText: '下一步',
      cancelText: '取消',
    });
    if (!ok) return;
    setDeleteConfirmName('');
    setDeleteConfirmOpen(true);
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
        <div className="w-full bg-white rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">選擇指定商品</p>
            <button onClick={() => setAssignPickerImageId(null)} className="p-1 rounded-full hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
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
                      onClick={() => { setPosterFromList(true); openEdit(g.id); setShowPosterModal(true); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white flex-shrink-0"
                      style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}
                    >
                      <Images className="w-3 h-3" />
                      生成
                    </button>
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

      {/* ── EDIT VIEW (tabbed) ── */}
      {view === 'edit' && editGalleryId !== null && (
        <div>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
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

          {/* Tab bar */}
          <div className="flex px-4 pb-1 gap-1 overflow-x-auto">
            {([
              ['info', '基本設定'],
              ['items', '圖片商品'],
              ['publish', '發佈'],
            ] as [EditTab, string][]).map(([tab, label]) => {
              const itemBadge = tab === 'items' && draftItems.length > 0 ? draftItems.length : null;
              return (
                <button
                  key={tab}
                  onClick={() => setEditTab(tab)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    editTab === tab ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 bg-white'
                  }`}
                >
                  {label}
                  {itemBadge !== null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                      style={{ color: editTab === tab ? 'rgba(255,255,255,0.85)' : '#FF8C00', background: editTab === tab ? 'rgba(255,255,255,0.2)' : 'rgba(255,140,0,0.12)' }}>
                      {itemBadge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {getForEditQ.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : (
            <div className="px-4 pb-4 pt-2 space-y-4">

              {/* ── Tab: 基本設定 ── */}
              {editTab === 'info' && (
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
                      rows={3}
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
              )}

              {/* ── Tab: 圖片商品 ── */}
              {editTab === 'items' && (
                <>
                  {/* 相片池 */}
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
                            <button
                              onClick={() => { setPoolBatchMode(v => !v); setPoolSelectedIds(new Set()); }}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                              style={{ background: poolBatchMode ? 'rgba(255,120,0,0.12)' : '#F0F0F0', color: poolBatchMode ? '#FF6B00' : '#555' }}
                            >
                              {poolBatchMode ? `批選（${poolSelectedIds.size}）` : '批量選擇'}
                            </button>
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

                  {/* Cover image picker */}
                  {showCoverPicker && (
                    <div className="bg-white rounded-2xl p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700">選擇要合成的商品圖片（最多9件）</p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setCoverPickerSelectedIds(new Set(draftItems.filter(i => i.imageUrl).map(i => i.id)))}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: '#FFF3E0', color: '#E65C00' }}
                          >全選</button>
                          <button
                            onClick={() => setCoverPickerSelectedIds(new Set())}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                            style={{ background: '#F0F0F0', color: '#555' }}
                          >取消全選</button>
                        </div>
                      </div>
                      {draftItems.filter(i => i.imageUrl).length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-4">暫無商品圖片</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                          {draftItems.filter(i => i.imageUrl).map(item => {
                            const sel = coverPickerSelectedIds.has(item.id);
                            return (
                              <div
                                key={item.id}
                                className="relative rounded-xl overflow-hidden cursor-pointer"
                                style={{ aspectRatio: '1/1', outline: sel ? '2.5px solid #E65C00' : '2.5px solid transparent' }}
                                onClick={() => setCoverPickerSelectedIds(prev => {
                                  const next = new Set(prev);
                                  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                                  return next;
                                })}
                              >
                                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                <div
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ background: sel ? '#E65C00' : 'rgba(255,255,255,0.88)', border: sel ? 'none' : '1.5px solid #ccc' }}
                                >
                                  {sel && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                                </div>
                                {item.itemName && (
                                  <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5" style={{ background: 'rgba(0,0,0,0.52)' }}>
                                    <p className="text-[9px] text-white truncate">{item.itemName}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-xs text-gray-400">已選 {coverPickerSelectedIds.size} 件</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowCoverPicker(false)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                            style={{ background: '#F0F0F0', color: '#555' }}
                          >取消</button>
                          <button
                            onClick={() => {
                              if (!editGalleryId || coverPickerSelectedIds.size === 0) return;
                              setShowCoverPicker(false);
                              generateCoverM.mutate({ galleryId: editGalleryId, itemIds: [...coverPickerSelectedIds] });
                            }}
                            disabled={coverPickerSelectedIds.size === 0 || generateCoverM.isPending}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                            style={{ background: 'linear-gradient(135deg, #FF8C00, #E65C00)' }}
                          >
                            {generateCoverM.isPending ? '生成中…' : `確認生成（${coverPickerSelectedIds.size}件）`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cover image preview */}
                  {(generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl) && (
                    <div className="bg-white rounded-2xl p-3 mb-3">
                      <p className="text-xs font-semibold mb-2" style={{ color: '#9CA3AF' }}>目前主題圖片（點擊放大）</p>
                      <img
                        src={(generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl)!}
                        alt="圖片集主題圖片"
                        className="w-full rounded-xl object-cover"
                        style={{ maxHeight: 180, cursor: 'zoom-in' }}
                        onClick={() => openLightbox((generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl)!)}
                      />
                    </div>
                  )}

                  {/* 圖片商品 */}
                  <div className="bg-white rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-gray-700">圖片商品 {draftItems.length > 0 ? `(${draftItems.length})` : ''}</p>
                      <div className="flex items-center gap-1.5">
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
                        <button
                          onClick={() => {
                            const withImg = draftItems.filter(i => i.imageUrl);
                            setCoverPickerSelectedIds(new Set(withImg.map(i => i.id)));
                            setShowCoverPicker(v => !v);
                          }}
                          disabled={generateCoverM.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                          style={{ background: showCoverPicker ? '#E65C00' : '#FFF3E0', color: showCoverPicker ? '#fff' : '#E65C00' }}
                        >
                          <Images className="w-3 h-3" />
                          {generateCoverM.isPending ? '生成中…' : showCoverPicker ? '收起' : '封面'}
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

                    {/* Batch select + layout toggle */}
                    {draftItems.length > 0 && (
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <button
                          onClick={() => { setBatchSelectMode(v => !v); setBatchSelectedIds(new Set()); }}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={batchSelectMode
                            ? { background: 'linear-gradient(135deg,#FF8C00,#FF6B00)', color: '#fff' }
                            : { background: '#F0F0F0', color: '#555' }}
                        >
                          {batchSelectMode ? `批量選擇 (${batchSelectedIds.size})` : '批量選擇'}
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
                        <button
                          onClick={() => setItemsScrollMode(v => !v)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg ml-auto"
                          style={{ background: '#F0F0F0', color: '#555' }}
                        >
                          {itemsScrollMode ? '換回多行顯示' : '換為橫向捲動'}
                        </button>
                      </div>
                    )}

                    {draftItems.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">尚未有圖片商品，點「新增」或從相片池指定圖片</p>
                    ) : (
                      <div
                        className={itemsScrollMode ? 'flex gap-2 overflow-x-auto pb-2' : 'grid grid-cols-2 gap-2'}
                        style={{ scrollbarWidth: 'none' }}
                      >
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
                              className="bg-white rounded-xl overflow-hidden border border-gray-100 relative"
                              style={itemsScrollMode ? { flexShrink: 0, width: 'calc(50vw - 20px)' } : undefined}
                              onClick={batchSelectMode ? () => {
                                setBatchSelectedIds(prev => {
                                  const next = new Set(prev);
                                  next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                                  return next;
                                });
                              } : undefined}
                            >
                              {batchSelectMode && (
                                <div
                                  className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                  style={{
                                    background: isSelected ? '#FF8C00' : 'rgba(255,255,255,0.85)',
                                    borderColor: isSelected ? '#FF8C00' : '#ccc',
                                  }}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                              )}
                              {/* Image */}
                              <div
                                className="relative bg-gray-50 w-full aspect-square overflow-hidden"
                                style={{ cursor: displaySrc ? 'zoom-in' : 'default' }}
                                onClick={!batchSelectMode && displaySrc ? () => openLightbox(displaySrc, itemImages, item.id) : undefined}
                              >
                                {displaySrc ? (
                                  <img src={displaySrc} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Images className="w-8 h-8 text-gray-200" />
                                  </div>
                                )}
                                {!batchSelectMode && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteItem(item.id); }}
                                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                                  >
                                    <X className="w-3 h-3 text-white" />
                                  </button>
                                )}
                              </div>
                              {/* Fields */}
                              <div className="p-2 space-y-1.5">
                                <input
                                  value={item.itemName}
                                  onChange={e => updateDraftItem(item.id, { itemName: e.target.value })}
                                  placeholder="商品名稱"
                                  maxLength={200}
                                  onClick={e => e.stopPropagation()}
                                  className="w-full px-2 py-1.5 text-xs outline-none"
                                  style={{ background: '#F8F8F8', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                                />
                                <div className="flex gap-1">
                                  <input
                                    value={item.itemNumber ?? ''}
                                    onChange={e => updateDraftItem(item.id, { itemNumber: e.target.value })}
                                    placeholder="#編號"
                                    maxLength={100}
                                    onClick={e => e.stopPropagation()}
                                    className="w-16 px-2 py-1.5 text-xs outline-none"
                                    style={{ background: '#F8F8F8', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                                  />
                                  <input
                                    value={item.price}
                                    onChange={e => updateDraftItem(item.id, { price: e.target.value })}
                                    placeholder="HK$"
                                    inputMode="decimal"
                                    onClick={e => e.stopPropagation()}
                                    className="flex-1 px-2 py-1.5 text-xs outline-none"
                                    style={{ background: '#F8F8F8', border: '1px solid #E5E5E5', borderRadius: '8px' }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── Tab: 發佈 ── */}
              {editTab === 'publish' && (
                <div className="space-y-3">
                  {/* Card 1: 主題封面圖片 */}
                  <div className="bg-white rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">主題封面圖片</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">顯示於圖片集列表及分享預覽</p>
                      </div>
                      <button
                        onClick={() => { setEditTab('items'); setShowCoverPicker(false); setTimeout(() => { const withImg = draftItems.filter(i => i.imageUrl); setCoverPickerSelectedIds(new Set(withImg.map(i => i.id))); setShowCoverPicker(true); }, 50); }}
                        className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg flex-shrink-0"
                        style={{ background: '#FFF3E0', color: '#E65C00' }}
                      >
                        <Images className="w-3 h-3" />
                        {(generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl) ? '重新生成' : '生成封面'}
                      </button>
                    </div>
                    {(generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl) ? (
                      <img
                        src={(generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl)!}
                        alt="主題圖片"
                        className="w-full object-cover"
                        style={{ maxHeight: 220, cursor: 'zoom-in' }}
                        onClick={() => openLightbox((generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl)!)}
                      />
                    ) : (
                      <div className="mx-4 mb-3 rounded-xl flex flex-col items-center justify-center py-8 gap-2"
                        style={{ background: '#F8F8F8', border: '1.5px dashed #E0E0E0' }}>
                        <Images className="w-8 h-8 text-gray-300" />
                        <p className="text-xs text-gray-400 text-center leading-relaxed">尚未生成封面圖片<br/>點擊右上角「生成封面」</p>
                      </div>
                    )}
                    {(generatedCoverUrl ?? getForEditQ.data?.gallery?.coverImageUrl) && (
                      <p className="text-[10px] text-gray-400 text-center py-1.5">點擊圖片放大查看</p>
                    )}
                  </div>

                  {/* Card 2: 發佈狀態 + 公開連結（合併） */}
                  <div className="bg-white rounded-2xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">發佈狀態</p>
                      <div className="flex gap-2">
                        {([
                          ['draft',  '草稿', '未公開'],
                          ['active', '已發佈', '公開中'],
                          ['hidden', '已下架', '暫停中'],
                        ] as [string, string, string][]).map(([s, label, sub]) => (
                          <button
                            key={s}
                            onClick={() => handleSetStatus(s as 'draft' | 'active' | 'hidden')}
                            disabled={updateInfoM.isPending}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 flex flex-col items-center gap-0.5 ${
                              currentGallery?.status === s
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            <span>{label}</span>
                            <span className={`text-[9px] font-normal ${currentGallery?.status === s ? 'text-orange-100' : 'text-gray-400'}`}>{sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {currentGallery?.status === 'active' && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">公開連結</p>
                        <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-xl" style={{ background: '#F5F5F5' }}>
                          <p className="text-xs text-blue-600 break-all flex-1 leading-relaxed">
                            {window.location.origin}/gallery/{editGalleryId}
                          </p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/gallery/${editGalleryId}`);
                              toast.success('已複製連結');
                            }}
                            className="text-xs text-gray-500 px-2.5 py-1.5 rounded-lg bg-white flex-shrink-0 border border-gray-200"
                          >
                            複製
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            href={`/gallery/${editGalleryId}`}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold text-center text-white flex items-center justify-center gap-1"
                            style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            前往圖片集頁面
                          </Link>
                          <div className="flex-1">
                            <GalleryShareMenu
                              galleryId={editGalleryId!}
                              title={currentGallery?.title ?? ''}
                              description={(currentGallery as any)?.description ?? null}
                              merchantName={(currentGallery as any)?.merchantName ?? null}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 3: 分享工具 */}
                  <div className="bg-white rounded-2xl p-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">分享工具</p>
                    <button
                      onClick={() => { setPosterFromList(false); setShowPosterModal(true); }}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                      style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}
                    >
                      <Images className="w-4 h-4" />
                      生成分享圖片集海報
                    </button>
                  </div>

                  {/* Card 4: 危險操作 */}
                  <div className="bg-white rounded-2xl p-4">
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

            </div>
          )}
        </div>
      )}

      {/* Delete name confirm modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[250] bg-black/70 flex items-end" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="bg-white w-full rounded-t-2xl p-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-red-600 text-sm">最終確認</h3>
              <button onClick={() => setDeleteConfirmOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              請輸入圖片集名稱「<span className="font-bold text-gray-800">{editTitle}</span>」以確認刪除
            </p>
            <input
              value={deleteConfirmName}
              onChange={e => setDeleteConfirmName(e.target.value)}
              placeholder="輸入圖片集名稱"
              className="w-full px-3 py-2 text-sm outline-none mb-3"
              style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: '12px' }}
              autoFocus
            />
            <button
              onClick={() => {
                if (deleteConfirmName.trim() !== editTitle.trim()) { toast.error('名稱不符，請重新輸入'); return; }
                setDeleteConfirmOpen(false);
                deleteGalleryM.mutate({ id: editGalleryId! });
              }}
              disabled={deleteConfirmName.trim() !== editTitle.trim() || deleteGalleryM.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 disabled:opacity-40"
            >
              確認永久刪除
            </button>
          </div>
        </div>
      )}

      {/* Gallery Poster Modal */}
      {showPosterModal && (() => {
        const posterCoverUrl = generatedCoverUrl ?? (currentGallery as any)?.coverImageUrl ?? null;
        const posterItems = draftItems.filter(i => i.status !== 'hidden' && i.imageUrl);
        const posterCols = editCols;
        const activeCount = draftItems.filter(i => i.status === 'active').length;
        const soldCount = draftItems.filter(i => i.status === 'sold').length;
        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex flex-col" style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 3, paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#ECECEC', borderRadius: 16 }}>
              <div className="flex-1 min-h-0 overflow-y-auto pb-4">
                <div ref={posterRef}>
                  {/* ── Hero Banner ── */}
                  <div className="mx-3 mt-3 mb-3 rounded-2xl overflow-hidden shadow-lg">
                    {posterCoverUrl ? (
                      <>
                        <div className="relative" style={{ minHeight: 160 }}>
                          <img
                            src={posterCoverUrl}
                            alt={currentGallery?.title ?? ''}
                            className="w-full object-cover"
                            style={{ maxHeight: 240, display: 'block' }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none"
                            style={{ background: 'linear-gradient(to bottom, transparent, rgba(8,12,22,0.72))' }} />
                        </div>
                        <div className="px-4 pt-2.5 pb-3" style={{ background: 'linear-gradient(145deg, #0D1B2A 0%, #1B263B 100%)' }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[11px] font-semibold" style={{ color: '#FFB347' }}>{(currentGallery as any)?.merchantName}</span>
                          </div>
                          <h1 className="text-[17px] font-bold leading-snug mb-1.5" style={{ color: '#FFFFFF' }}>{currentGallery?.title}</h1>
                          {(currentGallery as any)?.description && (
                            <p className="text-[11px] leading-relaxed mb-2 whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.55)' }}>{(currentGallery as any).description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {activeCount > 0 && (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.25)' }}>
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ADE80' }} />
                                {activeCount} 件展示
                              </span>
                            )}
                            {soldCount > 0 && (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {soldCount} 件已售
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ background: 'linear-gradient(145deg, #0D1B2A 0%, #1B263B 40%, #1F3A5F 100%)' }}>
                        <div className="relative px-4 pt-4 pb-4 overflow-hidden">
                          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10" style={{ background: '#FFB347' }} />
                          <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full opacity-10" style={{ background: '#4A90D9' }} />
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[11px] font-semibold" style={{ color: '#FFB347' }}>{(currentGallery as any)?.merchantName}</span>
                          </div>
                          <h1 className="text-[17px] font-bold leading-snug mb-1.5 relative z-10" style={{ color: '#FFFFFF' }}>{currentGallery?.title}</h1>
                          {(currentGallery as any)?.description && (
                            <p className="text-[11px] leading-relaxed mb-2.5 relative z-10 whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.55)' }}>{(currentGallery as any).description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap relative z-10">
                            {activeCount > 0 && (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(34,197,94,0.2)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.25)' }}>
                                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ADE80' }} />
                                {activeCount} 件展示
                              </span>
                            )}
                            {soldCount > 0 && (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
                                {soldCount} 件已售
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {posterItems.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">未有商品可顯示（需先上載商品圖片）</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${posterCols}, calc((100vw - 24px) / 3))`, gap: `${posterCols >= 8 ? 2 : 5}px`, paddingLeft: 12, paddingRight: 12, paddingBottom: 12, width: 'max-content', minWidth: '100%', boxSizing: 'border-box' }}>
                        {posterItems.map(item => {
                          const price = parseFloat(item.price);
                          const isSold = item.status === 'sold';
                          const ribbonSize = 46;
                          return (
                            <div key={item.id} className="overflow-hidden" style={{ borderRadius: '10px', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.10)' }}>
                              <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
                                <img src={item.imageUrl} alt={item.itemName || '商品'} className="w-full h-full object-cover" style={{ filter: isSold ? 'grayscale(50%) brightness(0.88)' : 'none' }} />
                                {(item.itemNumber || item.itemName || price > 0) && (
                                  <div className="absolute bottom-0 left-0 right-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)', padding: '18px 6px 5px 6px' }}>
                                    {item.itemNumber && <p className="font-mono leading-none mb-0.5" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)' }}>#{item.itemNumber}</p>}
                                    {item.itemName && <p className="font-semibold text-white leading-tight truncate" style={{ fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{item.itemName}</p>}
                                    {price > 0 && <p className="font-bold leading-none mt-0.5" style={{ fontSize: '10px', color: '#FFD580' }}>HK${price.toLocaleString('en-HK')}</p>}
                                  </div>
                                )}
                                {isSold && (
                                  <>
                                    <div className="absolute" style={{ top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: `0 ${ribbonSize}px ${ribbonSize}px 0`, borderColor: `transparent #DC2626 transparent transparent` }} />
                                    <div className="absolute font-bold text-white" style={{ top: '5px', right: '2px', fontSize: '7px', transform: 'rotate(45deg)' }}>已售</div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="py-2 text-center" style={{ background: '#ECECEC', fontSize: '11px', color: '#999' }}>- hongxcollections -</div>

              <div className="flex gap-3 px-4 pt-3 bg-white border-t border-gray-100" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                <button onClick={() => { setShowPosterModal(false); if (posterFromList) goList(); }} className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">取消</button>
                <button onClick={handleSavePoster} disabled={savingPoster} className="flex-1 py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}>
                  {savingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {savingPoster ? '生成中…' : '儲存圖片'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

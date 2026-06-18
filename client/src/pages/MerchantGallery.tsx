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
  EyeOff, Images, FileImage, Check, Download, ExternalLink,
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

interface GalleryImageRow {
  id: number; galleryId: number; merchantId: number; itemId: number | null;
  imageUrl: string; s3Key: string | null; sortOrder: number;
}

type View = 'list' | 'create' | 'edit';
type EditTab = 'info' | 'items' | 'orders' | 'publish';

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
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxImgIdx, setLightboxImgIdx] = useState(0);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPanX, setLbPanX] = useState(0);
  const [lbPanY, setLbPanY] = useState(0);
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

  // Gallery poster modal
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [savingPoster, setSavingPoster] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  // Pool assign picker
  const [assignPickerImageId, setAssignPickerImageId] = useState<number | null>(null);
  const [carouselIdx, setCarouselIdx] = useState<Record<number, number>>({});
  const carouselTouchX = useRef<Record<number, number>>({});

  // Delete gallery with name confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Items layout: false = grid (2 cols wrap), true = horizontal scroll
  const [itemsScrollMode, setItemsScrollMode] = useState(true);
  const scrollToItemIdRef = useRef<number | null>(null);

  // Batch convert mode
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<number>>(new Set());

  // Auction import picker
  const [auctionPickerOpen, setAuctionPickerOpen] = useState(false);
  const [selectedAuctionIds, setSelectedAuctionIds] = useState<Set<number>>(new Set());

  // Product import picker
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

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
  const ordersQ = trpc.productGalleries.listOrdersForGallery.useQuery(
    { galleryId: editGalleryId! },
    { enabled: editGalleryId !== null && editTab === 'orders', refetchOnWindowFocus: false }
  );
  const confirmOrderM = trpc.productGalleries.confirmOrder.useMutation({
    onSuccess: () => { ordersQ.refetch(); toast.success('已確認成交，傭金已扣除'); },
    onError: (e) => toast.error(e.message),
  });
  const cancelOrderM = trpc.productGalleries.cancelOrder.useMutation({
    onSuccess: () => { ordersQ.refetch(); getForEditQ.refetch(); toast.success('訂單已取消，商品恢復上架'); },
    onError: (e) => toast.error(e.message),
  });

  const galleryImagesQ = trpc.productGalleries.getGalleryImages.useQuery(
    { galleryId: editGalleryId! },
    { enabled: editGalleryId !== null && editTab === 'items', refetchOnWindowFocus: false }
  );
  const addToPoolM = trpc.productGalleries.addToPool.useMutation();
  const assignImageM = trpc.productGalleries.assignImage.useMutation({
    onSuccess: () => { galleryImagesQ.refetch(); getForEditQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const unassignImageM = trpc.productGalleries.unassignImage.useMutation({
    onSuccess: () => { galleryImagesQ.refetch(); getForEditQ.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteGalleryImageM = trpc.productGalleries.deleteGalleryImage.useMutation({
    onSuccess: () => galleryImagesQ.refetch(),
    onError: (e) => toast.error(e.message),
  });
  const myUnsoldAuctionsQ = trpc.productGalleries.myUnsoldAuctions.useQuery(undefined, {
    enabled: auctionPickerOpen,
    refetchOnWindowFocus: false,
  });
  const importFromAuctionsM = trpc.productGalleries.importFromAuctions.useMutation({
    onSuccess: (data) => {
      toast.success(`已置入 ${data.created} 件拍賣商品`);
      setAuctionPickerOpen(false);
      setSelectedAuctionIds(new Set());
      didSyncRef.current = false;
      scrollToItemIdRef.current = -1;
      getForEditQ.refetch();
      galleryImagesQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const myActiveProductsQ = trpc.productGalleries.myActiveProducts.useQuery(undefined, {
    enabled: productPickerOpen,
    refetchOnWindowFocus: false,
  });
  const importFromProductsM = trpc.productGalleries.importFromProducts.useMutation({
    onSuccess: (data) => {
      toast.success(`已置入 ${data.created} 件商品`);
      setProductPickerOpen(false);
      setSelectedProductIds(new Set());
      didSyncRef.current = false;
      scrollToItemIdRef.current = -1;
      getForEditQ.refetch();
      galleryImagesQ.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const convertToAuctionDraftsM = trpc.productGalleries.convertToAuctionDrafts.useMutation({
    onSuccess: (data) => {
      toast.success(`已建立 ${data.created} 個拍賣草稿，請到拍賣商品草稿 tab 查看`);
      setBatchSelectedIds(new Set());
      setBatchSelectMode(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const convertToProductDraftsM = trpc.productGalleries.convertToProductDrafts.useMutation({
    onSuccess: (data) => {
      toast.success(`已建立 ${data.created} 件商品草稿，請到商品管理查看`);
      setBatchSelectedIds(new Set());
      setBatchSelectMode(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createEmptyItemM = trpc.productGalleries.createEmptyItem.useMutation({
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

  // Scroll to newly added item
  useEffect(() => {
    const target = scrollToItemIdRef.current;
    if (target === null || draftItems.length === 0) return;
    scrollToItemIdRef.current = null;
    const itemId = target === -1 ? draftItems[draftItems.length - 1].id : target;
    requestAnimationFrame(() => {
      const el = document.getElementById(`gallery-item-${itemId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }, [draftItems]);

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
      confirmText: '下一步',
      cancelText: '取消',
    });
    if (!ok) return;
    setDeleteConfirmName('');
    setDeleteConfirmOpen(true);
  }

  async function handleSavePoster() {
    setSavingPoster(true);
    try {
      // ── Constants matching DOM layout (CSS px, drawn at 2× scale) ──
      const items = draftItems.filter(i => i.status !== 'hidden');
      const cols = editCols;
      const activeCount = items.filter(i => i.status === 'active').length;
      const soldCount   = items.filter(i => i.status === 'sold').length;
      const title       = currentGallery?.title ?? '';
      const merchantName = (currentGallery as any)?.merchantName ?? '';
      const description  = (currentGallery as any)?.description ?? '';

      const S   = 2;           // scale: 2× CSS px → canvas px
      let CW  = 375;           // canvas width in CSS px; may expand for extra cols
      const M   = 12;          // mx-3 / mt-3 / mb-3
      const hPX = 16;          // hero px-4
      const hPT = 16;          // hero pt-4
      const hPB = 16;          // hero pb-4
      const hR  = 16;          // hero rounded-2xl
      const heroX = M;
      let heroW = CW - M * 2; // 351 px; updated after grid sizing

      // ── Measure description line count ──
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

      // Hero height (matches exact CSS line-heights)
      const nameLineH = 16; const titleLineH = 24; const descLineH = 18; const badgeRowH = 18;
      const heroContentH =
        nameLineH + 8 +                                            // merchant name + mb-2
        titleLineH + 6 +                                           // title + mb-1.5
        (descLines > 0 ? descLines * descLineH + 10 : 0) +        // desc + mb-2.5
        badgeRowH;
      const heroH = hPT + heroContentH + hPB;

      // Grid measurements — cell always sized at 3-col equivalent; canvas expands for extra cols
      const gridPX = 12; const gridPB = 12;
      const gridGap = cols >= 8 ? 2 : 5;
      // Fixed cell width = what 3 columns would produce in a 375-wide canvas
      const BASE_CW = 375;
      const BASE_INNER = BASE_CW - M * 2 - gridPX * 2; // 375 - 24 - 24 = 327
      const cellW = Math.floor((BASE_INNER - gridGap * (3 - 1)) / 3); // 3-col cell size
      // Canvas width expands to fit all cols at that cell size
      const totalGridW = cols * cellW + (cols - 1) * gridGap + gridPX * 2;
      CW = Math.max(BASE_CW, M * 2 + totalGridW);
      heroW = CW - M * 2;
      const buyFontSz = 11; // always 3-col size (not compact)
      const buyStripH = 12 + buyFontSz; // py-1.5(6×2=12) + font
      const cardH   = cellW + buyStripH;
      const rows    = Math.ceil(items.length / cols);
      const gridH   = rows * (cardH + gridGap) - gridGap + gridPB;
      const totalH  = M + heroH + M + gridH;

      // ── Canvas ──
      const canvas = document.createElement('canvas');
      canvas.width = CW * S; canvas.height = totalH * S;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(S, S);

      // rounded-rect helper (arcTo, works everywhere)
      const rrect = (x: number, y: number, w: number, h: number, r: number) => {
        const rv = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rv, y); ctx.lineTo(x + w - rv, y);
        ctx.arcTo(x + w, y,     x + w, y + rv,     rv);
        ctx.lineTo(x + w, y + h - rv);
        ctx.arcTo(x + w, y + h, x + w - rv, y + h, rv);
        ctx.lineTo(x + rv, y + h);
        ctx.arcTo(x, y + h,     x, y + h - rv,     rv);
        ctx.lineTo(x, y + rv);
        ctx.arcTo(x, y,         x + rv, y,          rv);
        ctx.closePath();
      };

      // ── Background ──
      ctx.fillStyle = '#ECECEC';
      ctx.fillRect(0, 0, CW, totalH);

      // ── Hero card ──
      const heroY = M;
      ctx.save();
      rrect(heroX, heroY, heroW, heroH, hR); ctx.clip();
      const hGrad = ctx.createLinearGradient(heroX, heroY, heroX + heroW * 0.6, heroY + heroH * 0.85);
      hGrad.addColorStop(0, '#0D1B2A'); hGrad.addColorStop(0.4, '#1B263B'); hGrad.addColorStop(1, '#1F3A5F');
      ctx.fillStyle = hGrad; ctx.fillRect(heroX, heroY, heroW, heroH);
      // Decorative circles (absolute -top-6 -right-6 w-28 / -bottom-8 -left-4 w-24)
      ctx.fillStyle = 'rgba(255,179,71,0.1)';
      ctx.beginPath(); ctx.arc(heroX + heroW - 32, heroY + 32, 56, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(74,144,217,0.1)';
      ctx.beginPath(); ctx.arc(heroX + 32, heroY + heroH - 16, 48, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // ── Hero text ──
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

      // Badges
      let bX = cX;
      const bPX = 10; const bPY = 4; const bFSz = 10;
      const bH2 = bFSz + bPY * 2; const bR2 = bH2 / 2;
      ctx.font = `bold ${bFSz}px sans-serif`; ctx.textBaseline = 'middle';
      if (activeCount > 0) {
        const tW = ctx.measureText(`${activeCount} 件在售`).width;
        const bW = bPX * 2 + 10 + tW; // 10 = dot(6) + gap(4)
        ctx.fillStyle = 'rgba(34,197,94,0.2)'; rrect(bX, cY, bW, bH2, bR2); ctx.fill();
        ctx.strokeStyle = 'rgba(34,197,94,0.25)'; ctx.lineWidth = 1; rrect(bX, cY, bW, bH2, bR2); ctx.stroke();
        ctx.fillStyle = '#4ADE80';
        ctx.beginPath(); ctx.arc(bX + bPX + 3, cY + bH2 / 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(`${activeCount} 件在售`, bX + bPX + 10, cY + bH2 / 2);
        bX += bW + 8;
      }
      if (soldCount > 0) {
        const tW = ctx.measureText(`${soldCount} 件已售`).width;
        const bW = bPX * 2 + tW;
        ctx.fillStyle = 'rgba(239,68,68,0.18)'; rrect(bX, cY, bW, bH2, bR2); ctx.fill();
        ctx.strokeStyle = 'rgba(239,68,68,0.2)'; ctx.lineWidth = 1; rrect(bX, cY, bW, bH2, bR2); ctx.stroke();
        ctx.fillStyle = '#FCA5A5'; ctx.fillText(`${soldCount} 件已售`, bX + bPX, cY + bH2 / 2);
      }

      // ── Load images: fetch → blob URL → Image (avoids canvas CORS taint) ──
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

      // ── Grid items ──
      const gridTop  = M + heroH + M;
      const gridLeft = heroX + gridPX; // = 24
      const cardR    = 10;  // always 3-col size (not compact)
      const rs       = 46;  // ribbon size fixed at 3-col
      const numFSz   = 8;
      const nameFSz  = 10;
      const priceFSz = 10;

      items.forEach((item, idx) => {
        const col = idx % cols; const row = Math.floor(idx / cols);
        const cx  = gridLeft + col * (cellW + gridGap);
        const cy  = gridTop  + row * (cardH + gridGap);
        const isSold = item.status === 'sold';
        const price  = parseFloat(item.price);
        const img    = loadedImgs[idx];

        // 1. Card white bg + shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.10)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#fff'; rrect(cx, cy, cellW, cardH, cardR); ctx.fill();
        ctx.restore();

        // 2. Image area clip → image → overlay → sold indicator
        ctx.save();
        ctx.beginPath();
        if (buyStripH > 0) {
          // top-only rounded
          const rv = Math.min(cardR, cellW / 2);
          ctx.moveTo(cx + rv, cy); ctx.lineTo(cx + cellW - rv, cy);
          ctx.arcTo(cx + cellW, cy, cx + cellW, cy + rv, rv);
          ctx.lineTo(cx + cellW, cy + cellW); ctx.lineTo(cx, cy + cellW);
          ctx.lineTo(cx, cy + rv); ctx.arcTo(cx, cy, cx + rv, cy, rv);
        } else {
          rrect(cx, cy, cellW, cellW, cardR);
        }
        ctx.closePath(); ctx.clip();

        if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
          try {
            if (isSold) ctx.filter = 'grayscale(50%) brightness(0.88)';
            // object-cover centre crop
            const nw = img.naturalWidth, nh = img.naturalHeight;
            let sx = 0, sy = 0, sw = nw, sh = nh;
            if (nw / nh > 1) { sw = nh; sx = (nw - sw) / 2; } else { sh = nw; sy = (nh - sh) / 2; }
            ctx.drawImage(img, sx, sy, sw, sh, cx, cy, cellW, cellW);
            ctx.filter = 'none';
          } catch { ctx.filter = 'none'; ctx.fillStyle = '#f3f4f6'; ctx.fillRect(cx, cy, cellW, cellW); }
        } else {
          ctx.fillStyle = '#f3f4f6'; ctx.fillRect(cx, cy, cellW, cellW);
        }

        // Overlay + text
        if (item.itemNumber || item.itemName || price > 0) {
          const ovH  = Math.round(cellW * 0.55);
          const ovG  = ctx.createLinearGradient(0, cy + cellW - ovH, 0, cy + cellW);
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

        // Sold indicator — triangle ribbon (always 3-col style)
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
        ctx.restore(); // end image clip

        // 3. Buy strip (bottom)
        if (buyStripH > 0) {
          const sy = cy + cellW;
          const rv = Math.min(cardR, cellW / 2);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cx, sy); ctx.lineTo(cx + cellW, sy);
          ctx.lineTo(cx + cellW, sy + buyStripH - rv);
          ctx.arcTo(cx + cellW, sy + buyStripH, cx + cellW - rv, sy + buyStripH, rv);
          ctx.lineTo(cx + rv, sy + buyStripH);
          ctx.arcTo(cx, sy + buyStripH, cx, sy + buyStripH - rv, rv);
          ctx.lineTo(cx, sy); ctx.closePath(); ctx.clip();
          if (isSold) {
            ctx.fillStyle = '#F3F4F6'; ctx.fillRect(cx, sy, cellW, buyStripH);
            ctx.fillStyle = '#9CA3AF';
          } else {
            const bg = ctx.createLinearGradient(0, sy, 0, sy + buyStripH);
            bg.addColorStop(0, '#FBBF24'); bg.addColorStop(1, '#78350F');
            ctx.fillStyle = bg; ctx.fillRect(cx, sy, cellW, buyStripH);
            ctx.fillStyle = '#fff';
          }
          ctx.font = `${isSold ? '' : 'bold '}${buyFontSz}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(isSold ? '已售出 · 聯繫商戶' : '立即落單', cx + cellW / 2, sy + buyStripH / 2);
          ctx.restore();
        }
      });

      // ── Download (toDataURL — same as PokeCollection, synchronous & reliable) ──
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.download = `gallery-${editGalleryId}.png`;
      a.href = dataUrl;
      a.click();
      toast.success('圖片已儲存');
      setSavingPoster(false);

    } catch (err) {
      console.error('[poster] error:', err);
      toast.error('生成圖片失敗，請重試');
      setSavingPoster(false);
    }
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
        await addToPoolM.mutateAsync({ galleryId: editGalleryId, images: uploaded });
        await galleryImagesQ.refetch();
        toast.success(`成功上載 ${uploaded.length} 張，圖片已加入相片池`);
      } catch (err: any) {
        toast.error(err.message ?? '儲存失敗');
      }
    }
    setUploading(false);
  }

  async function handleUploadClick() {
    if (uploading) return;
    // Try File System Access API first — uses Chrome's own picker,
    // avoids the Android System Photo Picker blank-screen bug entirely.
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
        // AbortError = user cancelled; anything else = unsupported, fall through
        if (err?.name === 'AbortError') return;
      }
    }
    // Fallback: traditional file input click
    fileInputRef.current?.click();
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

  const currentGallery = getForEditQ.data?.gallery as any;
  const galleries = (galleriesQ.data ?? []) as GalleryRow[];

  if (!isAuthenticated) return null;

  // ── Lightbox helpers ──
  function openLightbox(src: string, images?: string[]) {
    const imgs = images && images.length > 0 ? images : [src];
    const idx = imgs.indexOf(src);
    setLightboxImages(imgs);
    setLightboxImgIdx(idx >= 0 ? idx : 0);
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
      setLightboxImgIdx(i => i + 1);
      setLbZoom(1); setLbPanX(0); setLbPanY(0);
    } else if (diff < -50 && lightboxImgIdx > 0) {
      setLightboxImgIdx(i => i - 1);
      setLbZoom(1); setLbPanX(0); setLbPanY(0);
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
    const lbCurSrc = lightboxImages[lightboxImgIdx] ?? lightboxSrc;
    return (
      <div
        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        onClick={() => { if (lbZoom <= 1) setLightboxSrc(null); }}
        onTouchEnd={lbTouchEnd}
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
          src={lbCurSrc}
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
        {lightboxImages.length > 1 && (
          <div className="absolute flex gap-1.5 pointer-events-none" style={{ bottom: 32, left: 0, right: 0, justifyContent: 'center' }}>
            {lightboxImages.map((_, i) => (
              <div key={i} style={{
                width: i === lightboxImgIdx ? 14 : 6, height: 6, borderRadius: 3,
                background: i === lightboxImgIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'width 0.2s',
              }} />
            ))}
          </div>
        )}
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
            {([['info', '基本設定'], ['items', '圖片商品'], ['orders', '訂單'], ['publish', '發佈']] as [EditTab, string][]).map(([tab, label]) => (
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
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif"
                      onChange={handleUpload}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                    />
                    <button
                      onClick={handleUploadClick}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                    >
                      <Upload className="w-4 h-4" />
                      {uploading ? `上載中 ${uploadDone}/${uploadTotal}` : '上載到相片池'}
                    </button>
                    <button
                      onClick={() => editGalleryId && createEmptyItemM.mutate({ galleryId: editGalleryId })}
                      disabled={createEmptyItemM.isPending}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
                      style={{ background: '#F0F0F0', color: '#555' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增商品
                    </button>
                    <button
                      onClick={() => { setSelectedAuctionIds(new Set()); setAuctionPickerOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: '#EEF6FF', color: '#3B82F6' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      置入拍賣商品
                    </button>
                    <button
                      onClick={() => { setSelectedProductIds(new Set()); setProductPickerOpen(true); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: '#F0FDF4', color: '#16A34A' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      置入商品出售
                    </button>
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

                  {/* Pool section — above batch panel */}
                  {(() => {
                    const poolImages = (galleryImagesQ.data ?? []).filter(img => img.itemId === null);
                    return (
                      <div className="bg-white rounded-2xl p-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <Images className="w-4 h-4 text-orange-500" />
                            相片池 ({poolImages.length})
                          </h3>
                          <p className="text-[10px] text-gray-400">點「指定」把圖片加入商品</p>
                        </div>
                        {poolImages.length === 0 ? (
                          <p className="text-xs text-gray-400 py-4 text-center">上載圖片後會顯示於此，再指定給各商品</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5">
                            {poolImages.map(img => (
                              <div key={img.id} className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: '1/1' }}>
                                <img
                                  src={img.imageUrl}
                                  alt=""
                                  className="w-full h-full object-cover cursor-zoom-in"
                                  onClick={() => openLightbox(img.imageUrl)}
                                />
                                <div className="absolute inset-0 flex flex-col pointer-events-none">
                                  <div className="flex justify-end p-0.5 pointer-events-auto">
                                    <button
                                      onClick={() => deleteGalleryImageM.mutate({ imageId: img.id })}
                                      className="w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                                    >
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

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

                  {(() => {
                    const allGalleryImages: GalleryImageRow[] = galleryImagesQ.data ?? [];
                    const getItemImages = (itemId: number) => allGalleryImages.filter(img => img.itemId === itemId);

                    return (
                      <>
                        {draftItems.length === 0 ? (
                          <div className="bg-white rounded-2xl p-12 text-center">
                            <FileImage className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400 mb-1">點擊「上載到相片池」批量上載圖片</p>
                            <p className="text-xs text-gray-300">再點「新增商品」，然後把相片指定到各商品</p>
                          </div>
                        ) : (
                          <>
                            {draftItems.length > 0 && (
                              <>
                                {/* Layout toggle + batch select toggle */}
                                <div className="flex justify-between items-center mb-2">
                                  <button
                                    onClick={() => {
                                      setBatchSelectMode(v => !v);
                                      setBatchSelectedIds(new Set());
                                    }}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                    style={batchSelectMode
                                      ? { background: 'linear-gradient(135deg,#FF8C00,#FF6B00)', color: '#fff' }
                                      : { background: '#F0F0F0', color: '#555' }}
                                  >
                                    {batchSelectMode ? `批量轉換 (${batchSelectedIds.size})` : '批量轉換'}
                                  </button>
                                  <button
                                    onClick={() => setItemsScrollMode(v => !v)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                    style={{ background: '#F0F0F0', color: '#555' }}
                                  >
                                    {itemsScrollMode ? '換回多行顯示' : '換為橫向捲動'}
                                  </button>
                                </div>
                                <div
                                  className={itemsScrollMode
                                    ? 'flex gap-2 overflow-x-auto pb-2'
                                    : 'grid grid-cols-2 gap-2'}
                                  style={{ scrollbarWidth: 'none' }}
                                >
                                {draftItems.map(item => {
                                  const itemImages = getItemImages(item.id);
                                  const coverImg = itemImages[0];
                                  return (
                                    <div
                                      key={item.id}
                                      id={`gallery-item-${item.id}`}
                                      className="bg-white rounded-xl overflow-hidden border border-gray-100 relative"
                                      style={itemsScrollMode ? { flexShrink: 0, width: 'calc(50vw - 20px)' } : undefined}
                                      onClick={batchSelectMode ? () => setBatchSelectedIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                        return next;
                                      }) : undefined}
                                    >
                                      {batchSelectMode && (
                                        <div
                                          className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                                          style={{
                                            background: batchSelectedIds.has(item.id) ? '#FF8C00' : 'rgba(255,255,255,0.85)',
                                            borderColor: batchSelectedIds.has(item.id) ? '#FF8C00' : '#ccc',
                                          }}
                                        >
                                          {batchSelectedIds.has(item.id) && (
                                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                              <path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                          )}
                                        </div>
                                      )}
                                      <div className="relative bg-gray-50">
                                        {itemImages.length > 0 ? (() => {
                                          const ci = Math.min(carouselIdx[item.id] ?? 0, itemImages.length - 1);
                                          const cur = itemImages[ci];
                                          return (
                                            <>
                                              <div
                                                className="w-full aspect-square relative overflow-hidden"
                                                onTouchStart={e => { carouselTouchX.current[item.id] = e.touches[0].clientX; }}
                                                onTouchEnd={e => {
                                                  const diff = (carouselTouchX.current[item.id] ?? 0) - e.changedTouches[0].clientX;
                                                  if (diff > 40 && ci < itemImages.length - 1)
                                                    setCarouselIdx(prev => ({ ...prev, [item.id]: ci + 1 }));
                                                  else if (diff < -40 && ci > 0)
                                                    setCarouselIdx(prev => ({ ...prev, [item.id]: ci - 1 }));
                                                }}
                                              >
                                                <img
                                                  src={cur.imageUrl}
                                                  alt=""
                                                  className="w-full h-full object-cover cursor-zoom-in"
                                                  style={{ filter: item.status === 'sold' ? 'grayscale(50%) brightness(0.88)' : 'none' }}
                                                  onClick={() => openLightbox(cur.imageUrl, itemImages.map(i => i.imageUrl))}
                                                />
                                                {item.status === 'sold' && (
                                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                                    <span className="text-white text-xs font-bold bg-black/60 px-2 py-0.5 rounded-full">已售出</span>
                                                  </div>
                                                )}
                                                {item.status === 'hidden' && (
                                                  <div className="absolute top-1.5 right-1.5 pointer-events-none">
                                                    <EyeOff className="w-4 h-4 text-white drop-shadow-sm" />
                                                  </div>
                                                )}
                                                {itemImages.length > 1 && (
                                                  <div className="absolute flex gap-0.5 pointer-events-none" style={{ bottom: 6, left: 0, right: 0, justifyContent: 'center' }}>
                                                    {itemImages.map((_, di) => (
                                                      <div key={di} style={{
                                                        width: di === ci ? 10 : 4, height: 4, borderRadius: 2,
                                                        background: di === ci ? '#fff' : 'rgba(255,255,255,0.5)',
                                                        transition: 'width 0.2s',
                                                      }} />
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          );
                                        })() : (
                                          <div className="w-full aspect-square flex flex-col items-center justify-center gap-1">
                                            <FileImage className="w-8 h-8 text-gray-200" />
                                            <p className="text-[10px] text-gray-400">尚未分配圖片</p>
                                          </div>
                                        )}
                                        <button
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70"
                                        >
                                          <X className="w-3 h-3 text-white" />
                                        </button>
                                      </div>
                                      {/* Thumbnail strip — click to jump to that image */}
                                      {itemImages.length > 0 && (
                                        <div className="flex gap-1 overflow-x-auto px-1.5 pt-1.5" style={{ scrollbarWidth: 'none' }}>
                                          {itemImages.map((img, imgIdx) => (
                                            <div key={img.id} className="relative flex-shrink-0 w-9 h-9">
                                              <img
                                                src={img.imageUrl}
                                                alt=""
                                                className="w-full h-full object-cover rounded cursor-pointer"
                                                style={{ outline: (carouselIdx[item.id] ?? 0) === imgIdx ? '2px solid #FF8C00' : 'none' }}
                                                onClick={() => setCarouselIdx(prev => ({ ...prev, [item.id]: imgIdx }))}
                                              />
                                              <button
                                                onClick={() => unassignImageM.mutate({ imageId: img.id })}
                                                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center"
                                              >
                                                <X className="w-2 h-2 text-white" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
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
                                  );
                                })}
                                </div>

                                {/* Batch convert action bar */}
                                {batchSelectMode && (
                                  <div className="mt-3 space-y-2">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setBatchSelectedIds(
                                          batchSelectedIds.size === draftItems.length
                                            ? new Set()
                                            : new Set(draftItems.map(i => i.id))
                                        )}
                                        className="flex-1 py-2 rounded-xl text-xs font-semibold"
                                        style={{ background: '#F0F0F0', color: '#555' }}
                                      >
                                        {batchSelectedIds.size === draftItems.length ? '取消全選' : '全選'}
                                      </button>
                                      <button
                                        onClick={() => { setBatchSelectMode(false); setBatchSelectedIds(new Set()); }}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold"
                                        style={{ background: '#F0F0F0', color: '#555' }}
                                      >
                                        取消
                                      </button>
                                    </div>
                                    {batchSelectedIds.size > 0 && (
                                      <div className="flex flex-col gap-2">
                                        <button
                                          disabled={convertToAuctionDraftsM.isPending}
                                          onClick={() => {
                                            if (editGalleryId === null) return;
                                            convertToAuctionDraftsM.mutate({
                                              galleryId: editGalleryId,
                                              itemIds: Array.from(batchSelectedIds),
                                            });
                                          }}
                                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                                          style={{ background: 'linear-gradient(135deg,#FF8C00,#FF6B00)' }}
                                        >
                                          {convertToAuctionDraftsM.isPending
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : `轉為拍賣草稿（${batchSelectedIds.size} 件）`}
                                        </button>
                                        <button
                                          disabled={convertToProductDraftsM.isPending}
                                          onClick={() => {
                                            if (editGalleryId === null) return;
                                            convertToProductDraftsM.mutate({
                                              galleryId: editGalleryId,
                                              itemIds: Array.from(batchSelectedIds),
                                            });
                                          }}
                                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                                          style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)' }}
                                        >
                                          {convertToProductDraftsM.isPending
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : `轉為商品出售草稿（${batchSelectedIds.size} 件）`}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}

                          </>
                        )}
                      </>
                    );
                  })()}

                  {draftItems.length > 0 && (
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
                  )}

                  {/* Assign picker modal */}
                  {assignPickerImageId !== null && (
                    <div
                      className="fixed inset-0 z-50 bg-black/70 flex items-end"
                      onClick={() => setAssignPickerImageId(null)}
                    >
                      <div
                        className="bg-white w-full rounded-t-2xl px-4 pt-4"
                        style={{ maxHeight: '65vh', overflowY: 'auto' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-gray-900 text-sm">指定到哪個商品？</h3>
                          <button onClick={() => setAssignPickerImageId(null)}>
                            <X className="w-5 h-5 text-gray-400" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mb-3">選擇後圖片會從相片池移至該商品</p>
                        {draftItems.length === 0 ? (
                          <p className="text-sm text-gray-400 py-6 text-center">請先點「新增商品」建立商品</p>
                        ) : (
                          <div className="space-y-1 pb-20">
                            {draftItems.map(item => {
                              const iImgs = (galleryImagesQ.data ?? []).filter((img: GalleryImageRow) => img.itemId === item.id);
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    assignImageM.mutate({ imageId: assignPickerImageId!, itemId: item.id });
                                    setAssignPickerImageId(null);
                                  }}
                                  className="w-full flex items-center gap-3 py-2 px-2 rounded-xl text-left"
                                  style={{ background: '#F9F9F9' }}
                                >
                                  {iImgs[0] ? (
                                    <img src={iImgs[0].imageUrl} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" alt="" />
                                  ) : (
                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center">
                                      <FileImage className="w-5 h-5 text-gray-300" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                      {item.itemName || `商品 #${item.id}`}
                                    </p>
                                    {item.itemNumber && <p className="text-xs text-gray-400">#{item.itemNumber}</p>}
                                    <p className="text-xs text-orange-500">{iImgs.length} 張圖片</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Auction import picker modal */}
                  {auctionPickerOpen && (
                    <div
                      className="fixed inset-0 z-50 bg-black/70 flex items-end"
                      onClick={() => setAuctionPickerOpen(false)}
                    >
                      <div
                        className="bg-white w-full rounded-t-2xl px-4 pt-4"
                        style={{ maxHeight: '75vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                          <h3 className="font-semibold text-gray-900 text-sm">選取流拍商品置入圖片集</h3>
                          <button onClick={() => setAuctionPickerOpen(false)}>
                            <X className="w-5 h-5 text-gray-400" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 flex-shrink-0">選取後自動使用拍賣圖片，起拍價設為售價</p>
                        {myUnsoldAuctionsQ.isLoading ? (
                          <div className="flex justify-center py-8 flex-shrink-0">
                            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                          </div>
                        ) : !myUnsoldAuctionsQ.data?.length ? (
                          <div className="text-center py-8 text-sm text-gray-400 flex-shrink-0">
                            沒有流拍商品
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                              <span className="text-xs text-gray-500">
                                已選 {selectedAuctionIds.size} / {myUnsoldAuctionsQ.data.length} 件
                              </span>
                              <button
                                className="text-xs font-semibold text-orange-500"
                                onClick={() => {
                                  if (selectedAuctionIds.size === myUnsoldAuctionsQ.data!.length) {
                                    setSelectedAuctionIds(new Set());
                                  } else {
                                    setSelectedAuctionIds(new Set(myUnsoldAuctionsQ.data!.map(a => a.id)));
                                  }
                                }}
                              >
                                {selectedAuctionIds.size === myUnsoldAuctionsQ.data.length ? '取消全選' : '全選'}
                              </button>
                            </div>
                            <div className="overflow-y-auto flex-1 space-y-1.5 pr-0.5">
                              {myUnsoldAuctionsQ.data.map(auction => {
                                const selected = selectedAuctionIds.has(auction.id);
                                return (
                                  <button
                                    key={auction.id}
                                    onClick={() => {
                                      setSelectedAuctionIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(auction.id)) next.delete(auction.id);
                                        else next.add(auction.id);
                                        return next;
                                      });
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-xl text-left"
                                    style={{ background: selected ? '#FFF7ED' : '#F8F8F8', border: `1.5px solid ${selected ? '#FF8C00' : 'transparent'}` }}
                                  >
                                    {auction.firstImageUrl ? (
                                      <img src={auction.firstImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                        <FileImage className="w-5 h-5 text-gray-300" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-800 truncate">{auction.title}</p>
                                      <p className="text-xs text-orange-500 font-semibold">
                                        起拍 HKD${parseFloat(auction.startingPrice).toLocaleString('en-HK')}
                                      </p>
                                    </div>
                                    <div
                                      className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                                      style={{ borderColor: selected ? '#FF8C00' : '#D1D5DB', background: selected ? '#FF8C00' : 'white' }}
                                    >
                                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => {
                                if (!editGalleryId || selectedAuctionIds.size === 0) return;
                                importFromAuctionsM.mutate({
                                  galleryId: editGalleryId,
                                  auctionIds: Array.from(selectedAuctionIds),
                                });
                              }}
                              disabled={selectedAuctionIds.size === 0 || importFromAuctionsM.isPending}
                              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex-shrink-0 flex items-center justify-center gap-2"
                              style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                            >
                              {importFromAuctionsM.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />置入中...</>
                                : `置入 ${selectedAuctionIds.size} 件商品`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Product import picker modal */}
                  {productPickerOpen && (
                    <div
                      className="fixed inset-0 z-50 bg-black/70 flex items-end"
                      onClick={() => setProductPickerOpen(false)}
                    >
                      <div
                        className="bg-white w-full rounded-t-2xl px-4 pt-4"
                        style={{ maxHeight: '75vh', display: 'flex', flexDirection: 'column', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-2 flex-shrink-0">
                          <h3 className="font-semibold text-gray-900 text-sm">選取商品出售置入圖片集</h3>
                          <button onClick={() => setProductPickerOpen(false)}>
                            <X className="w-5 h-5 text-gray-400" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mb-3 flex-shrink-0">選取後自動使用商品圖片，售價照舊</p>
                        {myActiveProductsQ.isLoading ? (
                          <div className="flex justify-center py-8 flex-shrink-0">
                            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                          </div>
                        ) : !myActiveProductsQ.data?.length ? (
                          <div className="text-center py-8 text-sm text-gray-400 flex-shrink-0">
                            沒有在售商品
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                              <span className="text-xs text-gray-500">
                                已選 {selectedProductIds.size} / {myActiveProductsQ.data.length} 件
                              </span>
                              <button
                                className="text-xs font-semibold text-orange-500"
                                onClick={() => {
                                  if (selectedProductIds.size === myActiveProductsQ.data!.length) {
                                    setSelectedProductIds(new Set());
                                  } else {
                                    setSelectedProductIds(new Set(myActiveProductsQ.data!.map(p => p.id)));
                                  }
                                }}
                              >
                                {selectedProductIds.size === myActiveProductsQ.data.length ? '取消全選' : '全選'}
                              </button>
                            </div>
                            <div className="overflow-y-auto flex-1 space-y-1.5 pr-0.5">
                              {myActiveProductsQ.data.map(product => {
                                const selected = selectedProductIds.has(product.id);
                                return (
                                  <button
                                    key={product.id}
                                    onClick={() => {
                                      setSelectedProductIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(product.id)) next.delete(product.id);
                                        else next.add(product.id);
                                        return next;
                                      });
                                    }}
                                    className="w-full flex items-center gap-3 p-2 rounded-xl text-left"
                                    style={{ background: selected ? '#F0FDF4' : '#F8F8F8', border: `1.5px solid ${selected ? '#16A34A' : 'transparent'}` }}
                                  >
                                    {product.firstImageUrl ? (
                                      <img src={product.firstImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                                    ) : (
                                      <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center">
                                        <FileImage className="w-5 h-5 text-gray-300" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-gray-800 truncate">{product.title}</p>
                                      <p className="text-xs text-green-600 font-semibold">
                                        售價 {product.currency}${parseFloat(product.price).toLocaleString('en-HK')}
                                      </p>
                                    </div>
                                    <div
                                      className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                                      style={{ borderColor: selected ? '#16A34A' : '#D1D5DB', background: selected ? '#16A34A' : 'white' }}
                                    >
                                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={() => {
                                if (!editGalleryId || selectedProductIds.size === 0) return;
                                importFromProductsM.mutate({
                                  galleryId: editGalleryId,
                                  productIds: Array.from(selectedProductIds),
                                });
                              }}
                              disabled={selectedProductIds.size === 0 || importFromProductsM.isPending}
                              className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex-shrink-0 flex items-center justify-center gap-2"
                              style={{ background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}
                            >
                              {importFromProductsM.isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" />置入中...</>
                                : `置入 ${selectedProductIds.size} 件商品`}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Delete gallery name confirmation modal */}
                  {deleteConfirmOpen && (
                    <div
                      className="fixed inset-0 z-50 bg-black/70 flex items-end"
                      onClick={() => setDeleteConfirmOpen(false)}
                    >
                      <div
                        className="bg-white w-full rounded-t-2xl px-4 pt-4 pb-10"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-red-600 text-sm">最終確認</h3>
                          <button onClick={() => setDeleteConfirmOpen(false)}>
                            <X className="w-5 h-5 text-gray-400" />
                          </button>
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
                            if (deleteConfirmName.trim() !== editTitle.trim()) {
                              toast.error('名稱不符，請重新輸入');
                              return;
                            }
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
                </div>
              )}

              {/* Tab: 訂單 */}
              {editTab === 'orders' && (
                <div className="space-y-3">
                  {ordersQ.isLoading && (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-400" /></div>
                  )}
                  {!ordersQ.isLoading && (!ordersQ.data || ordersQ.data.length === 0) && (
                    <div className="text-center py-10 text-gray-400 text-sm">暫無訂單</div>
                  )}
                  {(ordersQ.data ?? []).map((order: any) => {
                    const statusMap: Record<string, { label: string; color: string }> = {
                      pending:   { label: '待確認', color: 'bg-yellow-100 text-yellow-700' },
                      confirmed: { label: '已確認', color: 'bg-green-100 text-green-700' },
                      cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-500' },
                    };
                    const s = statusMap[order.status] ?? { label: order.status, color: 'bg-gray-100 text-gray-500' };
                    const price = parseFloat(order.price) || 0;
                    const commission = parseFloat(order.commissionAmount) || 0;
                    const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    // WhatsApp link: normalise HK number (strip leading 0, add 852 if needed)
                    const rawPhone = order.buyerPhone ?? '';
                    const waPhone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone.replace(/\D/g, '') : rawPhone.startsWith('852') ? rawPhone.replace(/\D/g, '') : `852${rawPhone.replace(/\D/g, '')}`) : '';
                    const waLink = waPhone ? `https://wa.me/${waPhone}` : null;
                    return (
                      <div key={order.id} className="bg-white rounded-2xl p-4 space-y-2 shadow-sm">
                        <div className="flex items-start gap-3">
                          {order.imageUrl ? (
                            <button
                              onClick={() => openLightbox(order.imageUrl)}
                              className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden focus:outline-none"
                              title="點擊放大"
                            >
                              <img src={order.imageUrl} alt="" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-gray-900 truncate">{order.title || `訂單 #${order.id}`}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.color}`}>{s.label}</span>
                            </div>
                            {order.itemNumber && <p className="text-xs text-gray-400">編號：{order.itemNumber}</p>}
                            <p className="text-xs text-gray-500">{order.currency} ${price.toLocaleString('en-HK', { minimumFractionDigits: 0 })}</p>
                            <p className="text-xs text-gray-400">傭金：{order.currency} ${commission.toFixed(2)} ({(parseFloat(order.commissionRate) * 100).toFixed(1)}%)</p>
                          </div>
                        </div>
                        <div className="pt-1 border-t border-gray-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-gray-500">買家：{order.buyerDisplayName || `#${order.buyerId}`}</p>
                              {order.buyerNote && <p className="text-xs text-gray-400 mt-0.5">備注：{order.buyerNote}</p>}
                              <p className="text-xs text-gray-300 mt-0.5">{date}</p>
                            </div>
                            {order.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => cancelOrderM.mutate({ orderId: order.id })}
                                  disabled={cancelOrderM.isPending}
                                  className="text-xs px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 disabled:opacity-50"
                                >取消</button>
                                <button
                                  onClick={() => confirmOrderM.mutate({ orderId: order.id })}
                                  disabled={confirmOrderM.isPending}
                                  className="text-xs px-3 py-1.5 rounded-xl font-semibold text-white disabled:opacity-50"
                                  style={{ background: 'linear-gradient(135deg, #FF8C00, #FF6B00)' }}
                                >確認成交</button>
                              </div>
                            )}
                          </div>
                          {/* Contact buyer via WhatsApp / Messenger */}
                          {rawPhone && (
                            <div className="flex gap-2">
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-medium text-white flex-shrink-0"
                                  style={{ background: '#25D366' }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                  WhatsApp
                                </a>
                              )}
                              <a
                                href={`https://www.messenger.com/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-medium text-white flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, #0084FF, #A033FF)' }}
                                title={rawPhone}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/></svg>
                                Messenger
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                      <div className="flex gap-2">
                        <Link
                          href={`/gallery/${editGalleryId}`}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-center text-white flex items-center justify-center gap-1"
                          style={{ backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)', backgroundColor: '#FBBF24' }}
                        >
                          <ExternalLink className="w-3 h-3" />
                          圖片集頁面
                        </Link>
                        <div className="flex-1">
                          <GalleryShareMenu
                            galleryId={editGalleryId!}
                            title={currentGallery?.title ?? ''}
                            description={currentGallery?.description ?? null}
                            merchantName={currentGallery?.merchantName ?? null}
                          />
                        </div>
                      </div>
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
      {showPosterModal && (() => {
        const posterItems = draftItems.filter(i => i.status !== 'hidden');
        const posterCols = editCols;
        const activeCount = posterItems.filter(i => i.status === 'active').length;
        const soldCount = posterItems.filter(i => i.status === 'sold').length;
        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex flex-col" style={{ paddingLeft: 3, paddingRight: 3, paddingTop: 3, paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#ECECEC', borderRadius: 16 }}>
              {/* scrollable preview — min-h-0 stops flex overflow leak */}
              <div className="flex-1 min-h-0 overflow-y-auto pb-4">
                {/* posterRef wraps the full scrollable content for html2canvas capture */}
                <div ref={posterRef}>
                {/* ── Hero Banner (exact copy of PublicGallery) ── */}
                <div className="mx-3 mt-3 mb-3 rounded-2xl overflow-hidden shadow-lg" style={{
                  background: 'linear-gradient(145deg, #0D1B2A 0%, #1B263B 40%, #1F3A5F 100%)',
                }}>
                  <div className="relative px-4 pt-4 pb-4 overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-10" style={{ background: '#FFB347' }} />
                    <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full opacity-10" style={{ background: '#4A90D9' }} />
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: '#FFB347' }}>{(currentGallery as any)?.merchantName}</span>
                    </div>
                    <h1 className="text-[17px] font-bold leading-snug mb-1.5 relative z-10" style={{ color: '#FFFFFF' }}>
                      {currentGallery?.title}
                    </h1>
                    {(currentGallery as any)?.description && (
                      <p className="text-[11px] leading-relaxed mb-2.5 relative z-10 whitespace-pre-line" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {(currentGallery as any).description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap relative z-10">
                      {activeCount > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{
                          background: 'rgba(34,197,94,0.2)', color: '#4ADE80', border: '1px solid rgba(34,197,94,0.25)'
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4ADE80' }} />
                          {activeCount} 件在售
                        </span>
                      )}
                      {soldCount > 0 && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{
                          background: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)'
                        }}>
                          {soldCount} 件已售
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Grid — items always at 3-col visual size; overflow-x scrolls extra cols ── */}
                {posterItems.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">未有商品可顯示</p>
                ) : (
                  <div className="overflow-x-auto">
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${posterCols}, calc((100vw - 24px) / 3))`,
                        gap: `${posterCols >= 8 ? 2 : 5}px`,
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingBottom: 12,
                        width: 'max-content',
                        minWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                    {posterItems.map(item => {
                      const price = parseFloat(item.price);
                      const isSold = item.status === 'sold';
                      // Always 3-col visual size
                      const ribbonSize = 46;
                      return (
                        <div
                          key={item.id}
                          className="overflow-hidden"
                          style={{
                            borderRadius: '10px',
                            background: '#fff',
                            boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
                          }}
                        >
                          {/* Image with overlay */}
                          <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
                            <img
                              src={item.imageUrl}
                              alt={item.itemName || '商品'}
                              className="w-full h-full object-cover"
                              style={{ filter: isSold ? 'grayscale(50%) brightness(0.88)' : 'none' }}
                            />
                            {/* Bottom-left info overlay */}
                            {(item.itemNumber || item.itemName || price > 0) && (
                              <div
                                className="absolute bottom-0 left-0 right-0"
                                style={{
                                  background: 'linear-gradient(to top, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.25) 60%, transparent 100%)',
                                  padding: '18px 6px 5px 6px',
                                }}
                              >
                                {item.itemNumber && (
                                  <p className="font-mono leading-none mb-0.5" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.7)' }}>
                                    #{item.itemNumber}
                                  </p>
                                )}
                                {item.itemName && (
                                  <p className="font-semibold text-white leading-tight truncate" style={{ fontSize: '10px', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                    {item.itemName}
                                  </p>
                                )}
                                {price > 0 && (
                                  <p className="font-bold leading-none mt-0.5" style={{ fontSize: '10px', color: '#FFD580' }}>
                                    HK${price.toLocaleString('en-HK')}
                                  </p>
                                )}
                              </div>
                            )}
                            {/* Sold ribbon */}
                            {isSold && (
                              <>
                                <div className="absolute" style={{
                                  top: 0, right: 0, width: 0, height: 0,
                                  borderStyle: 'solid',
                                  borderWidth: `0 ${ribbonSize}px ${ribbonSize}px 0`,
                                  borderColor: `transparent #DC2626 transparent transparent`,
                                }} />
                                <div className="absolute font-bold text-white" style={{
                                  top: '5px', right: '2px', fontSize: '7px',
                                  transform: 'rotate(45deg)',
                                }}>已售</div>
                              </>
                            )}
                          </div>
                          {/* Buy button strip — always shown at 3-col size */}
                          {isSold ? (
                            <div
                              className="w-full flex items-center justify-center py-1.5"
                              style={{ background: '#F3F4F6', fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}
                            >
                              已售出 · 聯繫商戶
                            </div>
                          ) : (
                            <div
                              className="w-full flex items-center justify-center py-1.5"
                              style={{
                                backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #78350F 100%)',
                                backgroundColor: '#FBBF24',
                                fontSize: '11px',
                                color: '#fff',
                                fontWeight: 700,
                              }}
                            >
                              立即落單
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  </div>
                )}
                </div>{/* /posterRef */}
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
        );
      })()}

      <BottomNav />
    </div>
  );
}

// Collage generation utilities — pure canvas, no external deps.
// LA Temple silhouette + optional reference-image-derived mask.
import moroniUrl from "@/assets/moroni.png";

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const CREAM = "#F2E3D5";
const TEAL = "#2C4F52";
const GOLD = "#DBBF96";
const GOLD_DEEP = "#B8975F";
const ORANGE = "#D17A5F";
const SLATE = "#3A3D40";

function drawTextureBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#F6EBDB");
  g.addColorStop(1, "#EAD9C2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = ctx.createRadialGradient(w / 2, h * 0.3, 50, w / 2, h * 0.3, w * 0.8);
  r.addColorStop(0, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, w, h);
}

function drawOrnament(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx + size, cy);
  ctx.stroke();
  ctx.fillStyle = GOLD_DEEP;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const ir = img.width / img.height;
  const tr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > tr) {
    sw = img.height * tr;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / tr;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============ Family collage ============

export async function renderFamilyCollage(opts: {
  familyName: string;
  photoUrls: string[];
}): Promise<Blob> {
  const W = 1200, H = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  drawTextureBg(ctx, W, H);

  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 1;
  ctx.strokeRect(54, 54, W - 108, H - 108);

  ctx.fillStyle = TEAL;
  ctx.textAlign = "center";
  ctx.font = "italic 36px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Primary Temple Trip", W / 2, 130);
  ctx.font = "600 64px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(`The ${opts.familyName} Family`, W / 2, 200);
  drawOrnament(ctx, W / 2, 230, 80);
  ctx.fillStyle = SLATE;
  ctx.font = "500 18px Inter, sans-serif";
  ctx.fillText("June 20, 2026", W / 2, 260);

  const gridTop = 310;
  const gridLeft = 90;
  const gridRight = W - 90;
  const gridBottom = H - 180;
  const gw = gridRight - gridLeft;
  const gh = gridBottom - gridTop;

  const photos = opts.photoUrls.slice(0, 12);
  const imgs = await Promise.all(photos.map((u) => loadImage(u).catch(() => null)));
  const valid = imgs.filter((i): i is HTMLImageElement => !!i);

  if (valid.length === 0) {
    ctx.fillStyle = SLATE;
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("No approved photos yet.", W / 2, gridTop + gh / 2);
  } else {
    // Justified-rows layout: respects each photo's true aspect ratio so
    // selfies (vertical), landscapes (horizontal), and squares all fit.
    const gap = 16;
    // Pick target row height so total rows roughly fill the area.
    const ars = valid.map((i) => i.width / i.height);
    const avgAr = ars.reduce((a, b) => a + b, 0) / ars.length;
    const targetRowH = Math.max(220, Math.min(420, Math.sqrt((gw * gh) / valid.length / avgAr)));

    // Greedy pack: add images to a row until total scaled width >= gw.
    type Row = { items: HTMLImageElement[]; ars: number[] };
    const rows: Row[] = [];
    let cur: Row = { items: [], ars: [] };
    valid.forEach((img) => {
      cur.items.push(img); cur.ars.push(img.width / img.height);
      const arSum = cur.ars.reduce((a, b) => a + b, 0);
      const rowW = arSum * targetRowH + gap * (cur.items.length - 1);
      if (rowW >= gw * 0.95) { rows.push(cur); cur = { items: [], ars: [] }; }
    });
    if (cur.items.length) rows.push(cur);

    // Compute each row height to exactly fill gw (last row capped).
    let y = gridTop;
    rows.forEach((row, idx) => {
      const arSum = row.ars.reduce((a, b) => a + b, 0);
      const available = gw - gap * (row.items.length - 1);
      let h = available / arSum;
      const isLast = idx === rows.length - 1;
      if (isLast) h = Math.min(h, targetRowH * 1.15);
      if (y + h > gridBottom) h = gridBottom - y;
      if (h <= 0) return;
      let x = gridLeft;
      // Center last row if it doesn't fill width
      if (isLast) {
        const usedW = arSum * h + gap * (row.items.length - 1);
        if (usedW < gw) x = gridLeft + (gw - usedW) / 2;
      }
      row.items.forEach((img, i) => {
        const w = row.ars[i] * h;
        ctx.save();
        ctx.shadowColor = "rgba(58,61,64,0.25)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = CREAM;
        roundRect(ctx, x, y, w, h, 14);
        ctx.fill();
        ctx.restore();
        ctx.save();
        roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 10);
        ctx.clip();
        drawImageCover(ctx, img, x + 6, y + 6, w - 12, h - 12);
        ctx.restore();
        x += w + gap;
      });
      y += h + gap;
    });
  }

  drawOrnament(ctx, W / 2, H - 130, 120);
  ctx.fillStyle = TEAL;
  ctx.font = "italic 28px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Families Can Be Together Forever", W / 2, H - 90);
  ctx.fillStyle = ORANGE;
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillText("A Primary Temple Trip keepsake", W / 2, H - 60);

  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

// ============ LA Temple silhouette ============
// Coordinate space: nx,ny in [0..1] x [0..1]. Origin top-left.
// Designed to evoke the Los Angeles California Temple: broad stepped base,
// flanking wings, central body with stepped tower, tall slender spire.

type Rect = { x0: number; x1: number; y0: number; y1: number };

const LA_TEMPLE_RECTS: Rect[] = [
  // ===== ground steps / plinth =====
  { x0: 0.04, x1: 0.96, y0: 0.93, y1: 0.965 },
  { x0: 0.08, x1: 0.92, y0: 0.905, y1: 0.93 },

  // ===== broad base (full width) =====
  { x0: 0.10, x1: 0.90, y0: 0.78, y1: 0.905 },

  // ===== outer wings (lower & shorter) =====
  { x0: 0.10, x1: 0.22, y0: 0.70, y1: 0.78 },
  { x0: 0.78, x1: 0.90, y0: 0.70, y1: 0.78 },

  // ===== inner wing blocks (taller than outer) =====
  { x0: 0.22, x1: 0.34, y0: 0.62, y1: 0.78 },
  { x0: 0.66, x1: 0.78, y0: 0.62, y1: 0.78 },

  // ===== central body (broad) =====
  { x0: 0.34, x1: 0.66, y0: 0.50, y1: 0.78 },

  // ===== central tower step 1 =====
  { x0: 0.38, x1: 0.62, y0: 0.42, y1: 0.50 },

  // ===== central tower step 2 (stepped in) =====
  { x0: 0.41, x1: 0.59, y0: 0.34, y1: 0.42 },

  // ===== tower cap / belfry =====
  { x0: 0.43, x1: 0.57, y0: 0.28, y1: 0.34 },

  // ===== spire base =====
  { x0: 0.46, x1: 0.54, y0: 0.22, y1: 0.28 },

  // ===== spire shaft (narrow) =====
  { x0: 0.475, x1: 0.525, y0: 0.12, y1: 0.22 },

  // ===== spire tip (narrower) =====
  { x0: 0.485, x1: 0.515, y0: 0.07, y1: 0.12 },
];

function inLATempleRects(nx: number, ny: number): boolean {
  for (const r of LA_TEMPLE_RECTS) {
    if (nx >= r.x0 && nx <= r.x1 && ny >= r.y0 && ny <= r.y1) return true;
  }
  return false;
}

// Build a mask the size of the temple area. Either from rect template
// or from a uploaded reference image (luminance threshold).
async function buildMask(
  width: number,
  height: number,
  referenceUrl: string | null,
): Promise<Uint8Array> {
  const mask = new Uint8Array(width * height);

  if (referenceUrl) {
    try {
      const img = await loadImage(referenceUrl);
      const off = document.createElement("canvas");
      off.width = width; off.height = height;
      const octx = off.getContext("2d")!;
      // fit (contain) so silhouette is preserved
      const ir = img.width / img.height;
      const tr = width / height;
      let dw = width, dh = height, dx = 0, dy = 0;
      if (ir > tr) { dh = width / ir; dy = (height - dh) / 2; }
      else { dw = height * ir; dx = (width - dw) / 2; }
      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, width, height);
      octx.drawImage(img, dx, dy, dw, dh);
      const data = octx.getImageData(0, 0, width, height).data;
      // Pixels that are clearly "temple" (lighter beige) vs sky / grass.
      // Simple heuristic: not strongly blue (sky) and not strongly green (grass)
      // and lighter than ~0.35 luminance.
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const isSky = b > r + 15 && b > g + 5 && lum > 0.55;
        const isGrass = g > r + 10 && g > b + 10;
        if (!isSky && !isGrass && lum > 0.30 && lum < 0.95) mask[p] = 1;
      }
      // If reference produced almost-empty mask, fall back to rects.
      let count = 0;
      for (let i = 0; i < mask.length; i++) if (mask[i]) count++;
      if (count > width * height * 0.05) return mask;
    } catch {
      // fall through to rects
    }
  }

  // Fallback: rect template
  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      if (inLATempleRects(nx, ny)) mask[y * width + x] = 1;
    }
  }
  return mask;
}

function drawMoroni(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number) {
  // Simple stylised angel Moroni silhouette: body + horn, in warm gold.
  ctx.save();
  ctx.fillStyle = GOLD_DEEP;
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const w = h * 0.55;
  // Pedestal ball
  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.5, h * 0.10, 0, Math.PI * 2);
  ctx.fill();
  // Body (slim oval/figure)
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.18, w * 0.18, h * 0.30, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - h * 0.18, h * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // Outstretched arm holding horn (to figure's left, viewer's right)
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.05, cy);
  ctx.lineTo(cx + w * 0.55, cy - h * 0.18);
  ctx.stroke();
  // Horn (trumpet)
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.55, cy - h * 0.18);
  ctx.lineTo(cx + w * 0.80, cy - h * 0.28);
  ctx.lineTo(cx + w * 0.80, cy - h * 0.10);
  ctx.closePath();
  ctx.fill();
  // Robe flare (back)
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.05, cy);
  ctx.quadraticCurveTo(cx - w * 0.45, cy + h * 0.15, cx - w * 0.20, cy + h * 0.45);
  ctx.lineTo(cx, cy + h * 0.40);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export async function renderCombinedCollage(
  photoUrls: string[],
  options?: { referenceImageUrl?: string | null; familyHighlightUrls?: string[] },
): Promise<Blob> {
  const W = 1600, H = 2000;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  drawTextureBg(ctx, W, H);

  // Title
  ctx.fillStyle = TEAL;
  ctx.textAlign = "center";
  ctx.font = "italic 40px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Primary Temple Trip", W / 2, 110);
  ctx.font = "600 34px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Families Can Be Together Forever", W / 2, 160);
  drawOrnament(ctx, W / 2, 188, 140);
  ctx.fillStyle = SLATE;
  ctx.font = "500 20px Inter, sans-serif";
  ctx.fillText("June 20, 2026", W / 2, 215);

  // Temple area
  const top = 245;
  const left = 100;
  const right = W - 100;
  const bottom = H - 90;
  const tw = right - left;
  const th = bottom - top;

  // Build a low-res mask (one cell per tile) of the temple silhouette.
  const tile = 42;            // smaller tile → more detail
  const cols = Math.floor(tw / tile);
  const rows = Math.floor(th / tile);
  const mask = await buildMask(cols, rows, options?.referenceImageUrl ?? null);

  // Collect cells inside silhouette
  type Cell = { c: number; r: number; x: number; y: number; prominence: number };
  const cells: Cell[] = [];
  const cxN = cols / 2;
  const cyN = rows * 0.55; // body center
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r * cols + c]) continue;
      // Prominence: closer to vertical axis & near spire = more prominent.
      // We'll boost prominence for the central column and upper-body areas.
      const dx = (c - cxN) / cols;
      const dy = (r - cyN) / rows;
      const centerDist = Math.sqrt(dx * dx + dy * dy);
      const prominence = 1 - Math.min(1, centerDist * 1.6);
      cells.push({ c, r, x: left + c * tile, y: top + r * tile, prominence });
    }
  }

  // Soft silhouette backdrop (golden halo)
  ctx.save();
  ctx.fillStyle = "rgba(219,191,150,0.30)";
  cells.forEach((c) => ctx.fillRect(c.x - 1, c.y - 1, tile + 2, tile + 2));
  // soft outer glow
  ctx.shadowColor = "rgba(184,151,95,0.35)";
  ctx.shadowBlur = 24;
  cells.forEach((c) => ctx.fillRect(c.x, c.y, tile, tile));
  ctx.restore();

  // Load photos
  const imgs: HTMLImageElement[] = [];
  for (const u of photoUrls) {
    try { imgs.push(await loadImage(u)); } catch {}
  }
  const highlights: HTMLImageElement[] = [];
  for (const u of options?.familyHighlightUrls ?? []) {
    try { highlights.push(await loadImage(u)); } catch {}
  }

  if (imgs.length === 0 && highlights.length === 0) {
    ctx.fillStyle = TEAL;
    cells.forEach((c) => ctx.fillRect(c.x + 3, c.y + 3, tile - 6, tile - 6));
  } else {
    // Sort cells by prominence (high → low). Most prominent cells get highlights,
    // then balanced distribution of remaining photos.
    const sorted = [...cells].sort((a, b) => b.prominence - a.prominence);
    const pool = highlights.length > 0
      ? [...highlights, ...imgs]
      : imgs.length > 0 ? imgs : highlights;

    sorted.forEach((cell, i) => {
      const img = pool[i % pool.length];
      ctx.save();
      roundRect(ctx, cell.x + 2, cell.y + 2, tile - 4, tile - 4, 5);
      ctx.clip();
      drawImageCover(ctx, img, cell.x + 2, cell.y + 2, tile - 4, tile - 4);
      ctx.restore();
    });
  }

  // Outline silhouette edges
  ctx.strokeStyle = "rgba(44,79,82,0.55)";
  ctx.lineWidth = 1.5;
  const has = (c: number, r: number) =>
    c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1;
  cells.forEach(({ c, r, x, y }) => {
    ctx.beginPath();
    if (!has(c, r - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + tile, y); }
    if (!has(c, r + 1)) { ctx.moveTo(x, y + tile); ctx.lineTo(x + tile, y + tile); }
    if (!has(c - 1, r)) { ctx.moveTo(x, y); ctx.lineTo(x, y + tile); }
    if (!has(c + 1, r)) { ctx.moveTo(x + tile, y); ctx.lineTo(x + tile, y + tile); }
    ctx.stroke();
  });

  // Find spire-tip cell (topmost filled cell, central column)
  let tipR = rows, tipC = Math.floor(cols / 2);
  for (let r = 0; r < rows; r++) {
    for (let c = Math.floor(cols * 0.4); c < Math.ceil(cols * 0.6); c++) {
      if (mask[r * cols + c]) { tipR = r; tipC = c; r = rows; break; }
    }
  }
  const tipX = left + (tipC + 0.5) * tile;
  const tipY = top + tipR * tile;

  // Angel Moroni topper above spire
  drawMoroni(ctx, tipX, tipY - 50, 70);

  // Footer ornament
  drawOrnament(ctx, W / 2, H - 50, 200);

  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

// Extract storage path from a public URL (everything after /photos/)
export function storagePathFromUrl(url: string): string | null {
  const m = url.match(/\/photos\/(.+)$/);
  return m ? m[1] : null;
}

// Collage generation utilities — pure canvas, no external deps.

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
const ORANGE = "#D17A5F";
const SLATE = "#3A3D40";

function drawTextureBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#F6EBDB");
  g.addColorStop(1, "#EAD9C2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // subtle radial light
  const r = ctx.createRadialGradient(w / 2, h * 0.3, 50, w / 2, h * 0.3, w * 0.8);
  r.addColorStop(0, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, w, h);
}

function drawOrnament(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx + size, cy);
  ctx.stroke();
  ctx.fillStyle = GOLD;
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

export async function renderFamilyCollage(opts: {
  familyName: string;
  photoUrls: string[];
}): Promise<Blob> {
  const W = 1200, H = 1600;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  drawTextureBg(ctx, W, H);

  // Inner border frame
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.strokeStyle = TEAL;
  ctx.lineWidth = 1;
  ctx.strokeRect(54, 54, W - 108, H - 108);

  // Title
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

  // Photo grid area
  const gridTop = 310;
  const gridLeft = 90;
  const gridRight = W - 90;
  const gridBottom = H - 180;
  const gw = gridRight - gridLeft;
  const gh = gridBottom - gridTop;

  const photos = opts.photoUrls.slice(0, 10);
  const imgs = await Promise.all(photos.map((u) => loadImage(u).catch(() => null)));
  const valid = imgs.filter((i): i is HTMLImageElement => !!i);

  const n = valid.length;
  // pick a tidy grid
  let cols = 2, rows = Math.ceil(n / 2);
  if (n >= 7) { cols = 3; rows = Math.ceil(n / 3); }
  if (n <= 3) { cols = 1; rows = n; }
  if (n === 4) { cols = 2; rows = 2; }
  if (n === 0) {
    ctx.fillStyle = SLATE;
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("No approved photos yet.", W / 2, gridTop + gh / 2);
  } else {
    const gap = 18;
    const cw = (gw - gap * (cols - 1)) / cols;
    const ch = (gh - gap * (rows - 1)) / rows;
    valid.forEach((img, i) => {
      const cIdx = i % cols;
      const rIdx = Math.floor(i / cols);
      const x = gridLeft + cIdx * (cw + gap);
      const y = gridTop + rIdx * (ch + gap);
      // shadow
      ctx.save();
      ctx.shadowColor = "rgba(58,61,64,0.25)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = CREAM;
      roundRect(ctx, x, y, cw, ch, 14);
      ctx.fill();
      ctx.restore();
      // image clipped
      ctx.save();
      roundRect(ctx, x + 8, y + 8, cw - 16, ch - 16, 10);
      ctx.clip();
      drawImageCover(ctx, img, x + 8, y + 8, cw - 16, ch - 16);
      ctx.restore();
    });
  }

  // Footer
  drawOrnament(ctx, W / 2, H - 130, 120);
  ctx.fillStyle = TEAL;
  ctx.font = "italic 28px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Families Can Be Together Forever", W / 2, H - 90);
  ctx.fillStyle = ORANGE;
  ctx.font = "500 14px Inter, sans-serif";
  ctx.fillText("A Primary Temple Trip keepsake", W / 2, H - 60);

  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
}

// ----- Temple silhouette mask -----
// Returns true if point (x,y) in [0..1] x [0..1] is inside silhouette.
function inTemple(nx: number, ny: number): boolean {
  // base rectangle
  if (ny >= 0.55 && ny <= 0.92 && nx >= 0.12 && nx <= 0.88) return true;
  // steps below
  if (ny > 0.92 && ny <= 0.96 && nx >= 0.08 && nx <= 0.92) return true;
  // side wings (lower, narrower)
  if (ny >= 0.62 && ny <= 0.85 && (nx < 0.12 && nx >= 0.04)) return true;
  if (ny >= 0.62 && ny <= 0.85 && (nx > 0.88 && nx <= 0.96)) return true;
  // center tower
  if (ny >= 0.28 && ny < 0.55 && nx >= 0.40 && nx <= 0.60) return true;
  // spire (triangle)
  if (ny >= 0.10 && ny < 0.28) {
    const t = (ny - 0.10) / (0.28 - 0.10); // 0 top -> 1 bottom
    const half = 0.04 + t * 0.06; // widens from 0.04 to 0.10
    if (nx >= 0.5 - half && nx <= 0.5 + half) return true;
  }
  // side towers (small) on top of base
  if (ny >= 0.42 && ny < 0.55) {
    if (nx >= 0.20 && nx <= 0.30) return true;
    if (nx >= 0.70 && nx <= 0.80) return true;
  }
  return false;
}

export async function renderCombinedCollage(photoUrls: string[]): Promise<Blob> {
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
  ctx.font = "600 30px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Families Can Be Together Forever", W / 2, 160);
  ctx.fillStyle = SLATE;
  ctx.font = "500 20px Inter, sans-serif";
  ctx.fillText("June 20, 2026", W / 2, 195);

  // Temple shape area
  const top = 230;
  const left = 80;
  const right = W - 80;
  const bottom = H - 100;
  const tw = right - left;
  const th = bottom - top;

  // Build tile list inside silhouette
  const tile = 64;
  const cols = Math.floor(tw / tile);
  const rows = Math.floor(th / tile);
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const nx = (c + 0.5) / cols;
      const ny = (r + 0.5) / rows;
      if (inTemple(nx, ny)) {
        cells.push({ x: left + c * tile, y: top + r * tile });
      }
    }
  }

  // Backdrop silhouette (gold halo behind)
  ctx.save();
  ctx.fillStyle = "rgba(219,191,150,0.35)";
  cells.forEach((c) => ctx.fillRect(c.x - 2, c.y - 2, tile + 4, tile + 4));
  ctx.restore();

  if (photoUrls.length === 0) {
    ctx.fillStyle = TEAL;
    cells.forEach((c) => ctx.fillRect(c.x + 4, c.y + 4, tile - 8, tile - 8));
  } else {
    const imgs: HTMLImageElement[] = [];
    for (const u of photoUrls) {
      try { imgs.push(await loadImage(u)); } catch {}
    }
    if (imgs.length === 0) {
      ctx.fillStyle = TEAL;
      cells.forEach((c) => ctx.fillRect(c.x + 4, c.y + 4, tile - 8, tile - 8));
    } else {
      cells.forEach((c, i) => {
        const img = imgs[i % imgs.length];
        ctx.save();
        roundRect(ctx, c.x + 2, c.y + 2, tile - 4, tile - 4, 6);
        ctx.clip();
        drawImageCover(ctx, img, c.x + 2, c.y + 2, tile - 4, tile - 4);
        ctx.restore();
      });
    }
  }

  // subtle outline around silhouette: paint cells border by detecting edges
  ctx.strokeStyle = "rgba(44,79,82,0.5)";
  ctx.lineWidth = 1.5;
  cells.forEach((c) => {
    // draw edges that don't have neighbor cells
    const neighbors = {
      top: cells.some((o) => o.x === c.x && o.y === c.y - tile),
      bottom: cells.some((o) => o.x === c.x && o.y === c.y + tile),
      left: cells.some((o) => o.x === c.x - tile && o.y === c.y),
      right: cells.some((o) => o.x === c.x + tile && o.y === c.y),
    };
    ctx.beginPath();
    if (!neighbors.top) { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + tile, c.y); }
    if (!neighbors.bottom) { ctx.moveTo(c.x, c.y + tile); ctx.lineTo(c.x + tile, c.y + tile); }
    if (!neighbors.left) { ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y + tile); }
    if (!neighbors.right) { ctx.moveTo(c.x + tile, c.y); ctx.lineTo(c.x + tile, c.y + tile); }
    ctx.stroke();
  });

  // ornament at top of spire
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.arc(W / 2, top + 0.10 * th - 8, 10, 0, Math.PI * 2);
  ctx.fill();

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

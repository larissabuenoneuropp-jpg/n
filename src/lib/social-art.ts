"use client";
// Gera as artes (1080×1350, formato retrato do feed) nas cores da identidade visual.

const THEMES = [
  { bg: "#faf3ec", title: "#9c5f42", text: "#3a3330", accent: "#e6c983" },
  { bg: "#b5663f", title: "#ffffff", text: "#fff7f0", accent: "#e6c983" },
  { bg: "#6f7660", title: "#ffffff", text: "#f4f5f0", accent: "#d2bda0" },
  { bg: "#a7cbcb", title: "#2f3a3a", text: "#2f3a3a", accent: "#faf3ec" },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  text.split("\n").forEach((para) => {
    let line = "";
    para.split(/\s+/).forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    lines.push(line);
  });
  return lines;
}

function fontOf(selector: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const el = document.createElement("span");
  el.className = selector;
  document.body.appendChild(el);
  const f = getComputedStyle(el).fontFamily;
  el.remove();
  return f || fallback;
}

let logoPromise: Promise<HTMLImageElement | null> | null = null;
function loadLogo(src = "/brand/logo.png") {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  return logoPromise;
}

export async function renderSlide(opts: { title: string; text: string; index: number; total: number; handle?: string; cover?: boolean }) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  await document.fonts?.ready;
  const display = fontOf("font-display", "sans-serif");
  const body = fontOf("font-sans", "sans-serif");
  const isLast = opts.index === opts.total - 1 && opts.total > 1;
  const t = opts.cover ? THEMES[1] : THEMES[opts.index % THEMES.length];

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);
  // sol decorativo (elemento da marca)
  ctx.strokeStyle = t.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(W - 120, 150, 70, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    ctx.beginPath();
    ctx.moveTo(W - 120 + Math.cos(a) * 95, 150 + Math.sin(a) * 95);
    ctx.lineTo(W - 120 + Math.cos(a) * 125, 150 + Math.sin(a) * 125);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const pad = 110;
  const titleSize = opts.cover ? 92 : 76;
  const titleLead = opts.cover ? 108 : 90;
  ctx.font = `700 ${titleSize}px ${display}`;
  const titleLines = wrap(ctx, opts.title, W - pad * 2);
  ctx.font = `400 46px ${body}`;
  const textLines = wrap(ctx, opts.text, W - pad * 2).slice(0, 12);
  // Centraliza o bloco de texto na área útil (abaixo do sol e acima do rodapé/logo)
  const blockH = titleLines.length * titleLead + 30 + textLines.length * 64;
  const top = 300, bottom = isLast || opts.cover ? H - 380 : H - 160;
  let y = Math.max(top, top + (bottom - top - blockH) / 2) + titleSize * 0.8;

  ctx.fillStyle = t.title;
  ctx.font = `700 ${titleSize}px ${display}`;
  titleLines.forEach((l) => { ctx.fillText(l, pad, y); y += titleLead; });
  y += 30;
  ctx.fillStyle = t.text;
  ctx.font = `400 46px ${body}`;
  textLines.forEach((l) => { ctx.fillText(l, pad, y); y += 64; });

  if (isLast || opts.cover) {
    const logo = await loadLogo();
    if (logo) {
      const lw = 420, lh = (logo.height / logo.width) * lw;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect?.(pad - 30, H - 330, lw + 60, lh + 60, 28);
      ctx.fill();
      ctx.drawImage(logo, pad, H - 300, lw, lh);
    }
  }

  ctx.fillStyle = t.text;
  ctx.globalAlpha = 0.8;
  ctx.font = `600 32px ${body}`;
  if (opts.handle) ctx.fillText(opts.handle, pad, H - 70);
  if (opts.total > 1 && !opts.cover) {
    const label = `${opts.index + 1}/${opts.total}`;
    ctx.fillText(label, W - pad - ctx.measureText(label).width, H - 70);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export async function slideBlob(opts: Parameters<typeof renderSlide>[0]) {
  const canvas = await renderSlide(opts);
  return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
}

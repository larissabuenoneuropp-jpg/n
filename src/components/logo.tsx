"use client";

/** Marca do app nas cores da identidade visual (terracota, areia, sálvia, azul-água). */
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect x="0" y="0" width="15" height="15" rx="4" fill="#cd926d" />
        <rect x="17" y="0" width="15" height="15" rx="4" fill="#d2bda0" />
        <rect x="0" y="17" width="15" height="15" rx="4" fill="#a7cbcb" />
        <rect x="17" y="17" width="15" height="15" rx="4" fill="#979d84" />
        <circle cx="24.5" cy="24.5" r="3" fill="#fff" opacity=".85" />
      </svg>
      {!compact && <span className="font-display text-[15px] font-semibold tracking-tight text-ink">NeuroPlanner</span>}
    </div>
  );
}

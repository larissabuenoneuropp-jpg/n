"use client";
import { useId } from "react";

export function Logo({ compact }: { compact?: boolean }) {
  const gid = useId();
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5b6ef0" />
            <stop offset="1" stopColor="#9a6cf5" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
        <path d="M10 22V10l12 12V10" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="22" cy="10" r="2" fill="white" />
      </svg>
      {!compact && <span className="text-[15px] font-semibold tracking-tight text-ink">NeuroPlanner</span>}
    </div>
  );
}

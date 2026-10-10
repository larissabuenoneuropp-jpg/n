"use client";
import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn, initials } from "@/lib/utils";

/* ---------------------------------- Button --------------------------------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "ai";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-canvas",
  ghost: "text-ink-soft hover:bg-canvas hover:text-ink",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  ai: "bg-gradient-to-r from-brand-500 to-lilac-500 text-white hover:opacity-95 shadow-sm",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }
>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* ---------------------------------- Card ----------------------------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-white shadow-card", className)} {...props} />;
}
export function CardHeader({ title, action, icon, subtitle }: { title: string; action?: React.ReactNode; icon?: React.ReactNode; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-brand-500">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ---------------------------------- Inputs --------------------------------- */
/** Largura total por padrão, a menos que a classe recebida já defina uma largura. */
const widthOf = (className?: string) => (/(^|\s)(\w+:)?w-/.test(className ?? "") ? "" : "w-full");
const inputBase =
  "rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputBase, widthOf(className), "h-9", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(inputBase, widthOf(className), "py-2 leading-relaxed", className)} {...props} />;
  },
);

export function Select({
  options,
  className,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string } | string>; placeholder?: string }) {
  return (
    <select className={cn(inputBase, widthOf(className), "h-9 pr-8", className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

/* ---------------------------------- Badge ---------------------------------- */
const tones = {
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-brand-50 text-brand-700",
  lilac: "bg-lilac-100 text-lilac-600",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
};
export type Tone = keyof typeof tones;
export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}

/* ---------------------------------- Avatar --------------------------------- */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-lilac-200 font-semibold text-brand-800"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------------------------- Modal ---------------------------------- */
export function Modal({
  open, onClose, title, children, footer, wide,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn("flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-ink-faint hover:bg-canvas hover:text-ink" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------- Tabs ----------------------------------- */
export function Tabs<T extends string>({
  tabs, value, onChange,
}: { tabs: Array<{ value: T; label: string; icon?: React.ReactNode }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition",
            value === t.value ? "border-brand-500 font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink",
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1 text-xs font-medium transition", value === o.value ? "bg-white text-ink shadow-card" : "text-ink-soft hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Misc / layout ------------------------------ */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {icon && <div className="mb-3 rounded-xl bg-brand-50 p-3 text-brand-500">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-xs text-ink-faint">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10 text-ink-faint", className)}>
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

export function AiNotice({ demo }: { demo?: boolean }) {
  return (
    <p className="rounded-lg bg-lilac-50 px-3 py-2 text-[11px] leading-relaxed text-lilac-600">
      Sugestão gerada por IA para apoio — revise e edite. Ela não substitui seu julgamento clínico.
      {demo && " (Modo demonstração: resposta de exemplo, configure a chave da OpenAI para respostas reais.)"}
    </p>
  );
}

/* ---------------------------------- Toast ---------------------------------- */
interface ToastItem { id: number; text: string; tone: "ok" | "error" }
const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex flex-col gap-2 lg:bottom-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto rounded-lg px-4 py-2.5 text-sm shadow-pop",
              t.tone === "ok" ? "bg-ink text-white" : "bg-red-600 text-white",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Lista editável de itens de texto (objetivos, metas...). */
export function ListEditor({
  items, onChange, placeholder,
}: { items: string[]; onChange: (items: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <Button variant="ghost" size="sm" type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remover">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onChange([...items, draft.trim()]);
              setDraft("");
            }
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          type="button"
          className="h-9"
          onClick={() => {
            if (!draft.trim()) return;
            onChange([...items, draft.trim()]);
            setDraft("");
          }}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}

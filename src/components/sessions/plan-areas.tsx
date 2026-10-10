"use client";
import { useState } from "react";
import { BookmarkPlus, Plus, Trash2, X } from "lucide-react";
import { Button, Input, Select, useToast } from "@/components/ui";
import { useData } from "@/lib/data/provider";
import { objectiveBank } from "@/lib/objective-bank";
import type { PlanArea } from "@/lib/types";
import { uid } from "@/lib/utils";

/** Plano de intervenção dividido por área: escolha a área e depois os objetivos dentro dela. */
export function PlanAreasEditor({ value, onChange }: { value: PlanArea[]; onChange: (v: PlanArea[]) => void }) {
  const { profile, store, refreshProfile } = useData();
  const toast = useToast();
  const bank = objectiveBank(profile);
  const [newArea, setNewArea] = useState("");
  const [customArea, setCustomArea] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const unused = Object.keys(bank).filter((a) => !value.some((v) => v.area === a));

  const setArea = (id: string, patch: Partial<PlanArea>) => onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  function addArea() {
    const name = newArea === "__outra" ? customArea.trim() : newArea;
    if (!name) return;
    if (value.some((a) => a.area.toLowerCase() === name.toLowerCase())) return toast("Essa área já está no plano.", "error");
    onChange([...value, { id: uid(), area: name, objectives: [] }]);
    setNewArea("");
    setCustomArea("");
  }

  async function saveToBank(area: string, text: string) {
    const current = profile?.objective_bank ?? {};
    const list = Array.from(new Set([...(current[area] ?? []), text]));
    await store.saveProfile({ objective_bank: { ...current, [area]: list } });
    await refreshProfile();
    toast("Objetivo salvo no seu banco");
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-xs text-ink-faint">Nenhuma área ainda. Escolha as áreas de intervenção e depois os objetivos de cada uma.</p>}
      {value.map((a) => {
        const chosen = new Set(a.objectives.map((o) => o.text));
        const options = (bank[a.area] ?? []).filter((t) => !chosen.has(t));
        return (
          <div key={a.id} className="rounded-xl border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Input className="h-8 max-w-sm font-display font-semibold text-brand-700" value={a.area} onChange={(e) => setArea(a.id, { area: e.target.value })} aria-label="Nome da área" />
              <Button variant="ghost" size="sm" onClick={() => { if (!a.objectives.length || confirm(`Remover a área "${a.area}" e seus objetivos?`)) onChange(value.filter((x) => x.id !== a.id)); }} aria-label="Remover área">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <ul className="space-y-1.5">
              {a.objectives.map((o, i) => (
                <li key={o.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs text-ink-faint">{i + 1}.</span>
                  <Input value={o.text} onChange={(e) => setArea(a.id, { objectives: a.objectives.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} />
                  {!(bank[a.area] ?? []).includes(o.text) && o.text.trim() && (
                    <Button variant="ghost" size="sm" className="h-9 shrink-0" title="Salvar no meu banco de objetivos" onClick={() => saveToBank(a.area, o.text.trim())}>
                      <BookmarkPlus className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={() => setArea(a.id, { objectives: a.objectives.filter((x) => x.id !== o.id) })} aria-label="Remover objetivo">
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1.5fr_1fr]">
              {options.length > 0 ? (
                <Select value="" onChange={(e) => e.target.value && setArea(a.id, { objectives: [...a.objectives, { id: uid(), text: e.target.value }] })}
                  placeholder={`Escolher objetivo de ${a.area}…`} options={options} />
              ) : <span className="text-xs text-ink-faint">Todos os objetivos do banco desta área já foram escolhidos.</span>}
              <div className="flex gap-2">
                <Input placeholder="Ou escreva outro" value={drafts[a.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && drafts[a.id]?.trim()) {
                      e.preventDefault();
                      setArea(a.id, { objectives: [...a.objectives, { id: uid(), text: drafts[a.id].trim() }] });
                      setDrafts({ ...drafts, [a.id]: "" });
                    }
                  }} />
                <Button variant="secondary" size="sm" className="h-9 shrink-0" onClick={() => {
                  if (!drafts[a.id]?.trim()) return;
                  setArea(a.id, { objectives: [...a.objectives, { id: uid(), text: drafts[a.id].trim() }] });
                  setDrafts({ ...drafts, [a.id]: "" });
                }} aria-label="Adicionar objetivo"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Select className="w-64" value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="Adicionar área de intervenção…"
          options={[...unused, { value: "__outra", label: "Outra área…" }]} />
        {newArea === "__outra" && <Input className="w-56" placeholder="Nome da área" value={customArea} onChange={(e) => setCustomArea(e.target.value)} />}
        <Button variant="secondary" onClick={addArea} disabled={!newArea}><Plus className="h-4 w-4" /> Área</Button>
      </div>
    </div>
  );
}

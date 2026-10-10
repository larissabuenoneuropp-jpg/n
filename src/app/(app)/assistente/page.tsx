"use client";
import { useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { AiNotice, Button, Card, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/data/provider";
import { askAI, patientContext } from "@/lib/ai/client";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; text: string; demo?: boolean }

const SUGGESTIONS = [
  "Quais estratégias baseadas em evidências posso usar para consciência fonológica?",
  "Como adaptar atividades de funções executivas para uma criança com TDAH de 8 anos?",
  "Sugira orientações para a escola de um aluno com dislexia.",
  "Quais sinais indicam necessidade de encaminhamento para fonoaudiologia?",
];

export default function AssistantPage() {
  const toast = useToast();
  const patients = useCollection("patients", { orderBy: "name", ascending: true });
  const [patientId, setPatientId] = useState("");
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text = input) {
    if (!text.trim()) return;
    const next: Msg[] = [...msgs, { role: "user", text }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const p = patients.data.find((x) => x.id === patientId);
      const r = await askAI<{ answer: string }>("chat", {
        pergunta: text,
        contexto_paciente: p ? patientContext(p) : undefined,
        conversa_anterior: next.slice(-8, -1).map((m) => ({ papel: m.role, texto: m.text })),
      });
      setMsgs([...next, { role: "assistant", text: r.result.answer, demo: r.demo }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erro na IA", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Assistente clínica" subtitle="IA especializada em Neuropsicopedagogia — apoio, nunca substituição do seu julgamento" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="flex min-h-[60vh] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {msgs.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-3 rounded-2xl bg-linear-to-br from-brand-100 to-sage-200 p-3 text-brand-700"><Sparkles className="h-6 w-6" /></div>
                <p className="font-medium">Como posso ajudar hoje?</p>
                <div className="mt-4 grid max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl border border-line p-3 text-left text-xs text-ink-soft hover:border-brand-200 hover:text-ink">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-brand-600 text-white" : "bg-canvas text-ink")}>
                    {m.text}
                    {m.demo && <p className="mt-1 text-[10px] opacity-70">(modo demonstração)</p>}
                  </div>
                </div>
              ))
            )}
            {loading && <p className="text-xs text-ink-faint">A assistente está escrevendo…</p>}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <Textarea rows={1} className="min-h-[38px] resize-none" placeholder="Pergunte algo…" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button onClick={() => send()} loading={loading} aria-label="Enviar"><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
        <div className="space-y-3">
          <Card className="p-4">
            <p className="mb-2 text-xs font-medium text-ink-soft">Contexto de paciente (opcional)</p>
            <Select value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="Nenhum" options={patients.data.map((p) => ({ value: p.id, label: p.name }))} />
            <p className="mt-2 text-[11px] text-ink-faint">São enviados apenas idade, ano escolar e dados clínicos — nunca nome ou contatos.</p>
          </Card>
          <AiNotice />
        </div>
      </div>
    </>
  );
}

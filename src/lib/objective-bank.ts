// Banco de objetivos por área de intervenção. A profissional pode acrescentar os seus (Configurações / plano).
import type { PlanArea, Profile, TextItem } from "@/lib/types";
import { uid } from "@/lib/utils";

export const DEFAULT_OBJECTIVE_BANK: Record<string, string[]> = {
  "Consciência fonológica": [
    "Identificar rimas em pares de palavras",
    "Identificar palavras que começam com o mesmo som (aliteração)",
    "Segmentar palavras em sílabas",
    "Realizar síntese silábica",
    "Realizar subtração e transposição silábica",
    "Identificar o fonema inicial e final de palavras",
    "Segmentar palavras em fonemas",
  ],
  "Alfabetização": [
    "Reconhecer e nomear as letras do alfabeto",
    "Estabelecer correspondência grafema-fonema",
    "Combinar letras para formar sílabas simples (CV)",
    "Ler sílabas complexas (CCV, CVC)",
    "Escrever palavras com apoio do alfabeto móvel",
    "Avançar no nível de escrita (hipótese silábico-alfabética para alfabética)",
  ],
  "Leitura e compreensão": [
    "Ler palavras regulares com precisão",
    "Ler pseudopalavras (rota fonológica)",
    "Aumentar a fluência leitora",
    "Responder perguntas literais sobre o texto",
    "Realizar inferências simples a partir do texto",
    "Recontar a história em sequência lógica",
  ],
  "Escrita e ortografia": [
    "Escrever palavras sob ditado com correspondência adequada",
    "Reduzir trocas de grafemas com sons semelhantes (p/b, t/d, f/v)",
    "Segmentar corretamente as palavras na escrita",
    "Produzir frases com sentido completo",
    "Planejar e produzir pequenos textos com começo, meio e fim",
    "Revisar a própria escrita com apoio de checklist",
  ],
  "Matemática": [
    "Reconhecer e nomear números",
    "Realizar contagem com correspondência termo a termo",
    "Compreender relações de quantidade (mais, menos, igual)",
    "Compreender o sistema de numeração decimal (unidade e dezena)",
    "Resolver adições e subtrações simples",
    "Resolver situações-problema do cotidiano",
  ],
  "Atenção": [
    "Manter a atenção sustentada na tarefa por tempo progressivamente maior",
    "Selecionar estímulos relevantes ignorando distratores (atenção seletiva)",
    "Alternar o foco entre duas tarefas (atenção alternada)",
    "Concluir as tarefas iniciadas",
  ],
  "Funções executivas": [
    "Planejar as etapas antes de executar a tarefa",
    "Monitorar e corrigir os próprios erros (automonitoramento)",
    "Esperar a vez e controlar respostas impulsivas (controle inibitório)",
    "Adaptar-se a mudanças de regra (flexibilidade cognitiva)",
    "Organizar materiais e tempo com apoio visual",
  ],
  "Memória": [
    "Ampliar a memória operacional visuoespacial",
    "Ampliar a memória operacional auditiva (sequências verbais e numéricas)",
    "Utilizar estratégias de memorização (agrupamento, repetição, associação)",
    "Evocar informações aprendidas em sessões anteriores",
  ],
  "Linguagem oral": [
    "Ampliar o vocabulário receptivo e expressivo",
    "Compreender e seguir instruções com duas ou mais etapas",
    "Organizar o discurso narrativo",
    "Elaborar frases completas e coerentes",
  ],
  "Coordenação motora e psicomotricidade": [
    "Aprimorar a coordenação motora fina (pinça, recorte, traçado)",
    "Aprimorar a preensão do lápis e o traçado das letras",
    "Desenvolver equilíbrio e coordenação motora global",
    "Consolidar a lateralidade e as noções espaciais",
    "Desenvolver o planejamento motor",
  ],
  "Habilidades sociais": [
    "Iniciar e manter interações com o outro",
    "Esperar a vez e respeitar regras em jogos",
    "Reconhecer emoções em si e nos outros",
    "Lidar com a frustração de perder em jogos",
  ],
  "Regulação emocional e comportamento": [
    "Nomear as próprias emoções",
    "Utilizar estratégias de autorregulação diante da frustração",
    "Engajar-se em tarefas não preferidas com apoio",
    "Ampliar a tolerância a mudanças na rotina",
  ],
  "Autonomia e organização": [
    "Organizar o material escolar com autonomia",
    "Seguir rotina visual de estudo",
    "Iniciar tarefas sem necessidade de mediação constante",
  ],
};

/** Banco combinado (padrão + objetivos adicionados pela profissional). */
export function objectiveBank(profile: Profile | null): Record<string, string[]> {
  const custom = profile?.objective_bank ?? {};
  const out: Record<string, string[]> = {};
  const areas = Array.from(new Set([...Object.keys(DEFAULT_OBJECTIVE_BANK), ...Object.keys(custom)]));
  areas.forEach((a) => { out[a] = Array.from(new Set([...(DEFAULT_OBJECTIVE_BANK[a] ?? []), ...(custom[a] ?? [])])); });
  return out;
}

/** Converte a lista legada de objetivos específicos em áreas (quando o plano ainda não tem áreas). */
export function areasOf(plan: { areas?: PlanArea[]; specific_objectives?: TextItem[] }): PlanArea[] {
  if (plan.areas?.length) return plan.areas;
  const objs = plan.specific_objectives ?? [];
  if (!objs.length) return [];
  const groups = new Map<string, TextItem[]>();
  objs.forEach((o) => {
    const m = o.text.match(/^([^:]{3,60}):\s*(.+)$/);
    const area = m ? m[1].trim() : "Geral";
    const text = m ? m[2].trim() : o.text;
    groups.set(area, [...(groups.get(area) ?? []), { id: o.id, text }]);
  });
  return Array.from(groups, ([area, objectives]) => ({ id: uid(), area, objectives }));
}

/** Lista plana ("Área: objetivo") mantida para relatórios, IA e compatibilidade. */
export function flattenAreas(areas: PlanArea[]): TextItem[] {
  return areas.flatMap((a) => a.objectives.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: `${a.area}: ${o.text}` })));
}

/** Opções de área para o seletor de objetivos: áreas do plano primeiro, depois o restante do banco. */
export function buildAreaOptions(planAreas: PlanArea[], bank: Record<string, string[]>) {
  const fromPlan = planAreas.map((a) => ({
    area: a.area,
    objectives: Array.from(new Set([...a.objectives.map((o) => o.text).filter(Boolean), ...(bank[a.area] ?? [])])),
    fromPlan: true,
  }));
  const used = new Set(fromPlan.map((a) => a.area));
  const rest = Object.entries(bank).filter(([a]) => !used.has(a)).map(([area, objectives]) => ({ area, objectives }));
  return [...fromPlan, ...rest];
}

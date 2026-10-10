// Importação de pacientes a partir de documentos (anamneses, RAN, fichas) e planilhas organizadas no Drive.
// A extração é feita localmente por regras (nenhum dado sai do sistema). A IA é opcional e só com consentimento.
import type { Patient } from "@/lib/types";
import { toISODate } from "@/lib/utils";

export const IMPORT_FIELDS = {
  name: "Nome da criança",
  birth_date: "Data de nascimento",
  guardian_name: "Responsável (nome)",
  guardian_relation: "Parentesco",
  guardian_phone: "Telefone",
  guardian_email: "E-mail",
  guardian_cpf: "CPF do responsável",
  guardian_rg: "RG do responsável",
  school: "Escola",
  grade: "Escolaridade / ano",
  teacher: "Professor(a)",
  handedness: "Dominância manual",
  diagnosis: "Diagnóstico",
  hypotheses: "Hipóteses diagnósticas",
  referred_by: "Encaminhado por",
  medications: "Medicamentos",
  complaints: "Queixa",
  history: "Histórico do desenvolvimento e saúde",
  family_history: "Antecedentes familiares",
  personality: "Jeito de ser da criança",
  school_history: "Vida escolar",
  notes: "Observações / conclusões",
  street: "Rua", number: "Número", district: "Bairro", city: "Cidade", state: "UF", zip: "CEP",
  session_value: "Valor da sessão", assessment_value: "Valor da avaliação", weekly_frequency: "Sessões por semana",
  payment_type: "Particular / convênio", insurance_name: "Convênio", start_date: "Data de início",
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
export type ImportData = Partial<Record<ImportField, string>>;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Converte datas em dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd ou número serial do Excel para AAAA-MM-DD. */
export function parseDateBR(v?: string) {
  if (!v) return "";
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? "" : toISODate(d);
  }
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return "";
}

const LABELS: Array<[ImportField, RegExp]> = [
  ["name", /(?:nome\s+(?:da\s+crian[çc]a|do\s+paciente|da\s+paciente|completo)|paciente|crian[çc]a|aluno\(?a?\)?)\s*:\s*([^\n|]+)/i],
  ["birth_date", /(?:data\s+de\s+nascimento|nascimento|d\.?\s?n\.?)\s*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i],
  ["school", /\bescola\s*:\s*([^\n|]+)/i],
  ["grade", /(?:escolaridade|s[ée]rie|ano\s+escolar|turma)\s*:\s*([^\n|]+)/i],
  ["teacher", /professor(?:a|\(a\))?\s*:\s*([^\n|]+)/i],
  ["diagnosis", /diagn[óo]stico(?:\s+pr[ée]vio)?\s*:\s*([^\n|]+)/i],
  ["hypotheses", /hip[óo]teses?(?:\s+diagn[óo]sticas?)?\s*:\s*([^\n|]+)/i],
  ["referred_by", /encaminhad[oa]\s+por\s*:\s*([^\n|]+)/i],
  ["medications", /(?:faz\s+uso\s+de\s+medicamentos?|medica[çc][ãa]o|medicamentos?)\s*:\s*([^\n|]+)/i],
  ["guardian_phone", /(?:telefone|celular|whats\s?app|contato)s?\s*:\s*([()+\d\s.-]{8,})/i],
  ["guardian_cpf", /cpf(?:\s+do\s+respons[áa]vel)?\s*:\s*([\d.\-/]{11,18})/i],
  ["guardian_rg", /\brg\s*:\s*([\w.\-/]{5,15})/i],
  ["street", /(?:endere[çc]o|rua)\s*:\s*([^\n|]+)/i],
  ["district", /bairro\s*:\s*([^\n|]+)/i],
  ["city", /cidade(?:\/uf)?\s*:\s*([^\n|/]+)/i],
  ["zip", /cep\s*:\s*([\d.-]{5,10})/i],
];

/** Seções do documento (títulos em caixa alta, numerados ou não) → campo do prontuário. */
const SECTIONS: Array<[ImportField, RegExp]> = [
  ["complaints", /^(queixa|queixa principal|motivo do encaminhamento|motivo da consulta)/],
  ["history", /^(historico do desenvolvimento|historico de saude|historico clinico|gestacao|desenvolvimento neuropsicomotor|desenvolvimento|saude)/],
  ["family_history", /^(antecedentes familiares|historico familiar|dinamica familiar|composicao familiar)/],
  ["personality", /^(jeito de ser)/],
  ["school_history", /^(vida escolar|historico escolar|escolaridade|aspectos escolares)/],
  ["notes", /^(conclusao|indicacoes|consideracoes finais|encaminhamentos)/],
];

function isHeading(line: string) {
  const t = line.trim().replace(/\s*\|\s*$/, "");
  if (t.length < 4 || t.length > 90) return false;
  const body = t.replace(/^\d+(\.\d+)*\.?\s*/, "");
  return body.length >= 4 && body === body.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3}/.test(body) && !/:\s*\S/.test(body);
}

export type DocKind = "relatorio" | "anamnese" | "contrato" | "laudo" | "outro";
export function detectDocKind(text: string): DocKind {
  const head = norm(text.slice(0, 600));
  if (/relatorio|ran\b/.test(head)) return "relatorio";
  if (/anamnese/.test(head)) return "anamnese";
  if (/contrato/.test(head)) return "contrato";
  if (/laudo/.test(head)) return "laudo";
  return "outro";
}

/** Extrai dados do paciente de um documento por rótulos ("Nome da criança: ...") e seções ("2. QUEIXA"). */
export function parseDocumentText(text: string): ImportData {
  const data: ImportData = {};
  for (const [field, re] of LABELS) {
    const m = text.match(re);
    if (m?.[1]?.trim() && !data[field]) data[field] = m[1].trim().replace(/\s{2,}/g, " ").replace(/[.;,]$/, "");
  }
  if (data.birth_date) data.birth_date = parseDateBR(data.birth_date);
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) data.guardian_email = email[0];

  const mother = text.match(/nome\s+da\s+m[ãa]e\s*:\s*([^\n|]+)/i);
  const father = text.match(/nome\s+do\s+pai\s*:\s*([^\n|]+)/i);
  const resp = text.match(/respons[áa]vel(?:\s+legal)?\s*:\s*([^\n|]+)/i);
  if (mother?.[1]?.trim()) { data.guardian_name = mother[1].trim(); data.guardian_relation = "Mãe"; }
  else if (father?.[1]?.trim()) { data.guardian_name = father[1].trim(); data.guardian_relation = "Pai"; }
  else if (resp?.[1]?.trim()) data.guardian_name = resp[1].trim();

  const hand = text.match(/domin[âa]ncia\s+manual[^\n]*/i)?.[0] ?? "";
  // Formato "( X ) Destro ( ) Canhoto" (parêntese antes da opção) ou "Destro ( X ) Canhoto ( )" (depois)
  const prefix = /\(\s*x?\s*\)\s*(destr|canhot)/i.test(hand) && /^[^(]*\(\s*x?\s*\)\s*destr/i.test(hand.replace(/^.*?:/, ""));
  const marked = (label: string) => prefix
    ? new RegExp(`\\(\\s*x\\s*\\)\\s*${label}`, "i").test(hand)
    : new RegExp(`${label}[oa]?\\s*\\(\\s*x\\s*\\)`, "i").test(hand);
  if (marked("destr")) data.handedness = "destro";
  else if (marked("canhot")) data.handedness = "canhoto";

  // Seções
  const lines = text.split("\n");
  let current: ImportField | null = null;
  const chunks: Partial<Record<ImportField, string[]>> = {};
  for (const line of lines) {
    if (isHeading(line)) {
      const title = norm(line.replace(/^\s*\d+(\.\d+)*\.?\s*/, ""));
      current = SECTIONS.find(([, re]) => re.test(title))?.[0] ?? null;
      if (current) chunks[current] = chunks[current] ?? [];
      continue;
    }
    if (current && line.trim()) chunks[current]!.push(line.trim());
  }
  (Object.keys(chunks) as ImportField[]).forEach((k) => {
    const v = chunks[k]!.join("\n\n").trim();
    if (v) data[k] = data[k] ? `${data[k]}\n\n${v}` : v;
  });
  if (data.notes && detectDocKind(text) === "relatorio") data.notes = `Conclusões/indicações do relatório importado:\n${data.notes}`;
  return data;
}

/** Sugere o campo de cada coluna da planilha a partir do cabeçalho. */
export function guessColumn(header: string): ImportField | "" {
  const h = norm(header);
  const rules: Array<[ImportField, RegExp]> = [
    ["birth_date", /nasc|^dn$|data de nascimento/],
    ["guardian_cpf", /cpf/],
    ["guardian_rg", /^rg\b/],
    ["guardian_email", /e-?mail/],
    ["guardian_phone", /tel|cel|whats|contato|fone/],
    ["guardian_relation", /parentesco|vinculo/],
    ["guardian_name", /respons|mae|pai|familiar/],
    ["assessment_value", /valor.*aval/],
    ["session_value", /valor|preco|sessao \(r\$\)/],
    ["weekly_frequency", /frequ|sessoes.*semana|vezes/],
    ["start_date", /inicio|entrada/],
    ["insurance_name", /convenio|plano de saude/],
    ["school", /escola|colegio/],
    ["grade", /serie|ano|turma|escolaridade/],
    ["teacher", /professor/],
    ["diagnosis", /diagn/],
    ["hypotheses", /hipot/],
    ["complaints", /queixa|motivo|demanda/],
    ["referred_by", /encaminh/],
    ["medications", /medica/],
    ["street", /endereco|rua|logradouro/],
    ["number", /^n(umero|º|o)?$/],
    ["district", /bairro/],
    ["city", /cidade|municipio/],
    ["state", /^uf$|estado/],
    ["zip", /cep/],
    ["notes", /obs|anota/],
    ["name", /nome|paciente|crianca|aluno/],
  ];
  return rules.find(([, re]) => re.test(h))?.[0] ?? "";
}

/** Converte os dados extraídos em campos do paciente. */
export function toPatient(d: ImportData): Partial<Patient> {
  const num = (v?: string) => (v ? Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) || 0 : undefined);
  const anamnesis = Object.fromEntries(
    (["complaints", "history", "family_history", "personality", "school_history", "medications"] as const)
      .filter((k) => d[k]).map((k) => [k, d[k]]),
  );
  const conv = d.payment_type && /conv/i.test(d.payment_type);
  return {
    name: d.name?.trim(),
    birth_date: parseDateBR(d.birth_date) || null,
    guardians: d.guardian_name || d.guardian_phone ? [{
      name: d.guardian_name ?? "", relation: d.guardian_relation ?? "", phone: d.guardian_phone ?? "",
      email: d.guardian_email, cpf: d.guardian_cpf, rg: d.guardian_rg,
    }] : [],
    phones: d.guardian_phone, email: d.guardian_email, school: d.school, grade: d.grade, teacher: d.teacher,
    handedness: d.handedness === "destro" || d.handedness === "canhoto" || d.handedness === "ambidestro" ? d.handedness : undefined,
    diagnosis: d.diagnosis, hypotheses: d.hypotheses, referred_by: d.referred_by, notes: d.notes,
    session_value: num(d.session_value), assessment_value: num(d.assessment_value), weekly_frequency: num(d.weekly_frequency),
    payment_type: conv ? "convenio" : "particular", insurance_name: d.insurance_name,
    start_date: parseDateBR(d.start_date) || null,
    address: { street: d.street, number: d.number, district: d.district, city: d.city, state: d.state?.toUpperCase().slice(0, 2), zip: d.zip },
    anamnesis,
    status: "ativo",
  };
}

/** Mescla com um paciente existente sem apagar o que já está preenchido. */
export function mergeIntoExisting(existing: Patient, incoming: Partial<Patient>): Partial<Patient> {
  const pick = <T,>(a: T | undefined | null, b: T | undefined | null) => (a !== undefined && a !== null && a !== "" ? a : b ?? undefined);
  const g0 = existing.guardians?.[0];
  const ig = incoming.guardians?.[0];
  return {
    birth_date: pick(existing.birth_date, incoming.birth_date) ?? null,
    school: pick(existing.school, incoming.school), grade: pick(existing.grade, incoming.grade), teacher: pick(existing.teacher, incoming.teacher),
    diagnosis: pick(existing.diagnosis, incoming.diagnosis), hypotheses: pick(existing.hypotheses, incoming.hypotheses),
    referred_by: pick(existing.referred_by, incoming.referred_by), handedness: pick(existing.handedness, incoming.handedness) ?? null,
    phones: pick(existing.phones, incoming.phones), email: pick(existing.email, incoming.email),
    notes: [existing.notes, incoming.notes].filter(Boolean).join("\n\n") || undefined,
    guardians: g0 ? [{ ...g0, name: pick(g0.name, ig?.name) ?? "", phone: pick(g0.phone, ig?.phone) ?? "", email: pick(g0.email, ig?.email), cpf: pick(g0.cpf, ig?.cpf), rg: pick(g0.rg, ig?.rg) }, ...existing.guardians.slice(1)] : incoming.guardians ?? [],
    address: { ...(incoming.address ?? {}), ...Object.fromEntries(Object.entries(existing.address ?? {}).filter(([, v]) => v)) },
    anamnesis: { ...(incoming.anamnesis ?? {}), ...Object.fromEntries(Object.entries(existing.anamnesis ?? {}).filter(([, v]) => v)) },
  };
}

export function findExisting(patients: Patient[], name?: string) {
  if (!name) return undefined;
  const n = norm(name);
  return patients.find((p) => norm(p.name) === n);
}

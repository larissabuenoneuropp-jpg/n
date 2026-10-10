// Modelos de documentos. Variáveis disponíveis entre {{ }} — veja TEMPLATE_VARS.

export const REPORT_TYPES = [
  { value: "relatorio", label: "Relatório Neuropsicopedagógico" },
  { value: "encaminhamento", label: "Encaminhamento" },
  { value: "declaracao", label: "Declaração" },
  { value: "atestado", label: "Atestado de comparecimento" },
  { value: "plano", label: "Plano de intervenção" },
  { value: "evolucao", label: "Resumo de evolução" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["value"];

export const TEMPLATE_VARS = [
  "paciente", "idade", "nascimento", "responsavel", "escola", "serie", "diagnostico", "hipoteses",
  "profissional", "profissao", "crnpp", "clinica", "cidade_data", "data", "objetivo_geral",
  "objetivos_especificos", "metas", "queixa", "instrumentos", "evolucao",
];

export const DEFAULT_TEMPLATES: Record<string, string> = {
  relatorio: `RELATÓRIO NEUROPSICOPEDAGÓGICO

1. IDENTIFICAÇÃO
Nome: {{paciente}}
Data de nascimento: {{nascimento}} — Idade: {{idade}}
Responsável: {{responsavel}}
Escola: {{escola}} — Ano/Série: {{serie}}

2. MOTIVO DO ENCAMINHAMENTO / QUEIXA
{{queixa}}

3. PROCEDIMENTOS E INSTRUMENTOS UTILIZADOS
{{instrumentos}}

4. ANÁLISE DOS RESULTADOS
[Descreva o desempenho observado em cada área avaliada.]

5. CONCLUSÃO
[Síntese clínica, sem diagnóstico médico.]

6. ENCAMINHAMENTOS E ORIENTAÇÕES
[Orientações à família, à escola e encaminhamentos a outros profissionais.]

{{cidade_data}}

______________________________
{{profissional}}
{{profissao}} — CRNPP {{crnpp}}`,

  encaminhamento: `ENCAMINHAMENTO

Encaminho {{paciente}}, {{idade}}, para avaliação com [especialidade], considerando:

[Descreva as observações clínicas que motivam o encaminhamento.]

Coloco-me à disposição para troca de informações em benefício do(a) paciente.

{{cidade_data}}

______________________________
{{profissional}}
{{profissao}} — CRNPP {{crnpp}}`,

  declaracao: `DECLARAÇÃO

Declaro, para os devidos fins, que {{paciente}}, nascido(a) em {{nascimento}}, encontra-se em acompanhamento neuropsicopedagógico neste espaço, com frequência de [n] sessão(ões) semanal(is).

{{cidade_data}}

______________________________
{{profissional}}
{{profissao}} — CRNPP {{crnpp}}`,

  atestado: `ATESTADO DE COMPARECIMENTO

Atesto que {{paciente}} compareceu a atendimento neuropsicopedagógico no dia {{data}}, das [hh:mm] às [hh:mm], acompanhado(a) por {{responsavel}}.

{{cidade_data}}

______________________________
{{profissional}}
{{profissao}} — CRNPP {{crnpp}}`,

  plano: `PLANO DE INTERVENÇÃO NEUROPSICOPEDAGÓGICA

Paciente: {{paciente}} — Idade: {{idade}}

OBJETIVO GERAL
{{objetivo_geral}}

OBJETIVOS ESPECÍFICOS
{{objetivos_especificos}}

METAS
{{metas}}

{{cidade_data}}

______________________________
{{profissional}}
{{profissao}} — CRNPP {{crnpp}}`,

  evolucao: `RESUMO DE EVOLUÇÃO

Paciente: {{paciente}} — Idade: {{idade}}
Período: [início] a {{data}}

{{evolucao}}

{{cidade_data}}

______________________________
{{profissional}}
{{profissao}} — CRNPP {{crnpp}}`,
};

// Modelos de documentos. Variáveis disponíveis entre {{ }} — veja TEMPLATE_VARS.

export const REPORT_TYPES = [
  { value: "contrato", label: "Contrato de prestação de serviços" },
  { value: "relatorio", label: "Relatório de Avaliação Neuropsicopedagógica (RAN)" },
  { value: "encaminhamento", label: "Encaminhamento" },
  { value: "declaracao", label: "Declaração" },
  { value: "atestado", label: "Atestado de comparecimento" },
  { value: "plano", label: "Plano de intervenção" },
  { value: "evolucao", label: "Resumo de evolução" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["value"];

export const TEMPLATE_VARS = [
  "dominancia", "responsavel_linha", "medicamento", "historico", "antecedentes", "jeito_de_ser", "vida_escolar",
  "comportamento_avaliacao", "instrumentos_referencias", "resultados_por_area", "aspectos_comportamentais",
  "responsavel_cpf", "responsavel_rg", "responsavel_telefone", "responsavel_email",
  "endereco_rua", "endereco_bairro", "endereco_cidade_uf", "endereco_cep",
  "frequencia", "frequencia_extenso", "sessao_plural", "duracao_sessao", "duracao_extenso",
  "valor_avaliacao", "valor_avaliacao_extenso", "valor_intervencao", "valor_intervencao_extenso",
  "profissional_maiusculo", "profissional_cpf", "endereco_profissional", "email_profissional", "whatsapp",
  "cidade", "uf", "assinatura_titulo",
  "paciente", "idade", "nascimento", "responsavel", "escola", "serie", "diagnostico", "hipoteses",
  "profissional", "profissao", "crnpp", "clinica", "cidade_data", "data", "objetivo_geral",
  "objetivos_especificos", "metas", "queixa", "instrumentos", "evolucao",
];

/** Início do modelo de relatório antigo — substituído automaticamente pelo RAN. */
export const LEGACY_RELATORIO_PREFIX = "RELATÓRIO NEUROPSICOPEDAGÓGICO\n\n1. IDENTIFICAÇÃO";

export const DEFAULT_TEMPLATES: Record<string, string> = {
  // Modelo enviado pela profissional (Contrato Pacientes — Larissa Bueno), com os campos preenchidos pelo cadastro.
  contrato: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PEDAGOGIA

CONTRATANTE:
Eu, {{responsavel}}, brasileiro(a), maior de idade, portador(a) do CPF nº {{responsavel_cpf}} e do RG nº {{responsavel_rg}}, neste ato representando a criança {{paciente}}, residente e domiciliado(a) na Rua: {{endereco_rua}}, Bairro: {{endereco_bairro}}, Cidade/UF: {{endereco_cidade_uf}}, CEP: {{endereco_cep}}, telefone(s): {{responsavel_telefone}} e E-mail: {{responsavel_email}}.

CONTRATADO:
{{profissional_maiusculo}}, brasileira, neuropsicopedagoga, inscrita no CPF nº {{profissional_cpf}}, com sala de atendimento pedagógico particular localizada na {{endereco_profissional}}. E-mail para contato: {{email_profissional}}.

CLÁUSULA 1 - DO OBJETO
1.1 O presente contrato tem por objeto a prestação de serviços pedagógicos pelo CONTRATADO à criança representada pelo CONTRATANTE, conforme os princípios éticos da educação e a legislação vigente.
1.2 Os atendimentos serão realizados presencialmente no endereço da sala de atendimento acima mencionado, ou em local previamente acordado entre as partes, mediante necessidade pedagógica justificada.
1.3 As sessões serão conduzidas com base em metodologias pedagógicas fundamentadas em estudos científicos da área da educação e do desenvolvimento infantil, utilizando técnicas e estratégias compatíveis com as necessidades educacionais da criança. O trabalho terá como foco o desenvolvimento de habilidades cognitivas, acadêmicas e funcionais, a promoção da autonomia e o fortalecimento do processo de aprendizagem, respeitando as características individuais da criança.

CLÁUSULA 2 – DAS CONDIÇÕES DE ATENDIMENTO
2.1 As sessões terão duração de {{duracao_sessao}} ({{duracao_extenso}}) minutos, com frequência inicial de {{frequencia}} ({{frequencia_extenso}}) {{sessao_plural}} por semana, conforme acordado entre as partes.
2.2 Os atendimentos ocorrerão em dias e horários previamente estabelecidos e registrados no ato da contratação, podendo ser revistos de comum acordo.
2.3 O CONTRATADO poderá contar, quando necessário, com o apoio de outros profissionais devidamente capacitados e sob sua supervisão direta.
2.4 O CONTRATADO compromete-se a atuar dentro dos limites de sua formação profissional e conforme a legislação educacional vigente.
2.5 A cada 6 (seis) meses, será realizada reunião com os pais ou responsáveis legais para apresentação das informações sobre o desenvolvimento pedagógico da criança.
2.6 Também a cada 6 (seis) meses, o plano individual poderá ser atualizado com base em protocolos, avaliações e instrumentos pedagógicos utilizados pelo CONTRATADO, podendo haver ajustes na frequência ou nos objetivos do atendimento.

CLÁUSULA 3 – ASSIDUIDADE E CANCELAMENTOS
3.1 O CONTRATANTE compromete-se a garantir a assiduidade da criança nas sessões, comparecendo nos dias e horários acordados.
3.2 Caso não possa comparecer, deverá comunicar com pelo menos 24 (vinte e quatro) horas corridas de antecedência, exclusivamente via WhatsApp do número {{whatsapp}}.
3.3 Sessões não canceladas dentro do prazo estipulado serão cobradas integralmente, independentemente do motivo da ausência.
3.4 Atrasos por parte do CONTRATANTE não implicarão em extensão da sessão, a fim de não prejudicar os demais atendimentos.
3.5 Em caso de 4 (quatro) faltas consecutivas ou não justificadas em um mesmo mês, o contrato poderá ser suspenso automaticamente.

CLÁUSULA 4 – PAGAMENTO E AJUSTES DE VALORES
4.1 O valor de cada sessão de avaliação neuropsicopedagógica é de R$ {{valor_avaliacao}} ({{valor_avaliacao_extenso}}), e o valor de cada sessão de intervenção neuropsicopedagógica é de R$ {{valor_intervencao}} ({{valor_intervencao_extenso}}), conforme acordado entre as partes. O pagamento deverá ser realizado antecipadamente, antes da realização de cada sessão, como condição para a reserva e manutenção do horário agendado.
4.2 Sessões realizadas fora do consultório no município de {{cidade}} serão cobradas como o equivalente a 2 (duas) sessões, considerando o tempo de deslocamento.
4.3 Atendimentos realizados fora do município serão equivalentes a 3 (três) sessões.
4.4 O pagamento deverá ser efetuado no mesmo dia da sessão, preferencialmente via Pix, transferência bancária ou em espécie, conforme dados informados pelo CONTRATADO.
4.5 Relatórios adicionais solicitados fora da periodicidade semestral poderão ser cobrados de acordo com sua complexidade e demanda.
4.6 O valor dos atendimentos prestados será reajustado anualmente, no mês de JULHO, com base na variação do Índice Geral de Preços do Mercado (IGPM), divulgado pela Fundação Getúlio Vargas (FGV). O reajuste será aplicado sobre o valor vigente na data do reajuste, garantindo que os valores reflitam as condições econômicas do mercado. Caso o IGPM não esteja disponível, será utilizado um índice alternativo que reflita a inflação do período.

CLÁUSULA 5 – SUSPENSÃO DO CONTRATO
5.1 O contrato será suspenso automaticamente em caso de inadimplência superior a 4 (quatro) sessões consecutivas.
5.2 Também poderá ser suspenso se não houver regularização do pagamento das sessões não canceladas dentro do prazo, conforme previsto na Cláusula 3.
5.3 A suspensão implica em perda da preferência pelo horário previamente reservado, sendo necessária nova negociação de agenda após a regularização dos pagamentos.

CLÁUSULA 6 – RESCISÃO CONTRATUAL
6.1 O contrato poderá ser rescindido:
a) Por inadimplência, nos termos da Cláusula 5, caso não haja regularização em até 5 (cinco) dias após notificação formal.
b) Por iniciativa do CONTRATADO, mediante comunicação prévia ao CONTRATANTE e, se necessário, indicação de outro profissional com formação compatível, podendo ser fornecido relatório pedagógico de acompanhamento.
c) Caso o CONTRATANTE interrompa os atendimentos por iniciativa própria e se ausente por 4 (quatro) sessões consecutivas sem justificativa ou comunicação prévia.

CLÁUSULA 7 – FÉRIAS E INTERRUPÇÕES
7.1 As sessões serão interrompidas durante o recesso de final de ano, a combinar, bem como durante os períodos de férias do profissional, sempre mediante aviso prévio.
7.2 Caso o CONTRATANTE deseje manter seu horário de atendimento reservado durante um período de ausência superior a duas semanas, poderá ser acordado o pagamento de 30% do valor da sessão, a título de reserva de agenda.
7.3 A ausência do pagamento deste valor não garante a manutenção do horário habitual.

CLÁUSULA 8 – SIGILO PROFISSIONAL
8.1 Todas as informações obtidas durante o processo pedagógico são protegidas por sigilo profissional, conforme a legislação vigente, especialmente o Estatuto da Criança e do Adolescente (ECA) e a Lei Geral de Proteção de Dados (LGPD).
8.2 O sigilo poderá ser excepcionalmente relativizado apenas nos casos legalmente previstos, como situações de risco à integridade da criança/adolescente ou de terceiros, ou mediante determinação judicial.
8.3 O CONTRATANTE autoriza o contato do profissional por meios eletrônicos (telefone, e-mail ou aplicativos de mensagens) exclusivamente para assuntos relacionados ao atendimento pedagógico, tais como orientações, agendamentos, devolutivas e comunicados, respeitando-se a confidencialidade das informações e a legislação vigente sobre proteção de dados pessoais (LGPD).

CLÁUSULA 9 – DISPOSIÇÕES FINAIS
9.1 Este contrato poderá ser alterado a qualquer momento, mediante acordo entre as partes e assinatura de termo aditivo.
9.2 A tolerância de uma das partes quanto ao cumprimento de qualquer cláusula contratual não constituirá novação ou renúncia de direitos.
9.3 Para dirimir quaisquer conflitos oriundos deste contrato, fica eleito o foro da Comarca de {{cidade}} – {{uf}}, com renúncia de qualquer outro, por mais privilegiado que seja.

E por estarem justas e acordadas, as partes assinam o presente contrato em duas vias de igual teor e forma.

{{cidade_data}}


___________________________________________
{{profissional}}
{{assinatura_titulo}}


___________________________________________
{{responsavel}}
Responsável`,

  // Modelo baseado no RAN da profissional. Marcação: "# título", ">> alinhado à direita", "## seção",
  // "### subseção", "#### tópico", "[[legenda]]" e linhas "| a | b |" para quadros.
  relatorio: `# RELATÓRIO DE AVALIAÇÃO NEUROPSICOPEDAGÓGICA (RAN)
>> {{cidade_data}}

## 1. IDENTIFICAÇÃO DA CRIANÇA
Nome da criança: {{paciente}} | Data de nascimento: {{nascimento}}
Idade: {{idade}} | Escolaridade: {{serie}} | Escola: {{escola}}
Dominância manual: {{dominancia}}
{{responsavel_linha}}
Faz uso de medicamento: {{medicamento}}

## 2. QUEIXA
{{queixa}}

## 3. HISTÓRICO DO DESENVOLVIMENTO E DA SAÚDE
{{historico}}

## 4. ANTECEDENTES FAMILIARES
{{antecedentes}}

## 5. JEITO DE SER DA CRIANÇA, SEGUNDO A FAMÍLIA E/OU RESPONSÁVEL
{{jeito_de_ser}}

## 6. VIDA ESCOLAR
{{vida_escolar}}

## 7. COMPORTAMENTO DA CRIANÇA DURANTE A AVALIAÇÃO
{{comportamento_avaliacao}}

## 8. AVALIAÇÃO
Para avaliação neuropsicopedagógica foram utilizados testes padronizados, qualitativos, ecológicos, quantitativos, além da anamnese, da observação clínica, lúdica, do material escolar e das informações obtidas pela escola, pela família e pela criança.

### 8.1 Instrumentos
Durante o processo de avaliação neuropsicopedagógica foram utilizados os seguintes instrumentos e procedimentos:
{{instrumentos_referencias}}

### 8.2 Síntese dos resultados
Nesta seção são apresentados os resultados obtidos durante a avaliação neuropsicopedagógica, organizados de acordo com as habilidades cognitivas, acadêmicas, comportamentais e motoras investigadas. A interpretação dos achados fundamenta-se na integração dos resultados dos instrumentos padronizados, das avaliações qualitativas, das observações clínicas e lúdicas, bem como das informações fornecidas pela família, pela escola e pela própria criança.

{{resultados_por_area}}

## 9. ASPECTOS COMPORTAMENTAIS EM DIFERENTES CONTEXTOS
{{aspectos_comportamentais}}

## 10. CONCLUSÃO
[completar — integração dos achados]

### INDICAÇÕES
[completar — encaminhamentos e orientações à família e à escola]


___________________________________________
{{profissional}}
{{assinatura_titulo}}`,

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

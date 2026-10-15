# Etapa 1 — Análise dos arquivos enviados (out/2026)

Arquivos analisados (não versionados no repositório, porque contêm dados de pacientes):

1. **SIMULADOR CARNÊ LEÃO NO EXCEL – LARISSA.xlsx** (arquivo do contador) — 1 aba (“Simulador …”, com o nome de outra profissional).
2. **Larissa – Sessões e Financeiro – 2026.xlsx** (controle da profissional) — 11 abas mensais (`FEV. 26` a `DEZ. 26`) e `DADOS DOS PACIENTES`.

Neste documento os pacientes **não são nomeados**: as referências usam aba e linha da planilha.

---

## 1. Arquivo do contador (Carnê-Leão)

### 1.1 O que o arquivo é

É um **simulador de Carnê-Leão**, ou seja, de imposto de renda de **pessoa física** (profissional autônoma que recebe de pessoas físicas). **Não** é um cálculo de pessoa jurídica: não há Simples Nacional, DAS, pró-labore, distribuição de lucros nem CNPJ.

> Consequência para o aplicativo: o regime configurado por padrão é **"Pessoa física — autônoma (Carnê-Leão)"**, com origem neste arquivo. Os conceitos de "pró-labore" e "distribuição de lucros" pedidos no briefing são tratados como **separação gerencial** (dinheiro do consultório × dinheiro pessoal), porque na pessoa física não há distinção legal entre eles. A comparação com pessoa jurídica existe como **cenário**, com valores a preencher com o contador (o arquivo não traz nenhum dado de PJ).

### 1.2 Regras extraídas

| Regra | Valor no arquivo | Células | Situação |
|---|---|---|---|
| Base de cálculo | Rendimentos − Deduções | `C5 = C3 − C4` | extraída |
| Tabela progressiva mensal | até 2.428,80: isento · até 2.826,65: 7,5% (deduz 182,16) · até 3.751,05: 15% (deduz 394,16) · até 4.664,68: 22,5% (deduz 675,49) · acima: 27,5% (deduz 908,73) | `E5:G9` e fórmula `C7` | extraída — confere com a tabela mensal vigente desde maio/2025, segundo fontes secundárias consultadas em out/2026; **confirmar na Receita Federal** |
| Imposto | Base × alíquota − parcela a deduzir | `C10` | extraída |
| Deduções previstas | Dependente (0) e Livro-caixa (0) | `E13:F14` | extraídas; valor por dependente **não consta** |
| Despesas dedutíveis (livro-caixa) | Funcionários e encargos; aluguel; condomínio; luz; água; IPTU; telefone; material de limpeza; propaganda; serviços de terceiros; honorários contábeis; ISS fixo; vigilância sanitária; conselho regional | `I1:I17` | extraídas |
| Despesas **não** dedutíveis | Equipamentos (cadeira, impressora); móveis e aparelhos (ar-condicionado, computador); locomoção (estacionamento, gasolina, pedágio) — "consideradas investimentos" | `I21:I28` | extraídas |

### 1.3 Problemas e lacunas encontrados

1. **Aba com o nome de outra profissional** e itens de outra profissão (ex.: "Laboratório de prótese"): o arquivo parece ser um modelo reaproveitado. A lista de dedutíveis é genérica e **não** cita itens típicos da sua atividade.
2. **Deduções desligadas da tabela de deduções**: `C4` (deduções = 1.000) é um número digitado; não soma `F13:F14`. Os valores 5.000 e 1.000 são exemplos.
3. **Rótulos com 1 centavo de diferença**: `E7` diz "até 3.751,06" e `E8` "de 3.751,07", mas a fórmula usa 3.751,05 / 3.751,06 (a fórmula é a que bate com a tabela oficial).
4. **Fórmula frágil**: valores entre duas faixas com frações de centavo (ex.: 2.826,655) não caem em faixa nenhuma; a faixa isenta funciona por acidente (o `VLOOKUP` falha e o `IFERROR` devolve 0).
5. **Itens sem valor no arquivo** (o aplicativo os mostra como *dados faltantes*):
   - INSS (contribuinte individual): plano, base e valor mensal;
   - ISS fixo anual do município e datas;
   - honorários contábeis;
   - taxas (vigilância sanitária, alvará, conselho/associação profissional);
   - valor de dedução por dependente e número de dependentes;
   - se a contribuição ao INSS deve ser deduzida da base (regra geral do IRPF, mas não consta no arquivo).
6. **Itens da sua atividade que o arquivo não classifica** — ficam como **"a confirmar"** e não são deduzidos por padrão: supervisão, cursos/pós/congressos, materiais e instrumentos de avaliação (testes, escalas), brinquedos, softwares/assinaturas, papelaria, custo do espaço por atendimento (pode equivaler a "aluguel", que é dedutível, se houver comprovante em seu nome).
7. **Redutor da Lei 15.270/2025** (redução do IR para rendimentos mensais até R$ 7.350 a partir de jan/2026): **não consta** no arquivo. As fontes consultadas divergem sobre se ele se aplica ao Carnê-Leão mensal ou só no ajuste anual. No aplicativo, ele existe como regra **desligada** e marcada "confirmar com o contador". Mantê-lo desligado é a opção conservadora (provisiona mais imposto).
8. **Pagamentos de planos de saúde / pessoas jurídicas**: o Carnê-Leão vale para rendimentos recebidos de **pessoas físicas**. Se algum plano de saúde (pessoa jurídica) paga diretamente, esse rendimento segue outra regra (retenção na fonte e ajuste anual). A planilha de sessões marca alguns pagamentos como "PIX PF" e outros como "Plano de saúde" — **é preciso confirmar quem paga cada um**.

---

## 2. Planilha de sessões e financeiro 2026

### 2.1 Estrutura

Cada aba mensal tem: tabela de pacientes (atendimentos, valor, total, NF, convênio, "enviar", "pago", forma de recebimento), lista diária (data, nome, PRESENÇA/FALTA), tabela de saídas (data, valor, descrição, categoria) e um resumo (despesas por categoria, "Totais", "Falta receber", "Lucro").

### 2.2 Números consolidados (recalculados, sem os erros de fórmula)

| Mês | Faturado (planilha) | Em aberto | Presenças | Faltas | Saídas (recalculadas) | Saídas no resumo da planilha | Situação |
|---|---|---|---|---|---|---|---|
| fev/26 | 3.704,16 | 0 | 14 | 2 | 911,41 | 772,92 | realizado |
| mar/26 | 6.712,90 | 0 | 24 | 5 | 846,24 | 846,24 | realizado |
| abr/26 | 5.085,90 | 0 | 14 | 8 | 1.321,51 | 1.321,51 | realizado |
| mai/26 | 10.851,40 | 0 | 47 | 7 | 3.365,93 | 2.004,59 | realizado |
| jun/26 | 9.564,50 | 0 | 40 | 2 | 2.620,31 | 2.620,31 | realizado |
| jul/26 | 8.237,00 | 0 | 27 | 4 | 2.047,09 | 2.047,09 | realizado |
| ago/26 | 8.320,30 | 884,00 | 32 | 7 | 2.270,92 | 2.270,92 | realizado |
| set/26 | 7.383,90 (+1 paciente sem valor) | 4.293,90 | 35 | 7 | 2.758,43 | 2.758,43 | realizado |
| out/26 | 8.402,60 (+1 paciente sem valor) | 6.332,60 | 18 até 14/10 | 1 | 2.618,22 | 2.618,22 | em andamento |
| nov/26 e dez/26 | 6.360,40 / 7.042,55 | tudo | — | — | 2.234,92 / 2.079,65 | iguais | **previsão** (agenda e despesas copiadas de outubro) |

Totais de fev a set/26 (realizado): faturado ≈ R$ 59.860; saídas recalculadas ≈ R$ 16.142. **Não há impostos, INSS, contabilidade nem retiradas pessoais lançados em nenhum mês**, então o "Lucro" da planilha é receita menos parte das despesas, não lucro líquido.

### 2.3 Erros de fórmula e inconsistências (por ordem de impacto)

1. **Maio: despesas subestimadas em R$ 1.361,34.** `O5:O12` usam `SUMIF(H26:I45; categoria; E23:E45)` — o intervalo do critério começa 3 linhas abaixo do intervalo somado, então cada categoria soma o valor de outra linha. O "Lucro" de maio aparece R$ 1.361,34 maior do que o real.
2. **Fevereiro: despesas subestimadas em R$ 138,49.** Cada linha do resumo usa um intervalo deslocado (`I18:J26`, `I19:J27`, …); um lançamento de materiais e um de manutenção ficam de fora.
3. **"Totais" soma 1 real a mais em todos os meses**: `=SUM(E5:E14; H5:H14; TRUE)` — o `TRUE` literal vale 1.
4. **Paciente sem valor (set, out, nov, dez)**: um paciente tem 7, 9, 5 e 6 atendimentos sem valor por sessão; a receita desses meses está subestimada e o atendimento não entra no total.
5. **Outubro: total de atendimentos ignora uma linha** (`C14 = SUM(C5:C10)` não inclui a linha 11), então o custo do espaço (`=C14*30`) usa 38 atendimentos em vez de 47.
6. **Contagem inclui faltas**: o número de atendimentos é `COUNTIF(nome)`, que conta PRESENÇA e FALTA. Se a falta não é cobrada, a receita está superestimada; se é cobrada (comum em pacote), está certo — **confirmar a política de faltas por paciente**. O custo do espaço, em ago e set, usa só presenças (32 e 35).
7. **Intervalos diferentes entre linhas** (ex.: `COUNTIF(B17:B68)` numa linha e `B$17:B$148` nas outras; `SUMIF(H$22:H$67 … E$22:E$57)`).
8. **Categorias com espaço no final** ("Materiais ", "Impostos ", "Contabilidade ") — funcionam por coincidência; um lançamento digitado sem o espaço não seria somado.
9. **Valores repetidos entre meses**: os mesmos valores de materiais (86,20; 71,95; 69,92; 52,29/52,28; 71,62; 162,21) aparecem em fev, mar, abr e mai. Podem ser compras recorrentes ou linhas copiadas — **confirmar** antes de usar como histórico.
10. **Maio: possível duplicidade de pacientes** — além dos nomes completos, aparecem abreviações (ex.: "inicial + sobrenome") que podem ser os mesmos pacientes ou pacientes de outras profissionais atendidos em reposição. **Confirmar** antes de considerar o faturamento de maio como base.
11. **Condomínio × custo por atendimento**: até jul/26 há "Condomínio" (121,05 a 562,03, variável) **e** "Aluguel"; a partir de ago/26 só existe o custo de R$ 30 por atendimento e as linhas de condomínio ficam vazias. O valor de R$ 550/mês informado no briefing não aparece em nenhum mês. Indício de que a cobrança por atendimento substituiu o condomínio — **confirmar** para não contar duas vezes.
12. **Supervisão lançada como "Estudos / Atualizações"**; transporte para atendimento domiciliar (Uber) lançado como "Manutenção/Infraestrutura".
13. **Valores por sessão diferentes do valor de referência**: convênio 229,50 (270 − 15%), 218,40 (260 − 16%), 233,75, 233,52/233,60; particular 220, 230, 250; pacotes com total fixo (1.375,00 e 1.250,00). O valor de referência de R$ 230 não representa todos os contratos.
14. **"Lucro" mistura competência e caixa**: soma valores ainda não recebidos ("Falta receber") e não desconta impostos.

### 2.4 Premissas que o aplicativo **não** assume (precisam de resposta)

- Saldo bancário atual e data.
- Quem paga cada paciente "plano de saúde" (família/PIX PF ou o plano/PJ) e em que prazo.
- Se falta é cobrada, por paciente.
- Valor do paciente sem valor por sessão.
- INSS, ISS, contabilidade, taxas anuais (item 1.3.5).
- Saldo mínimo de segurança desejado e metas das reservas.
- Datas de término dos cursos/pós (a planilha registra o valor mensal, não o fim).

### 2.5 Dados que o aplicativo usa como premissa provisória (editáveis, sinalizados na tela)

- Taxa de presença: calculada do histórico importado (fev–set/26: 233 presenças e 42 faltas registradas ≈ 85% de presença); antes da importação, 85% marcado como hipótese.
- Capacidade de 25 sessões/semana e duração de 45 min (briefing).
- Custo do espaço de R$ 30 por atendimento realizado (briefing e planilha a partir de ago/26).
- Supervisão de R$ 600/mês (briefing e planilha).

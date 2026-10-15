# Etapa 1 — Análise dos arquivos enviados (out/2026)

Arquivos analisados (não versionados no repositório, porque contêm dados de pacientes):

1. **Simulador de Carnê-Leão em Excel** (arquivo do contador) — 1 aba (“Simulador …”, com o nome de outra profissional).
2. **Sessões e Financeiro 2026** (controle da profissional) — 11 abas mensais (`FEV. 26` a `DEZ. 26`) e `DADOS DOS PACIENTES`.

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

### 2.2 Números consolidados

Os totais mensais recalculados (faturado, em aberto, presenças, faltas e saídas) **não ficam neste repositório**, porque são dados financeiros pessoais. Foram entregues à profissional num arquivo separado e são reproduzidos pelo próprio app ao importar a planilha (o teste `importers.test.ts` confere a importação com a planilha real quando ela é informada localmente via `NP_SHEET`).

Resumo sem valores: fev a set/26 são meses realizados; out/26 estava em andamento; nov e dez/26 são **previsão** (agenda e despesas copiadas de outubro). **Não há impostos, INSS, contabilidade nem retiradas pessoais lançados em nenhum mês**, então o "Lucro" da planilha é receita menos parte das despesas, não lucro líquido.

### 2.3 Erros de fórmula e inconsistências (por ordem de impacto)

1. **Maio: despesas subestimadas.** `O5:O12` usam `SUMIF(H26:I45; categoria; E23:E45)` — o intervalo do critério começa 3 linhas abaixo do intervalo somado, então cada categoria soma o valor de outra linha. O "Lucro" de maio aparece maior do que o real.
2. **Fevereiro: despesas subestimadas.** Cada linha do resumo usa um intervalo deslocado (`I18:J26`, `I19:J27`, …); um lançamento de materiais e um de manutenção ficam de fora.
3. **"Totais" soma 1 real a mais em todos os meses**: `=SUM(E5:E14; H5:H14; TRUE)` — o `TRUE` literal vale 1.
4. **Paciente sem valor (set a dez)**: atendimentos registrados sem valor por sessão; a receita desses meses está subestimada.
5. **Outubro: total de atendimentos ignora uma linha** (`C14 = SUM(C5:C10)`), e o custo do espaço (`=C14*30`) usa esse total.
6. **Contagem inclui faltas**: `COUNTIF(nome)` conta PRESENÇA e FALTA. Confirmar a política de faltas por paciente. O custo do espaço, em ago e set, usa só presenças.
7. **Intervalos diferentes entre linhas** (ex.: `COUNTIF(B17:B68)` numa linha e `B$17:B$148` nas outras).
8. **Total digitado diferente de atendimentos × valor** em pelo menos uma linha (valor fixo digitado no lugar da fórmula).
9. **Categorias com espaço no final** ("Materiais ", "Impostos ", "Contabilidade ") — funcionam por coincidência.
10. **Valores repetidos entre meses**: os mesmos valores de materiais aparecem em fev, mar, abr e mai. Podem ser compras recorrentes ou linhas copiadas — confirmar.
11. **Maio: possível duplicidade de pacientes** — além dos nomes completos, aparecem abreviações que podem ser os mesmos pacientes ou pacientes de outras profissionais atendidos em reposição.
12. **Condomínio × custo por atendimento**: até jul/26 há condomínio (valor variável) e aluguel; a partir de ago/26 só existe o custo por atendimento. O valor de condomínio informado no briefing não aparece em nenhum mês — confirmar para não contar duas vezes.
13. **Supervisão lançada como "Estudos / Atualizações"**; transporte para atendimento domiciliar lançado como "Manutenção/Infraestrutura".
14. **Valores por sessão diferentes do valor de referência** (convênio com descontos diferentes, particular com valores distintos, pacotes com total fixo).
15. **"Lucro" mistura competência e caixa**: soma valores ainda não recebidos e não desconta impostos.

### 2.4 Premissas que o aplicativo **não** assume (precisam de resposta)

- Saldo bancário atual e data.
- Quem paga cada paciente "plano de saúde" (família/PIX PF ou o plano/PJ) e em que prazo.
- Se falta é cobrada, por paciente.
- Valor do paciente sem valor por sessão.
- INSS, ISS, contabilidade, taxas anuais (item 1.3.5).
- Saldo mínimo de segurança desejado e metas das reservas.
- Datas de término dos cursos/pós (a planilha registra o valor mensal, não o fim).

### 2.5 Dados que o aplicativo usa como premissa provisória (editáveis, sinalizados na tela)

- Taxa de presença: calculada do histórico importado (calculada das presenças e faltas registradas na planilha importada); antes da importação, 85% marcado como hipótese.
- Capacidade de 25 sessões/semana e duração de 45 min (briefing).
- Custo do espaço de R$ 30 por atendimento realizado (briefing e planilha a partir de ago/26).
- Supervisão de R$ 600/mês (briefing e planilha).

# Etapa 2 — Modelo financeiro, fórmulas e premissas

Ferramenta **gerencial**: não substitui o contador nem a apuração oficial (Carnê-Leão Web).
Todo o cálculo está em `src/lib/finance/` (funções puras, testadas em `*.test.ts`); as telas só exibem.

## 1. Dados

| Entidade | Onde | O que guarda |
|---|---|---|
| Lançamento (`transactions`) | tabela existente, ampliada | receita, despesa ou **retirada**; competência, vencimento, pagamento, status (previsto/faturado/cancelado), sessões cobradas/realizadas/faltas/reposições, valor unitário, desconto, fonte pagadora (PF/PJ/a confirmar), nota fiscal, IR retido, natureza do custo, classificação fiscal, comprovante, chave de importação |
| Contrato (`fin_contracts`) | nova | paciente/identificador, sessões por semana, valor por sessão ou pacote mensal, quem paga, prazo de recebimento, se a falta é cobrada, vigência |
| Recorrente (`fin_recurring`) | nova | despesa mensal, anual ou por sessão, com início, **fim** (cursos) e reajuste |
| Reserva (`fin_reserves`) | nova | conta gerencial com meta (R$, % da receita ou meses de custos), prazo, prioridade, aportes |
| Saldo (`fin_balances`) | nova | saldo bancário informado numa data |
| Compra planejada (`fin_plans`) | nova | ideia/aprovada/realizada/descartada; só aprovada entra nas projeções |
| Histórico (`fin_history`) | nova | antes/depois de cada alteração financeira |
| Configurações (`profiles.finance_settings`) | nova coluna | capacidade, calendário, premissas, cenários, regras tributárias com **fonte, situação e validade** |

Supabase: `supabase/migrations/0008_gestao_financeira.sql` (RLS por dona, owner/id/created_at protegidos, chave de importação única). Uso pessoal: cofre criptografado no navegador, como o resto do app.

## 2. Regras de classificação

- **Faturamento bruto (competência)**: receitas faturadas ou recebidas do mês do atendimento. *Previsto* e *cancelado* não entram.
- **Recebido (caixa)**: receitas com data de pagamento no mês.
- **Previsto** nunca conta como dinheiro disponível.
- **Retirada** sai do caixa, mas não é despesa do consultório (não reduz o resultado).
- **Investimento** (equipamentos, móveis) não entra no resultado do mês; **gasto pessoal** é sinalizado para correção.
- **IR e INSS da profissional** ficam abaixo do resultado operacional; no DRE entram pela provisão calculada (os DARFs pagos são só caixa — sem contar duas vezes).

## 3. Fórmulas

| Indicador | Fórmula |
|---|---|
| Receita líquida | faturamento bruto − descontos (na PF não há tributo proporcional à receita) |
| Margem de contribuição | receita líquida − custos variáveis |
| Resultado operacional | receita líquida − variáveis − fixas − taxas (ISS fixo, alvarás) − extraordinárias |
| **Margem operacional** | resultado operacional ÷ receita líquida × 100 |
| Lucro líquido | resultado operacional − IR (Carnê-Leão + provisão de ajuste anual) − INSS |
| **Margem líquida** | lucro líquido ÷ receita líquida × 100 — só exibida quando o INSS está informado; senão "provisória" |
| **Custo variável por sessão** | custos variáveis do mês ÷ sessões realizadas no mês |
| **Ponto de equilíbrio** | custos fixos ÷ margem de contribuição % (com preço e custo por sessão) |
| **Caixa atual** | último saldo informado + entradas − saídas pagas **depois** da data do saldo |
| **Caixa projetado** | saldo inicial + recebimentos previstos − pagamentos previstos |
| Piso do caixa | saldo mínimo + tributos a pagar no mês seguinte + reservas separadas |
| **Orçamento livre** | caixa atual + recebimentos **confirmados** até o fim do mês − contas a pagar − tributos provisionados − pró-labore restante − reservas − saldo mínimo − investimentos aprovados |

O orçamento livre é do mês corrente; o caixa atual já desconta tudo o que foi pago até hoje, então nada é abatido duas vezes. Recebimentos só previstos aparecem à parte.

## 4. Imposto (Carnê-Leão — regime de caixa)

1. Rendimentos de pessoa física recebidos no mês (pagador "a confirmar" entra aqui por padrão — conservador).
2. (−) Livro-caixa: despesas **dedutíveis** pagas no mês (lista do arquivo do contador). "A confirmar" não é deduzido; a tela mostra quanto o imposto cairia se fosse.
3. (−) INSS e dependentes, só se ativados/informados.
4. Imposto = base × alíquota − parcela a deduzir (tabela do arquivo do contador).
5. Redutor da Lei 15.270/2025: opcional, **desligado** (aplicação ao Carnê-Leão mensal não confirmada).
6. Rendimentos de PJ: provisão para o ajuste anual = imposto sobre o total − Carnê-Leão − IR retido.
7. DARF no último dia útil do mês seguinte.

## 5. Projeção (out/2026 → dez/2027, configurável)

- Semanas do mês = dias de atendimento reais (sem feriados nacionais, municipais cadastrados e férias) ÷ dias de atendimento por semana. Ex.: out/2026 = 21 ÷ 5 = 4,2. Nunca "4 semanas".
- Receita de cada contrato = sessões/semana × semanas × (presença, se a falta não é cobrada) × valor. Pacote: valor fixo, proporcional em meses com férias.
- Mês que já tem lançamento daquele contrato usa o lançamento (sem duplicar). Recorrente já lançado no mês não é projetado de novo.
- Presença e inadimplência: configuradas > histórico > premissa (85% e 2%, sinalizadas).
- Cenários: **conservador** (−10 pontos de presença, 10% inadimplência, recebimento 1 mês depois, custos +5%, −1 paciente/semestre); **realista** (contratos atuais, histórico, sem crescimento automático); **otimista** (+2 pacientes/trimestre, limitado à capacidade). Todos editáveis.

## 6. Pró-labore

- **Máximo sustentável** (cenário realista) e **recomendado** (cenário conservador): a maior retirada mensal constante, em múltiplos de R$ 10, que mantém o caixa projetado ≥ piso em **todos** os meses do horizonte (12 por padrão). Busca binária — não é percentual do faturamento.
- **Disponível agora**: referência do mês (menor entre planejado e recomendado) − já retirado, limitada pelo caixa livre.
- Na pessoa física não há distinção legal entre pró-labore e lucro: a separação é gerencial.

## 7. Limites do orçamento (não somáveis)

1. Operacional = caixa livre.
2. Investimento = menor entre (caixa livre + reservas de equipamentos/investimentos) e a menor folga projetada em 12 meses no cenário conservador.
3. Retirada adicional = menor entre o caixa livre e essa mesma folga.

Quando o pró-labore usado é o recomendado, a folga conservadora fica perto de zero por construção; a simulação de compra mostra quanto o pró-labore teria de cair para a compra caber.

## 8. Reservas

Impostos (= tributos provisionados) e capital de giro (= saldo mínimo) são **automáticos**, para não contar duas vezes. As demais têm meta em R$, % da receita média ou meses de custos fixos; o aporte sugerido segue a prioridade, cada reserva recebendo no máximo o necessário do mês (falta ÷ meses até o prazo, ou 12).

## 9. Importação sem duplicar

Cada linha importada recebe uma chave estável (`sheet:AAAA-MM:rec:<nome normalizado>`, `bank:<FITID ou data+valor+descrição>`); o banco tem índice único por dona. O extrato é conciliado: pago com mesmo valor ±3 dias → já registrado; em aberto ±10 dias → marcar como pago; senão → novo.

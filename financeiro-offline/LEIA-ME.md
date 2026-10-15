# Meu Financeiro — app financeiro independente, sem internet

Um único arquivo, `release/MeuFinanceiro.html`. Não precisa instalar nada (nem Node.js) e não usa servidor.

## Como usar

1. Copie `MeuFinanceiro.html` para uma pasta do seu computador (ex.: Documentos).
2. Abra com dois cliques — de preferência no **Google Chrome** ou no **Microsoft Edge** (no Mac, clique com o botão direito › Abrir com › Google Chrome).
3. Primeiro uso: **Criar um arquivo novo**. Crie uma senha forte e escolha onde salvar o arquivo de dados (`meu-financeiro.mfin`).
4. Nas próximas vezes: **Abrir “meu-financeiro.mfin”** e digite a senha. O navegador pergunta se a página pode editar o arquivo: clique em **Permitir** / **Editar arquivo**.

No Chrome/Edge cada alteração é gravada sozinha no arquivo (veja “Salvo no arquivo HH:MM” no topo). Em outros navegadores (Safari, Firefox) a gravação direta não existe: use o botão **Salvar arquivo**, que baixa a versão nova — guarde sempre a mais recente.

## Segurança

- **Sem internet:** a página tem uma política de segurança (`connect-src 'none'`) que faz o próprio navegador bloquear qualquer conexão. Ela também não carrega nada de fora: código, estilos e ícones estão dentro do arquivo. Funciona com o computador desconectado.
- **Dados criptografados:** o arquivo `.mfin` é cifrado com AES-256-GCM, com chave derivada da sua senha pelo Argon2id (64 MiB, 3 passadas). Sem a senha ninguém abre — **nem você: não há recuperação de senha**.
- **Nada fica no navegador:** os dados existem só no arquivo `.mfin`. O navegador guarda apenas o “atalho” para o último arquivo aberto (para o botão “Abrir …”), sem conteúdo.
- **Bloqueio:** botão **Bloquear** e bloqueio automático após 15 minutos sem uso (os dados saem da memória; para voltar, a senha).
- **Backup:** copie o arquivo `.mfin` para um pendrive ou HD externo uma vez por semana. Ele continua protegido pela senha.

Conferência opcional de integridade do arquivo baixado: compare o SHA-256 de `MeuFinanceiro.html` com o valor em `release/MeuFinanceiro.html.sha256` (Windows: `certutil -hashfile MeuFinanceiro.html SHA256`; Mac: `shasum -a 256 MeuFinanceiro.html`).

## O que tem

As mesmas 11 seções da gestão financeira: visão geral, receitas e contratos, despesas, fluxo de caixa, pró-labore, orçamento disponível, reservas, projeções até 2027 e simulador, planejamento tributário (Carnê-Leão), relatórios e configurações — incluindo a importação da planilha de sessões e de extratos (CSV, Excel, OFX). Nada do NeuroPlanner (pacientes, agenda, cobranças, IA) faz parte deste app.

## Para quem desenvolve

- Código: `financeiro-offline/` (Vite + React). Reaproveita o núcleo de cálculo (`src/lib/finance`) e as telas (`src/app/(app)/financeiro`), trocando as dependências do NeuroPlanner por `financeiro-offline/src/shims`.
- Compilar: `npm run build:financeiro` → gera `financeiro-offline/release/MeuFinanceiro.html` e o `.sha256`.
- Testes: `npm test` (inclui a criptografia do arquivo de dados).

# AGENTS.md — Radar IA

Instruções para agentes de código (Codex, Claude Code etc.). Escreva para o usuário em **português do Brasil**, com acentuação correta.

## O que é

Painel pessoal de IA: notícias classificadas por tópico, modelos e preços, benchmarks, guia "qual IA usar", artigos, em alta, linha do tempo e salvos. Atualiza a cada 5 minutos. Derivado do Radar Eleitoral (`X:\ajudante do papai\Observacao`), sem tRPC, OAuth nem MySQL. Pilha: React 19, Vite 7, Wouter, React Query, Express 4, TypeScript, Node 22. Detalhes no `README.md`; fontes em `docs/fontes.md`.

## Regras do projeto

- Interface e textos em pt-BR. Manchetes e resumos em inglês ficam no original.
- **Sem API paga** (decisão do usuário, 25/10/2026): coleta e classificação só por regras e APIs públicas gratuitas.
- **Nada de dado fictício com cara de real.** Todo número vem de uma fonte e mostra de onde veio. Só `data/guia.json` é curado à mão (dicas de ferramentas, com `reviewedAt`); os rankings do guia vêm dos dados ao vivo.
- Ao mexer em parser ou regra, mantenha `pnpm test` passando e acrescente teste com fixture real (`server/fixtures/`, cortada para poucos itens).
- Regras de classificação em `server/classify.ts`: `"palavra"`, `"prefixo*"` ou `"duas palavras"`. Cuidado com falsos amigos do português ("aí" vira "ai", "eu", "meta", "mercado"); há testes para isso.
- Fonte nova: confira o endereço com curl, salve uma fixture e anote em `docs/fontes.md`. Fonte que falha sempre sai da lista (e entra na seção "Fora da lista").
- Formatação: `.prettierrc` (largura 80, aspas duplas, `arrowParens: avoid`).
- Faça commit só quando o usuário pedir. Repositório local com autor `gabriellunaro <gabriellunaro@hotmail.com>` configurado só aqui.

## Como rodar (Windows 10)

```bash
pnpm dev        # http://127.0.0.1:3000 (Express + Vite)
pnpm check      # tsc --noEmit
pnpm test       # vitest
iniciar.cmd     # produção local
```

Particularidades desta máquina (as mesmas do Observacao):
- **Kaspersky intercepta HTTPS.** Os scripts usam `--use-system-ca`. Nunca use `NODE_TLS_REJECT_UNAUTHORIZED=0`. Qualquer script Node que faça HTTPS precisa da mesma opção (`NODE_OPTIONS=--use-system-ca`).
- `.npmrc` com `shell-emulator=true` para `VAR=valor comando` funcionar no cmd.exe.
- `C:\Users\Heimdall\.npmrc` aponta `cafile` para um PEM em `%TEMP%` que pode sumir. Se o pnpm travar ou der `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, gere um PEM com `Cert:\CurrentUser\Root` e `Cert:\LocalMachine\Root` fora do repositório e rode `npm_config_cafile=<pem> pnpm install`. Depois confira `grep -c "@rollup/rollup-linux-x64-gnu" pnpm-lock.yaml` (esperado: 3), senão o build quebra no Render.
- No app desktop do Claude, o preview não inicia o `tsx watch`: rode `pnpm dev` num terminal e conecte pelo `.claude/launch.json` (só `url`).
- O servidor escuta só em `127.0.0.1` (`HOST` muda). Nunca exponha o `pnpm dev`.
- `DATA_DIR` muda a pasta do cache; `DISABLE_SCHEDULER=1` desliga a coleta em segundo plano.

## Histórico

### 25/10/2026 (criação)
- Projeto criado a partir do plano `C:\Users\Heimdall\.claude\plans\resilient-tinkering-bumblebee.md`, com base no Observacao.
- 6 coletores (notícias, modelos, artigos, em alta, benchmarks, status das APIs), agendador, cache em disco e 10 telas.
- Pedido do usuário durante a criação: notícias classificadas por tópicos (novidades, novas funções, novos modelos, cibersegurança e outros), com filtros por modelo e por empresa/IA. Implementado com 17 tópicos, 22 empresas e 21 famílias de modelo.
- Achados na coleta real: Google Notícias inundava a lista (limite de 12), "Claude ships X" virava modelo novo (agora exige versão: "Gemini 4", "GPT-6"), `/filter` do datasets-server falhava (trocado por `/rows`), placar de agentes usa `score`, Mistral Status dá 403, seção de IA do Canaltech parada desde julho.
- Testes: 39.

### 25/10/2026 (Pesquisa)
- Pedido do usuário: área de pesquisa no estilo de anthropic.com/research, uma para cada provedor (Anthropic, OpenAI, Google, Moonshot AI, DeepSeek, Manus, Meta AI, ElevenLabs, Qwen, GLM, Copilot, Grok).
- Coletor `research.ts` (30 min), leitor de cartões `server/lib/cards.ts`, rotas `/api/research`, telas `/pesquisa` e `/pesquisa/:provedor`. Fontes em `docs/fontes.md`.
- Achados: na Anthropic a data fica acima do cartão (o leitor pegava a do vizinho), então vale o `publishedOn` dos dados da página; a busca de artigos do HF traz o campo `organization`, que separa os artigos oficiais dos que só citam o modelo.
- Testes: 57.

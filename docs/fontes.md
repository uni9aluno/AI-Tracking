# Fontes do Radar IA

Conferidas em 25/10/2026. Todas gratuitas e sem chave (o `GITHUB_TOKEN` é opcional). O código de cada coletor está em `server/collectors/`.

## Notícias (`news.ts`, a cada 5 min)

| id | Fonte | Tipo | Observação |
|---|---|---|---|
| openai | `openai.com/news/rss.xml` | laboratório | ~800 KB por leitura |
| deepmind | `deepmind.google/blog/rss.xml` | laboratório | |
| google-ai | `blog.google/technology/ai/rss/` | laboratório | |
| google-research | `research.google/blog/rss/` | laboratório | |
| huggingface | `huggingface.co/blog/feed.xml` | laboratório | |
| mistral | `mistral.ai/rss.xml` | laboratório | responde `text/plain`, conteúdo é RSS |
| microsoft-research | `microsoft.com/en-us/research/feed/` | laboratório | filtrado só para IA |
| nvidia | `blogs.nvidia.com/feed/` | laboratório | filtrado só para IA |
| gnews-labs | Google Notícias, busca "Anthropic OR Claude OR Meta AI OR xAI OR Grok", 2 dias | imprensa | no máximo 12 itens; o veículo sai do fim do título |
| verge, techcrunch, ars, mit-tr | seções de IA | imprensa | |
| simonw | `simonwillison.net/atom/everything/` | imprensa | Atom; filtrado só para IA |
| tecnoblog, canaltech | feeds gerais | imprensa (pt) | filtrados só para IA |
| olhar-digital, infomoney | seções de IA | imprensa (pt) | |
| hn | `hnrss.org`, busca por IA com 100+ pontos | comunidade | pontos lidos da descrição |
| r-localllama, r-machinelearning | Reddit, top do dia | comunidade | o Reddit às vezes responde 429 |

**Fora da lista, e por quê**

- Anthropic, Meta AI e xAI: não publicam RSS (`/rss.xml` e `/news/rss.xml` dão 404). Cobertos pelo Google Notícias.
- Microsoft AI Blog (`blogs.microsoft.com/ai/feed/`): 410 Gone.
- VentureBeat: 429 para servidores.
- Canaltech, seção de IA (`/rss/inteligencia-artificial/`): parou em julho de 2026; trocado pelo feed geral filtrado.

## Artigos (`papers.ts`, a cada 10 min)

- arXiv API (`export.arxiv.org/api/query`, cs.AI/CL/LG/CV, 60 mais recentes). Consultado no máximo a cada 30 min: responde 429 a quem pergunta seguido. O RSS do arXiv (`rss.arxiv.org`) vem vazio nos fins de semana, por isso não é usado.
- Hugging Face Daily Papers (`huggingface.co/api/daily_papers`), ordenado por votos.

## Modelos e preços (`models.ts`, a cada 5 min)

- OpenRouter `GET /api/v1/models` (sem chave): preço por token (convertido para US$ por milhão), contexto, modalidades, parâmetros aceitos, `hugging_face_id` (pesos abertos) e `benchmarks.artificial_analysis` (índices de inteligência, programação e agentes). Preço `-1` (roteadores) vira "varia".

## Em alta (`trending.ts`, a cada 30 min)

- GitHub Search: `topic:llm`, `topic:ai-agents`, `topic:generative-ai`, criados nos últimos 30 dias, por estrelas.
- Hugging Face: `/api/models?sort=trendingScore` e `/api/spaces?sort=trendingScore`.

## Benchmarks (`benchmarks.ts`, a cada hora)

- Dataset `lmarena-ai/leaderboard-dataset` (CC BY 4.0) pelo `datasets-server.huggingface.co/rows`, split `latest`, categoria `overall`. Uma consulta por vez com uma nova tentativa: o servidor de datasets dá 500 e tempo esgotado com frequência, e o endpoint `/filter` falha mais que o `/rows`.
- O placar `agent` usa `score` (0 a 1) em vez de `rating` (Elo); a tela mostra em %.

## Status das APIs (`apiStatus.ts`, a cada 5 min)

- Statuspage `/api/v2/summary.json`: OpenAI, Anthropic, GitHub, Cohere, Perplexity. A Mistral responde 403 a servidores; DeepSeek e Hugging Face não usam Statuspage.

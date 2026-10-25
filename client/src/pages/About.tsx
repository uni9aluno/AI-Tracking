import { TOPICS } from "@shared/types";
import { PageHeader, SourcesPanel } from "@/components/common";
import { useOverview } from "@/lib/api";

const TOPIC_HINT: Record<keyof typeof TOPICS, string> = {
  "novos-modelos": "verbo de lançamento no título com um modelo versionado (\"Gemini 4\", \"GPT-6\") ou a palavra modelo",
  "novas-funcoes": "recurso, atualização, integração, app, API, \"rolls out\", \"ganha\"",
  novidades: "todo post oficial dos laboratórios e o que nenhum outro tópico pegou",
  ciberseguranca: "vulnerabilidade, malware, phishing, golpe, vazamento, deepfake, prompt injection",
  agentes: "agente, agentic, MCP, computer use, automação",
  codigo: "programação, desenvolvedor, Codex, Claude Code, GitHub Copilot, SWE-bench",
  "imagem-video": "imagem, vídeo, Sora, Veo, Midjourney, FLUX",
  "voz-audio": "voz, áudio, música, transcrição, Whisper",
  "open-source": "código aberto, pesos abertos, Hugging Face, Ollama, GGUF",
  pesquisa: "artigo, pesquisa, estudo, benchmark, arXiv",
  negocios: "investimento, aquisição, bilhões, IPO, parceria, demissões",
  regulacao: "lei, regulação, processo, tribunal, direitos autorais, governo",
  hardware: "chip, GPU, data center, NVIDIA, energia",
  robotica: "robô, humanoide, carro autônomo",
  saude: "saúde, médico, hospital, remédio",
  educacao: "escola, aluno, professor, universidade",
  etica: "segurança da IA, alinhamento, viés, desinformação, privacidade",
};

export default function About() {
  const overview = useOverview();
  return (
    <div className="stack prose">
      <PageHeader
        eyebrow="Como funciona"
        title="De onde vem cada número"
        sub="Tudo é coletado de fontes públicas e gratuitas, sem API paga. Nada é digitado à mão, exceto as dicas de ferramentas do guia."
      />
      <section className="card">
        <h2>Ritmo de atualização</h2>
        <ul>
          <li>
            <b>A cada 5 minutos:</b> notícias (21 fontes), modelos e preços (OpenRouter) e status
            das APIs. O navegador também pergunta ao servidor a cada 5 minutos.
          </li>
          <li>
            <b>A cada 10 minutos:</b> artigos do Hugging Face Papers; o arXiv, a cada 30, porque
            bloqueia consultas frequentes e publica uma vez por dia.
          </li>
          <li>
            <b>A cada 30 minutos:</b> em alta no GitHub e no Hugging Face, e a pesquisa dos 12
            provedores (páginas de pesquisa, blogs oficiais e Hugging Face).
          </li>
          <li>
            <b>A cada hora:</b> placares da LMArena (eles mudam algumas vezes por semana).
          </li>
        </ul>
        <p className="muted small">
          O selo do topo fica <b>AO VIVO</b> quando todas as fontes responderam, <b>PARCIAL</b>{" "}
          quando alguma falhou, e <b>DESATUALIZADO</b> se a última coleta tem mais de 12 minutos.
          No Render gratuito o servidor dorme depois de 15 minutos sem visita; ao acordar, coleta
          tudo de novo em cerca de um minuto.
        </p>
      </section>

      <section className="card">
        <h2>Tópicos das notícias</h2>
        <p>
          Cada matéria pode ter vários tópicos, empresas e modelos. A classificação é por palavras
          no título e no começo do resumo, em inglês e português, sem acento e sem diferenciar
          maiúsculas. Erra às vezes; os filtros servem para achar rápido, não como verdade.
        </p>
        <dl className="kv">
          {(Object.keys(TOPICS) as (keyof typeof TOPICS)[]).map(t => (
            <div key={t}>
              <dt>
                <span className={`tag topic-${t}`}>{TOPICS[t]}</span>
              </dt>
              <dd className="muted">{TOPIC_HINT[t]}</dd>
            </div>
          ))}
        </dl>
        <p className="muted small">
          A mesma história publicada por várias fontes aparece uma vez só, com &quot;+N fontes&quot;.
          Os <b>destaques</b> são as histórias das últimas 48 horas carregadas por mais fontes ou
          com muitos pontos no Hacker News. Notícias ficam guardadas por 7 dias.
        </p>
      </section>

      <section className="card">
        <h2>Benchmarks e preços</h2>
        <ul>
          <li>
            <b>LMArena:</b> pessoas comparam duas respostas sem saber de qual modelo são; os votos
            viram uma nota Elo com intervalo de confiança. Dados abertos (CC BY 4.0).
          </li>
          <li>
            <b>Artificial Analysis:</b> índice que junta vários testes padronizados. Chega pela
            OpenRouter junto com o modelo; fica vazio quando o modelo não foi avaliado.
          </li>
          <li>
            <b>Preços:</b> dólares por milhão de tokens na OpenRouter. O preço direto no site de
            cada empresa pode ser um pouco diferente.
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Limites conhecidos</h2>
        <ul>
          <li>Anthropic, Meta e xAI não publicam feed; aparecem pela busca do Google Notícias.</li>
          <li>Manchetes em inglês ficam em inglês (tradução exigiria API paga).</li>
          <li>Reddit e arXiv às vezes recusam consultas (HTTP 429); a coleta seguinte tenta de novo.</li>
          <li>Salvos e lidos ficam só neste navegador.</li>
        </ul>
      </section>

      <SourcesPanel sources={overview.data?.sources ?? []} />
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  Compass,
  Cpu,
  FileText,
  Flame,
  FlaskConical,
  History,
  Home,
  Info,
  Menu,
  Newspaper,
  Trophy,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useOverview } from "@/lib/api";
import { LIVE_LABEL, liveState, type LiveState } from "@/lib/liveStatus";
import { ago } from "@/lib/fmt";

const NAV = [
  { href: "/", label: "Início", icon: Home, tab: true },
  { href: "/noticias", label: "Notícias", icon: Newspaper, tab: true },
  { href: "/modelos", label: "Modelos", icon: Cpu, tab: true },
  { href: "/benchmarks", label: "Benchmarks", icon: Trophy, tab: false },
  { href: "/guia", label: "Qual IA usar", icon: Compass, tab: true },
  { href: "/pesquisa", label: "Pesquisa", icon: FlaskConical, tab: false },
  { href: "/artigos", label: "Artigos", icon: FileText, tab: false },
  { href: "/em-alta", label: "Em alta", icon: Flame, tab: false },
  { href: "/linha-do-tempo", label: "Linha do tempo", icon: History, tab: false },
  { href: "/salvos", label: "Salvos", icon: Bookmark, tab: false },
  { href: "/como-funciona", label: "Como funciona", icon: Info, tab: false },
];

const normalize = (path: string) =>
  path.toLowerCase().replace(/\/+$/, "") || "/";
const CHIP_TONE: Record<LiveState, string> = {
  "ao-vivo": "ok",
  parcial: "warn",
  desatualizado: "warn",
  offline: "bad",
  carregando: "",
};

/** One shell for every route: header, section bar, mobile tab bar with "Mais", focus and title on navigation. */
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const here = normalize(location);
  // A section also owns its sub-pages (/pesquisa/anthropic belongs to /pesquisa).
  const isHere = (href: string) =>
    href === here || (href !== "/" && here.startsWith(`${href}/`));
  const current = NAV.find(item => isHere(item.href));
  const mainRef = useRef<HTMLElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const overview = useOverview();
  const lastFetch =
    overview.data?.sources
      .map(s => s.fetchedAt)
      .sort()
      .at(-1) ?? null;
  const state = liveState({
    hasData: !!overview.data,
    loading: overview.loading,
    error: overview.error,
    updatedAt: lastFetch,
    partial: (overview.data?.counts.failing ?? 0) > 0,
  });

  useEffect(() => {
    document.title = current ? `${current.label} · Radar IA` : "Radar IA";
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
    setMoreOpen(false);
  }, [here, current]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [moreOpen]);

  const inMore = !!current && !current.tab;

  return (
    <div className="shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo" aria-label="Radar IA, início">
            <span className="logo-mark" aria-hidden="true" />
            <span>
              Radar IA
              <small>Notícias, modelos e benchmarks</small>
            </span>
          </Link>
          <div className="header-status">
            {lastFetch && (
              <span className="muted small hide-sm" title={new Date(lastFetch).toLocaleString("pt-BR")}>
                coletado {ago(lastFetch)}
              </span>
            )}
            <Link
              href="/como-funciona"
              className={`chip ${CHIP_TONE[state]}`}
              title="Situação das fontes. Detalhes em Como funciona."
            >
              <span
                className={`chip-dot ${state === "ao-vivo" ? "pulse" : ""}`}
                aria-hidden="true"
              />
              {LIVE_LABEL[state]}
            </Link>
          </div>
        </div>
        <nav className="nav" aria-label="Seções">
          <div className="nav-inner">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isHere(item.href) ? "page" : undefined}
              >
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main
        id="conteudo"
        className="main fade-in"
        key={here}
        ref={mainRef}
        tabIndex={-1}
      >
        {children}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span>Radar IA · painel pessoal, coletado de fontes públicas a cada 5 minutos.</span>
          <span>
            Placares: <a href="https://lmarena.ai">LMArena</a> (CC BY 4.0) ·
            índices: <a href="https://artificialanalysis.ai">Artificial Analysis</a> via{" "}
            <a href="https://openrouter.ai/models">OpenRouter</a>
          </span>
        </div>
      </footer>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <nav
            className="sheet"
            aria-label="Mais seções"
            onClick={event => event.stopPropagation()}
          >
            <div className="sheet-head">
              <b>Mais seções</b>
              <button className="icon-btn" onClick={() => setMoreOpen(false)} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>
            {NAV.filter(i => !i.tab).map(item => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isHere(item.href) ? "page" : undefined}
              >
                <item.icon size={20} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <nav className="tabbar" aria-label="Seções principais">
        {NAV.filter(i => i.tab).map(item => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isHere(item.href) ? "page" : undefined}
          >
            <item.icon size={22} aria-hidden="true" />
            {item.href === "/guia" ? "Guia" : item.label}
          </Link>
        ))}
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-current={inMore ? "page" : undefined}
          onClick={() => setMoreOpen(open => !open)}
        >
          <Menu size={22} aria-hidden="true" />
          Mais
        </button>
      </nav>
    </div>
  );
}

export default AppShell;

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Catches a crash in one page so the rest of the panel keeps working (auditoria F6). */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <section className="empty-state" role="alert">
        <p className="eyebrow">Algo deu errado</p>
        <h1>Esta parte do painel não carregou</h1>
        <p className="muted">
          As outras páginas continuam funcionando. Tente recarregar.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </button>
        {import.meta.env.DEV && (
          <details>
            <summary>Detalhes técnicos</summary>
            <pre className="formula">{error.stack}</pre>
          </details>
        )}
      </section>
    );
  }
}

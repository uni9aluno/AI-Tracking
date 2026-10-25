import { Link } from "wouter";

/** Unknown routes render inside the shell, keeping the typed URL. */
export default function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">Erro 404</p>
      <h1>Página não encontrada</h1>
      <p className="muted">O endereço digitado não existe neste painel.</p>
      <Link href="/" className="btn btn-primary">
        Voltar ao início
      </Link>
    </section>
  );
}

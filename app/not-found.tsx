import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <section aria-labelledby="not-found-title" className="hero">
        <p className="eyebrow">Pomelo ERP</p>
        <h1 id="not-found-title">Page not found</h1>
        <p className="lede">The requested application page does not exist.</p>
        <div className="actions">
          <Link className="button primary" href="/">
            Go to dashboard
          </Link>
          <Link className="button" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

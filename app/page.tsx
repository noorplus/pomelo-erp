import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Pomelo ERP</p>
        <h1>Business operations, built on a solid foundation.</h1>
        <p className="lede">
          The application foundation is ready for authentication, organization
          context, and the ERP modules that will consume the frozen database.
        </p>
        <div className="actions">
          <Link className="button primary" href="/login">
            Sign in
          </Link>
          <a
            className="button secondary"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noreferrer"
          >
            Next.js docs
          </a>
        </div>
      </section>
    </main>
  );
}
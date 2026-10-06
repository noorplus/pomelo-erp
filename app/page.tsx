import { AppShell } from "@/components/app/app-shell";

export default function HomePage() {
  return (
    <AppShell>
      <section className="page">
        <div className="page-header">
          <div>
            <p className="eyebrow">Overview</p>
            <h1>Dashboard</h1>
          </div>
        </div>
        <div className="content-card">
          <p className="lede">
            Your organization workspace is ready. ERP modules will be added here using reusable, database-backed features.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
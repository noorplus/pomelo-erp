type ModulePlaceholderProps = { title: string; description?: string };

export function ModulePlaceholder({ title, description }: ModulePlaceholderProps) {
  return (
    <section className="module-workspace">
      <div className="workspace-card">
        <p className="eyebrow">ERP module</p>
        <h1>{title}</h1>
        <p>{description ?? "This module is intentionally empty while we build it database-first."}</p>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

export function PageSection({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ui-page-section">
      {title || description || actions ? (
        <div className="ui-section-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div className="ui-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

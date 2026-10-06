import type { ReactNode } from "react";

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this data. Please try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div aria-live="assertive" className="ui-state ui-error-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? <div className="ui-state-action">{action}</div> : null}
    </div>
  );
}

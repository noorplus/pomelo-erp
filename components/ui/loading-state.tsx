export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" className="ui-state">
      <span className="ui-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

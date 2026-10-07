export type EntityOption = { id: string; label: string; description?: string };

export function EntitySelector({ label, value, options, onChange, placeholder = "Select…" }: {
  label?: string; value: string; options: EntityOption[]; onChange: (id: string) => void; placeholder?: string;
}) {
  return (
    <label className="ui-entity-selector">
      {label ? <span>{label}</span> : null}
      <select className="ui-input ui-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

"use client";

import { Search, X } from "lucide-react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  ariaLabel = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="ui-search">
      <Search aria-hidden="true" size={17} />
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
      {value ? (
        <button aria-label="Clear search" type="button" onClick={() => onChange("")}>
          <X size={16} />
        </button>
      ) : null}
    </div>
  );
}

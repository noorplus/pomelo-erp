"use client";

import { useActionState } from "react";
import { toggleUnit, type UnitActionState } from "./actions";

export function UnitStatusForm({ id, active }: { id: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(toggleUnit, {});
  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="next_active" value={String(!active)} />
      <button className="text-button" type="submit" disabled={pending}>
        {pending ? "Saving…" : active ? "Deactivate" : "Activate"}
      </button>
      {state.error ? <span className="inline-error">{state.error}</span> : null}
    </form>
  );
}

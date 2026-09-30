"use client";

import { useActionState } from "react";
import { toggleProduct, type ProductActionState } from "./actions";

export function ProductStatusForm({
  id,
  active,
}: {
  id: string;
  active: boolean;
}) {
  const [state, formAction, pending] = useActionState(toggleProduct, {});

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

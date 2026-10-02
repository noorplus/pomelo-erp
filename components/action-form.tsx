"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/erp/types";

export function ActionForm({ action, children, submitLabel="Save" }: { action:(fd:FormData)=>Promise<ActionState>; children:React.ReactNode; submitLabel?:string }) {
  const [state,setState]=useState<ActionState>({});
  const [pending,setPending]=useState(false);
  return <form className="erp-form" onSubmit={async e=>{e.preventDefault();setPending(true);setState({});const r=await action(new FormData(e.currentTarget));setState(r);setPending(false);}}>
    {children}
    {state.error&&<p className="form-message error" role="alert">{state.error}</p>}
    {state.success&&<p className="form-message success" role="status">{state.success}</p>}
    <button className="primary-button" disabled={pending}>{pending?"Saving...":submitLabel}</button>
  </form>;
}

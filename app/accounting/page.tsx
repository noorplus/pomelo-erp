import { ErpPageShell } from "@/components/erp-page-shell";
import { DataTable, DataTableEmpty } from "@/components/data-table";
import { ActionForm } from "@/components/action-form";
import { JournalForm } from "@/components/journal-form";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { postManualJournal, reverseJournal } from "@/app/erp/actions";

export default async function AccountingPage(){
  const org=await getCurrentOrganization();
  const supabase=await createClient();

  const [{data:accounts},{data:periods},{data:journals,error}]=await Promise.all([
    supabase
      .from("accounts")
      .select("id,account_code,account_name,account_type,normal_balance,is_control_account,is_postable,is_active")
      .eq("organization_id",org.id)
      .eq("is_active",true)
      .eq("is_postable",true)
      .order("account_code"),
    supabase
      .from("accounting_periods")
      .select("id,name,start_date,end_date,status")
      .eq("organization_id",org.id)
      .order("start_date",{ascending:false}),
    supabase
      .from("journal_entries")
      .select("id,entry_number,entry_date,entry_type,status,description,reversal_of_id")
      .eq("organization_id",org.id)
      .order("entry_date",{ascending:false})
      .limit(200),
  ]);

  const openPeriods=(periods??[]).filter(x=>x.status==="open");
  const canPost=org.role==="owner"||org.role==="admin";
  const defaultEntryDate=openPeriods[0]?.start_date??new Date().toISOString().slice(0,10);

  return (
    <ErpPageShell>
      <div className="module-page">
        <div className="page-heading">
          <div className="page-heading-copy">
            <p className="eyebrow">Finance</p>
            <h1>Accounting</h1>
            <p>Double-entry ledger with controlled manual, opening-balance, and reversal workflows.</p>
          </div>
        </div>

        <section className="metric-grid">
          <div className="metric-card"><span>Postable accounts</span><strong>{accounts?.length??0}</strong></div>
          <div className="metric-card"><span>Open periods</span><strong>{openPeriods.length}</strong></div>
          <div className="metric-card"><span>Posted journals</span><strong>{(journals??[]).filter(x=>x.status==="posted").length}</strong></div>
          <div className="metric-card"><span>Recent journals</span><strong>{journals?.length??0}</strong></div>
        </section>

        <section className="panel accounting-posting-panel">
          <div className="panel-heading">
            <div>
              <h2>Post journal</h2>
              <p>Use <strong>Opening balance</strong> for initial ledger balances and <strong>Manual</strong> for non-operational adjustments.</p>
            </div>
          </div>

          {!openPeriods.length && (
            <div className="form-message error config-feedback">
              No open accounting period is available. Open a period before posting a journal.
            </div>
          )}

          {!canPost && (
            <div className="form-message error config-feedback">
              Your organization role ({org.role}) is not authorized to post journals. Only owner or admin can post.
            </div>
          )}

          <JournalForm
            action={postManualJournal}
            accounts={accounts??[]}
            canPost={canPost && openPeriods.length>0}
            defaultEntryDate={defaultEntryDate}
          />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Journal register</h2>
              <p>{journals?.length??0} recent entries</p>
            </div>
          </div>
          {error
            ? <DataTableEmpty title="Unable to load journals" description={error.message}/>
            : journals?.length
              ? <DataTable minWidth={900}>
                  <thead>
                    <tr><th>Number</th><th>Date</th><th>Type</th><th>Status</th><th>Description</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {journals.map(x=>(
                      <tr key={x.id}>
                        <td>{x.entry_number}</td>
                        <td>{x.entry_date}</td>
                        <td><span className={`journal-type-badge journal-type-${x.entry_type}`}>{x.entry_type}</span></td>
                        <td>{x.status}</td>
                        <td>{x.description??"—"}</td>
                        <td>
                          {x.entry_type==="manual"&&x.status==="posted"
                            ? <ActionForm action={reverseJournal} submitLabel="Reverse">
                                <input type="hidden" name="id" value={x.id}/>
                                <input type="hidden" name="reversal_date" value={new Date().toISOString().slice(0,10)}/>
                              </ActionForm>
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              : <DataTableEmpty title="No journal entries" description="Posted operational documents and manual/opening journals will appear here."/>
          }
        </section>
      </div>
    </ErpPageShell>
  );
}

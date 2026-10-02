import { ErpPageShell } from "@/components/erp-page-shell";
import { ActionForm } from "@/components/action-form";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { createClient } from "@/lib/supabase/server";
import { createAndPostExpense } from "@/app/erp/actions";

export default async function ExpensesPage(){
 const org=await getCurrentOrganization(),supabase=await createClient();
 const [{data:categories},{data:contacts},{data:accounts},{data:expenses}]=await Promise.all([
  supabase.from("expense_categories").select("id,category_code,name").eq("organization_id",org.id).eq("is_active",true).order("category_code"),
  supabase.from("contacts").select("id,name,contact_number").eq("organization_id",org.id).eq("is_active",true).order("name"),
  supabase.from("accounts").select("id,account_code,account_name,account_type").eq("organization_id",org.id).eq("is_active",true).eq("is_postable",true).order("account_code"),
  supabase.from("expenses").select("id,expense_number,expense_category_id,expense_date,amount,status,description").eq("organization_id",org.id).order("created_at",{ascending:false}).limit(100)
 ]);
 const liabilities=(accounts??[]).filter(x=>x.account_type==="liability");
 return <ErpPageShell><div className="module-page"><div className="page-heading"><div><p className="eyebrow">Finance</p><h1>Expenses</h1><p>Post operating expenses through the existing category and double-entry workflow.</p></div></div>
 <section className="panel"><div className="panel-heading"><div><h2>New expense</h2><p>The posting RPC creates the expense debit and payable credit atomically.</p></div></div><ActionForm action={createAndPostExpense} submitLabel="Create & post"><div className="form-grid"><label><span>Category</span><select name="expense_category_id" required><option value="">Select...</option>{(categories??[]).map(x=><option key={x.id} value={x.id}>{x.category_code} · {x.name}</option>)}</select></label><label><span>Contact</span><select name="contact_id"><option value="">No contact</option>{(contacts??[]).map(x=><option key={x.id} value={x.id}>{x.contact_number} · {x.name}</option>)}</select></label><label><span>Payable account</span><select name="payable_account_id" required><option value="">Select...</option>{liabilities.map(x=><option key={x.id} value={x.id}>{x.account_code} · {x.account_name}</option>)}</select></label><label><span>Date</span><input name="expense_date" type="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label><label><span>Amount</span><input name="amount" type="number" min="0.01" step="0.00000001" required/></label><label><span>Description</span><input name="description"/></label></div></ActionForm></section>
 <section className="panel"><div className="panel-heading"><div><h2>Expense register</h2><p>{expenses?.length??0} recent records</p></div></div><div className="data-table-scroll"><table className="data-table"><thead><tr><th>Number</th><th>Date</th><th>Category</th><th>Amount</th><th>Status</th></tr></thead><tbody>{(expenses??[]).map(x=><tr key={x.id}><td>{x.expense_number}</td><td>{x.expense_date}</td><td>{categories?.find(c=>c.id===x.expense_category_id)?.name??"—"}</td><td className="numeric">{Number(x.amount).toFixed(2)}</td><td>{x.status}</td></tr>)}</tbody></table></div></section>
 </div></ErpPageShell>;
}
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { UnitForm } from "./unit-form";
import { UnitStatusForm } from "./status-form";

type SearchParams = Promise<{ q?: string; edit?: string }>;

export default async function UnitsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = (params.q ?? "").replace(/[^a-zA-Z0-9 _./-]/g, "").trim().slice(0, 50);
  const editId = params.edit ?? "";

  const supabase = await createClient();
  const organization = await getCurrentOrganization();

  let unitQuery = supabase
    .from("units_of_measure")
    .select("id, name, is_active, created_at")
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  if (q) unitQuery = unitQuery.ilike("name", `%${q}%`);

  const [{ data: units, error: unitsError }, { data: products, error: productsError }] = await Promise.all([
    unitQuery,
    supabase.from("products").select("id, unit_id, is_active").eq("organization_id", organization.id),
  ]);

  if (unitsError || productsError) throw new Error("Unable to load units of measure.");

  const productUsage = new Map<string, { total: number; active: number }>();
  for (const product of products ?? []) {
    const current = productUsage.get(product.unit_id) ?? { total: 0, active: 0 };
    current.total += 1;
    if (product.is_active) current.active += 1;
    productUsage.set(product.unit_id, current);
  }

  const editUnit = editId ? (units ?? []).find((unit) => unit.id === editId) ?? null : null;
  const canManage = ["owner", "admin", "manager"].includes(organization.role);
  const activeCount = (units ?? []).filter((unit) => unit.is_active).length;
  const inactiveCount = (units ?? []).length - activeCount;
  const usedCount = (units ?? []).filter((unit) => (productUsage.get(unit.id)?.total ?? 0) > 0).length;

  return (
    <div className="settings-page">
      <section className="page-heading">
        <div>
          <Link href="/settings" className="back-link">← Settings</Link>
          <p className="eyebrow">Settings · Master data</p>
          <h1>Units of measure</h1>
          <p>Organization-scoped units used by the product master, purchasing, sales and inventory.</p>
        </div>
        <span className="settings-role-badge">{canManage ? "Manage units" : "Read-only"}</span>
      </section>

      <section className="metric-grid">
        <article className="metric-card"><span>Total units</span><strong>{units?.length ?? 0}</strong><small>Organization scoped</small></article>
        <article className="metric-card"><span>Active</span><strong>{activeCount}</strong><small>Available for new products</small></article>
        <article className="metric-card"><span>Inactive</span><strong>{inactiveCount}</strong><small>Retained for history</small></article>
        <article className="metric-card"><span>In use</span><strong>{usedCount}</strong><small>Referenced by products</small></article>
      </section>

      <section className="workspace-grid">
        {canManage ? (
          <div className="panel">
            <div className="panel-heading">
              <div><h2>{editUnit ? "Edit unit" : "Create unit"}</h2><p>Maintain the reusable units that products reference through the unit_id relationship.</p></div>
            </div>
            <UnitForm unit={editUnit} />
          </div>
        ) : (
          <div className="panel settings-note read-only-panel">
            <strong>Read-only access</strong>
            <span>Your organization role ({organization.role}) can view units, but only Owner, Admin and Manager roles can create, edit or activate/deactivate them.</span>
          </div>
        )}

        <div className="panel">
          <div className="panel-heading">
            <div><h2>Unit list</h2><p>{units?.length ?? 0} unit{units?.length === 1 ? "" : "s"}</p></div>
            <form method="get" className="search-form">
              <input name="q" defaultValue={q} placeholder="Search unit name" aria-label="Search units" />
              <button className="secondary-button compact" type="submit">Search</button>
            </form>
          </div>
          {units && units.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Unit</th><th>Product usage</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {units.map((unit) => {
                    const usage = productUsage.get(unit.id) ?? { total: 0, active: 0 };
                    return (
                      <tr key={unit.id}>
                        <td><strong>{unit.name}</strong></td>
                        <td><strong>{usage.total}</strong><span>{usage.active} active product{usage.active === 1 ? "" : "s"}</span></td>
                        <td><span className={unit.is_active ? "status-pill active" : "status-pill"}>{unit.is_active ? "Active" : "Inactive"}</span></td>
                        <td className="row-actions">
                          {canManage ? <><Link href={`/settings/units?edit=${unit.id}`} className="text-button">Edit</Link><UnitStatusForm id={unit.id} active={unit.is_active} /></> : <span className="settings-coming">View only</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <strong>{q ? "No matching units" : "No units yet"}</strong>
              <span>{q ? "Try a different unit name." : "Create your first unit using the form."}</span>
            </div>
          )}
        </div>
      </section>

      <section className="settings-note">
        <strong>Data rule</strong>
        <span>Units are reusable master data. Products reference a unit through organization_id + unit_id, so deactivation is preferred over deletion when a unit has historical or product usage.</span>
      </section>
    </div>
  );
}

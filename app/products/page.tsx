import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/lib/supabase/organization";
import { ProductForm } from "./product-form";
import { ProductStatusForm } from "./status-form";

type SearchParams = Promise<{ q?: string; edit?: string }>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").replace(/[^a-zA-Z0-9 _./-]/g, "").trim().slice(0, 50);
  const editId = params.edit ?? "";

  const supabase = await createClient();
  const organization = await getCurrentOrganization();

  let productQuery = supabase
    .from("products")
    .select("id, product_code, name, description, unit_id, inventory_account_id, sales_account_id, cogs_account_id, is_active, created_at")
    .eq("organization_id", organization.id)
    .order("product_code", { ascending: true });

  if (q) {
    productQuery = productQuery.or(`product_code.ilike.%${q}%,name.ilike.%${q}%`);
  }

  const [
    { data: products, error: productsError },
    { data: units, error: unitsError },
    { data: accounts, error: accountsError },
  ] = await Promise.all([
    productQuery,
    supabase.from("units_of_measure").select("id, code, name, symbol").eq("organization_id", organization.id).eq("is_active", true).order("code"),
    supabase.from("accounts").select("id, account_code, account_name, account_type").eq("organization_id", organization.id).eq("is_active", true).eq("is_postable", true).order("account_code"),
  ]);

  if (productsError || unitsError || accountsError) {
    throw new Error("Unable to load product master data.");
  }

  const unitMap = new Map((units ?? []).map((unit) => [
    unit.id,
    `${unit.code} — ${unit.name}${unit.symbol ? ` (${unit.symbol})` : ""}`,
  ]));

  const accountMap = new Map((accounts ?? []).map((account) => [
    account.id,
    `${account.account_code} — ${account.account_name}`,
  ]));

  const editProduct = editId
    ? (products ?? []).find((product) => product.id === editId) ?? null
    : null;

  return (
    <div className="products-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Master data</p>
          <h1>Products</h1>
          <p>{organization.name} · Product master and accounting mappings.</p>
        </div>
        <Link href="/products" className="primary-button compact">New product</Link>
      </section>

      <section className="workspace-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>{editProduct ? "Edit product" : "Create product"}</h2>
              <p>Product master fields only. Transactional values are captured on invoices.</p>
            </div>
          </div>
          <ProductForm
            product={editProduct}
            units={(units ?? []).map((unit) => ({
              id: unit.id,
              label: `${unit.code} — ${unit.name}${unit.symbol ? ` (${unit.symbol})` : ""}`,
            }))}
            accounts={(accounts ?? []).map((account) => ({
              id: account.id,
              label: `${account.account_code} — ${account.account_name}`,
            }))}
          />
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Product list</h2>
              <p>{products?.length ?? 0} product{products?.length === 1 ? "" : "s"}</p>
            </div>
            <form method="get" className="search-form">
              <input name="q" defaultValue={q} placeholder="Search code or name" aria-label="Search products" />
              <button className="secondary-button compact" type="submit">Search</button>
            </form>
          </div>

          {products && products.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit</th>
                    <th>Account mapping</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.product_code}</strong>
                        <span>{product.name}</span>
                      </td>
                      <td>{unitMap.get(product.unit_id) ?? "—"}</td>
                      <td>
                        <span>{accountMap.get(product.inventory_account_id) ?? "—"}</span>
                        <span>{accountMap.get(product.sales_account_id) ?? "—"}</span>
                        <span>{accountMap.get(product.cogs_account_id) ?? "—"}</span>
                      </td>
                      <td>
                        <span className={product.is_active ? "status-pill active" : "status-pill"}>
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="row-actions">
                        <Link href={`/products?edit=${product.id}`} className="text-button">Edit</Link>
                        <ProductStatusForm id={product.id} active={product.is_active} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <strong>{q ? "No matching products" : "No products yet"}</strong>
              <span>{q ? "Try a different product code or name." : "Create your first product using the form."}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

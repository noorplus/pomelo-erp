/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable, PageHeader, PageSection, SearchInput, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate, formatNumber } from "@/lib/formatters";

type InventoryRow = any;

export function InventoryDashboard({
  balances,
  recentTransactions,
  currency = "BDT",
}: {
  balances: InventoryRow[];
  recentTransactions: InventoryRow[];
  currency?: string;
}) {
  const money = (value: number) => formatCurrency(value, currency);
  const [movementQuery, setMovementQuery] = useState("");
  const filteredMovements = useMemo(() => {
    const query = movementQuery.trim().toLowerCase();
    if (!query) return recentTransactions;
    return recentTransactions.filter((row) =>
      [row.transaction_number, row.transaction_type, row.direction, row.product?.name, row.transaction_date]
        .some((value) => String(value ?? "").toLowerCase().includes(query)),
    );
  }, [movementQuery, recentTransactions]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory"
        title="Inventory overview"
        description="Review current stock balances, inventory value, and the latest database-generated movements."
      />
      <PageSection title="Stock summary">
        <div className="ui-detail-grid">
          <div><span>Products in stock</span><strong>{balances.filter((row) => Number(row.quantity) > 0).length}</strong></div>
          <div><span>Stock records</span><strong>{formatNumber(balances.length)}</strong></div>
          <div><span>Inventory value</span><strong>{money(balances.reduce((sum, row) => sum + Number(row.inventory_value ?? 0), 0))}</strong></div>
        </div>
      </PageSection>
      <PageSection title="Current stock" description={`${balances.length} product balance${balances.length === 1 ? "" : "s"}`}>
        <DataTable
          rows={balances}
          columns={[
            { key: "product", header: "Product", render: (row) => <Link href={`/inventory/products/${row.product_id}`}>{row.product?.product_code ? row.product.product_code + " — " : ""}{row.product?.name ?? "—"}</Link> },
            { key: "qty", header: "Quantity", align: "right", render: (row) => formatNumber(Number(row.quantity ?? 0)) },
            { key: "cost", header: "Average cost", align: "right", render: (row) => money(Number(row.average_cost ?? 0)) },
            { key: "value", header: "Value", align: "right", render: (row) => money(Number(row.inventory_value ?? 0)) },
            { key: "status", header: "Status", render: (row) => <StatusBadge tone={Number(row.quantity) > 0 ? "success" : "neutral"}>{Number(row.quantity) > 0 ? "In stock" : "Zero"}</StatusBadge> },
          ]}
          empty="No stock balances found."
        />
      </PageSection>
      <PageSection title="Recent movements" description={`${filteredMovements.length} of ${recentTransactions.length} recent movements`} actions={<SearchInput value={movementQuery} onChange={setMovementQuery} placeholder="Search movement, product or direction" />}>
        <DataTable
          rows={filteredMovements}
          columns={[
            { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
            { key: "number", header: "Transaction", render: (row) => row.transaction_number ?? "—" },
            { key: "product", header: "Product", render: (row) => row.product?.name ?? "—" },
            { key: "direction", header: "Direction", render: (row) => <StatusBadge tone={row.direction === "IN" ? "success" : "danger"}>{row.direction ?? "—"}</StatusBadge> },
            { key: "qty", header: "Quantity", align: "right", render: (row) => formatNumber(Number(row.quantity ?? 0)) },
            { key: "value", header: "Value", align: "right", render: (row) => money(Number(row.total_value ?? 0)) },
          ]}
          empty="No recent inventory movements match your search."
        />
      </PageSection>
    </div>
  );
}

export function InventoryStock({ rows, currency = "BDT" }: { rows: InventoryRow[]; currency?: string }) {
  const money = (value: number) => formatCurrency(value, currency);
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? rows.filter((row) => [row.product?.product_code, row.product?.name, row.unit?.name]
          .some((field) => String(field ?? "").toLowerCase().includes(value)))
      : rows;
  }, [query, rows]);

  return (
    <div className="page">
      <PageHeader eyebrow="Inventory" title="Current stock" description="Read-only inventory balances from the existing inventory engine." />
      <PageSection title="Stock balances" description={`${filteredRows.length} of ${rows.length} balances`} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search product code, name or unit" />}>
        <DataTable rows={filteredRows} columns={[
          { key: "product", header: "Product", render: (row) => <Link href={`/inventory/products/${row.product_id}`}>{row.product?.product_code ? row.product.product_code + " — " : ""}{row.product?.name ?? "—"}</Link> },
          { key: "unit", header: "Unit", render: (row) => row.unit?.name ?? "—" },
          { key: "qty", header: "Quantity", align: "right", render: (row) => formatNumber(Number(row.quantity ?? 0)) },
          { key: "avg", header: "Average cost", align: "right", render: (row) => money(Number(row.average_cost ?? 0)) },
          { key: "value", header: "Inventory value", align: "right", render: (row) => money(Number(row.inventory_value ?? 0)) },
        ]} empty="No stock balances match your search." />
      </PageSection>
    </div>
  );
}

export function InventoryTransactions({ rows, currency = "BDT" }: { rows: InventoryRow[]; currency?: string }) {
  const money = (value: number) => formatCurrency(value, currency);
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value
      ? rows.filter((row) => [row.transaction_number, row.transaction_type, row.direction, row.product?.name]
          .some((field) => String(field ?? "").toLowerCase().includes(value)))
      : rows;
  }, [query, rows]);

  return (
    <div className="page">
      <PageHeader eyebrow="Inventory" title="Inventory transactions" description="Database-generated movements; the app does not write directly to inventory transaction records." />
      <PageSection title="Transactions" description={`${filteredRows.length} of ${rows.length} transactions`} actions={<SearchInput value={query} onChange={setQuery} placeholder="Search transaction, type or product" />}>
        <DataTable rows={filteredRows} columns={[
          { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
          { key: "number", header: "Transaction", render: (row) => row.transaction_number ?? "—" },
          { key: "product", header: "Product", render: (row) => row.product?.name ?? "—" },
          { key: "type", header: "Type", render: (row) => row.transaction_type ?? "—" },
          { key: "direction", header: "Direction", render: (row) => <StatusBadge tone={row.direction === "IN" ? "success" : "danger"}>{row.direction ?? "—"}</StatusBadge> },
          { key: "qty", header: "Quantity", align: "right", render: (row) => formatNumber(Number(row.quantity ?? 0)) },
          { key: "cost", header: "Unit cost", align: "right", render: (row) => money(Number(row.unit_cost ?? 0)) },
          { key: "value", header: "Value", align: "right", render: (row) => money(Number(row.total_value ?? 0)) },
          { key: "avg", header: "Average after", align: "right", render: (row) => money(Number(row.average_cost_after ?? 0)) },
        ]} empty="No inventory transactions match your search." />
      </PageSection>
    </div>
  );
}

export function ProductInventory({
  product,
  balance,
  unit,
  transactions,
  currency = "BDT",
}: {
  product: InventoryRow;
  balance: InventoryRow;
  unit: InventoryRow;
  transactions: InventoryRow[];
  currency?: string;
}) {
  const money = (value: number) => formatCurrency(value, currency);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Inventory / Product"
        title={product.name}
        description={product.product_code ?? "Product"}
        actions={<Link className="button" href={`/products/${product.id}`}>Product details</Link>}
      />
      <PageSection title="Stock summary">
        <div className="ui-detail-grid">
          <div><span>Quantity</span><strong>{formatNumber(Number(balance?.quantity ?? 0))}{unit?.name ? ` ${unit.name}` : ""}</strong></div>
          <div><span>Average cost</span><strong>{money(Number(balance?.average_cost ?? 0))}</strong></div>
          <div><span>Inventory value</span><strong>{money(Number(balance?.inventory_value ?? 0))}</strong></div>
        </div>
      </PageSection>
      <PageSection title="Movement history" description={`${transactions.length} inventory movements`}>
        <DataTable rows={transactions} columns={[
          { key: "date", header: "Date", render: (row) => formatDate(row.transaction_date) },
          { key: "number", header: "Transaction", render: (row) => row.transaction_number ?? "—" },
          { key: "type", header: "Type", render: (row) => row.transaction_type ?? "—" },
          { key: "direction", header: "Direction", render: (row) => <StatusBadge tone={row.direction === "IN" ? "success" : "danger"}>{row.direction ?? "—"}</StatusBadge> },
          { key: "qty", header: "Quantity", align: "right", render: (row) => formatNumber(Number(row.quantity ?? 0)) },
          { key: "cost", header: "Unit cost", align: "right", render: (row) => money(Number(row.unit_cost ?? 0)) },
          { key: "value", header: "Total", align: "right", render: (row) => money(Number(row.total_value ?? 0)) },
          { key: "avg", header: "Average after", align: "right", render: (row) => money(Number(row.average_cost_after ?? 0)) },
        ]} empty="No product inventory movements found." />
      </PageSection>
    </div>
  );
}

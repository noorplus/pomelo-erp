import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationDir = path.join(root, "supabase", "migrations");
const migrationFiles = fs.readdirSync(migrationDir).filter(name => name.endsWith(".sql"));
const frozenTables = [
  "profiles","organizations","organization_users","units_of_measure","products","contacts",
  "number_sequences","accounts","journal_entries","account_transactions","accounting_periods",
  "purchase_invoices","purchase_items","sales_invoices","sales_items","inventory_balances",
  "inventory_transactions","expense_categories","expenses","payments","payment_allocations"
];
const frozenRpcs = [
  "post_purchase_invoice","post_sales_invoice","post_expense","post_payment",
  "post_manual_journal","reverse_journal"
];

function sourceFiles(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) result.push(full);
  }
  return result;
}

test("frozen database contains exactly one migration", () => {
  assert.deepEqual(migrationFiles, ["20260930140000_initial_erp_schema.sql"]);
});

test("application references only frozen public tables", () => {
  const source = sourceFiles(path.join(root, "app")).map(file => fs.readFileSync(file, "utf8")).join("\n");
  const refs = [...source.matchAll(/\.from\(["']([^"']+)["']\)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(refs.filter(ref => !frozenTables.includes(ref)))], []);
});

test("application uses only approved transactional RPCs", () => {
  const source = sourceFiles(path.join(root, "app")).map(file => fs.readFileSync(file, "utf8")).join("\n");
  const refs = [...source.matchAll(/\.rpc\(["']([^"']+)["']/g)].map(match => match[1]);
  assert.deepEqual([...new Set(refs.filter(ref => !frozenRpcs.includes(ref)))], []);
});

test("critical frozen-db lifecycle guards remain application enforced", () => {
  const config = fs.readFileSync(path.join(root, "app", "configuration", "actions.ts"), "utf8");
  assert.match(config, /Closed accounting periods are immutable/);
  assert.match(config, /Closed accounting periods cannot be reopened/);
  assert.match(config, /System accounts are protected/);
  assert.match(config, /Next number cannot be moved backwards/);
  const invoice = fs.readFileSync(path.join(root, "components", "invoice-form.tsx"), "utf8");
  assert.match(invoice, /invoice_id/);
});

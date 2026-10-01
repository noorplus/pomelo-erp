/*
================================================================================
Pomelo ERP - Approved Database Column Corrections
================================================================================

Approved changes:
  - Remove organizations.legal_name
  - Remove units_of_measure.code
  - Remove units_of_measure.symbol

All other approved table columns remain unchanged.

This migration is repository-only. It does not apply to any Supabase project
until the migration chain is explicitly deployed.

================================================================================
*/

alter table public.organizations
  drop column legal_name;

alter table public.units_of_measure
  drop column code,
  drop column symbol;

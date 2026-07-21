-- Phase 1 of the unit-agnostic engine: the counting unit becomes a PROJECT
-- field (files, lines, records, VINs…). Tasks inherit it via their existing
-- forecast_unit unless they override; null = team operating model default,
-- then "files" (today's behavior, unchanged).
alter table projects
  add column if not exists forecast_unit text;

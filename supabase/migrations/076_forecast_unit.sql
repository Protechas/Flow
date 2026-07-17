-- Per-task tracking unit (ID3 lane request, July 17 call with Christopher):
-- "minutes per file" becomes minutes per file / line / VIN / RO / batch...
-- Null means "files" (the historical default). The unit is a LABEL — all
-- forecast math is unchanged (count × minutes-per-unit).
alter table work_items add column if not exists forecast_unit text;

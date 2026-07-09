-- Activate the ID3 Validation engine: manufacturer chart vs rules workbook
-- comparison, processed by the audit worker.

UPDATE validation_engines
SET label = 'ID³ Validation',
    description = 'Compare manufacturer charts against the rules workbook — coverage gaps, rule mismatches, and unruled entries',
    status = 'active'
WHERE id = 'id3_validation';

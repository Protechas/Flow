-- Activate the Library Validation engine (ported from the Audit App's
-- Library Validation Center) so runs can be created against it.

UPDATE validation_engines
SET label = 'Library Validation',
    description = 'Validate external reports against the audited SI Library baseline',
    status = 'active'
WHERE id = 'si_library_external';

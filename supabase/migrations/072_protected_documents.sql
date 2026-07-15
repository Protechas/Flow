-- Protected company documents: the SOPs that steer Eddy's QA judgment are a
-- tampering target — editing them would reprogram the AI's standards. Only
-- admin-level users may edit, move, or delete a protected document; everyone
-- with document access can still read it.
ALTER TABLE company_documents ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

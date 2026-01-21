-- Add retail_catalog_id to stores table to link a specific catalog for retail
ALTER TABLE stores 
ADD COLUMN retail_catalog_id uuid REFERENCES catalogs(id) ON DELETE SET NULL;
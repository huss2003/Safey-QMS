-- Add GTIN to products and serial_number to production_batches
-- for Product Summary section in traceability and label generation

ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin text;
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS serial_number text;

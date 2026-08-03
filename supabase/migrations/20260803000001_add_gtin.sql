-- Add gtin column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin text;

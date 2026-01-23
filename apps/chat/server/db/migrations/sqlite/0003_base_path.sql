-- Add basePath column to sources table
ALTER TABLE sources ADD COLUMN base_path TEXT DEFAULT '/docs';

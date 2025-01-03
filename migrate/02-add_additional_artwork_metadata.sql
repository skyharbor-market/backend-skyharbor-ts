-- apply migration
-- psql -U postgres -h 127.0.0.1 -d skyharbor < migrate/02-add_additional_artwork_metadata.sql
ALTER TABLE tokens
ADD COLUMN properties text null,
ADD COLUMN levels text null,
Add COLUMN stats text null;

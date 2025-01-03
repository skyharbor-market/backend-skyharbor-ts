-- apply migration
-- psql -U postgres -h 127.0.0.1 -d skyharbor < migrate/01-add_royalties_table.sql
CREATE TABLE IF NOT EXISTS royalties (
    token_id text not null,
    percentage integer not null default 0, -- 3 digit value, 100 = 10%, 10 = 1%, 1 = .1%
    addr text not null,
    ergotree text not null,
    primary key (token_id, ergotree)
);

-- add foreign key
ALTER TABLE ONLY public.royalties ADD CONSTRAINT royalties_token_id_fkey FOREIGN KEY (token_id) REFERENCES public.tokens (token_id);

-- populate preexisting V1 royalty data from tokens table
INSERT INTO
    public.royalties (token_id, percentage, addr, ergotree)
SELECT
    token_id,
    royalty_int,
    royalty_address,
    royalty_ergotree
FROM
    public.tokens
WHERE
    royalty_ergotree not like '[[%'
    and royalty_ergotree != 'NULL'
    and royalty_ergotree != '[]' ON CONFLICT ON CONSTRAINT royalties_pkey DO NOTHING;

-- preexisting V2 royalty data will be migrated manually


-- apply migration
-- psql -U postgres -h 127.0.0.1 --variable=apikeys_pass=<password> < migrate/00-apikeys.sql

CREATE DATABASE apikeys;

GRANT CONNECT ON DATABASE apikeys TO postgres;
CREATE USER apikeys with encrypted password :'apikeys_pass';
GRANT CONNECT ON DATABASE apikeys TO apikeys;
GRANT ALL privileges on DATABASE apikeys to apikeys;
ALTER USER apikeys WITH SUPERUSER;

-- create api_users table

CREATE TABLE IF NOT EXISTS api_users (
  id                     integer unique not null,
  name                   text primary key unique not null,
  wallet_addr            text unique null,
  stripe_customer_id     text unique null,
  stripe_subscription_id text unique null
);

CREATE SEQUENCE IF NOT EXISTS public.api_users_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.api_users_id_seq OWNER TO apikeys;

ALTER SEQUENCE public.api_users_id_seq OWNED BY public.api_users.id;

ALTER TABLE ONLY public.api_users ALTER COLUMN id SET DEFAULT nextval('public.api_users_id_seq'::regclass);

-- create key_limits table

CREATE TABLE IF NOT EXISTS key_limits (
  key    character varying(255) primary key unique not null,
  points integer default 0 not null,
  expire bigint null
);

-- create key_status table

CREATE TABLE IF NOT EXISTS key_status (
  id     integer unique not null,
  status text primary key not null
);

CREATE SEQUENCE IF NOT EXISTS public.key_status_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.key_status_id_seq OWNER TO apikeys;

ALTER SEQUENCE public.key_status_id_seq OWNED BY public.key_status.id;

ALTER TABLE ONLY public.key_status ALTER COLUMN id SET DEFAULT nextval('public.key_status_id_seq'::regclass);

-- create plan_tiers table

CREATE TABLE IF NOT EXISTS plan_tiers (
  id                   integer unique not null,
  name                 text primary key not null,
  stripe_price_id      text,
  stripe_price_id_test text
);

CREATE SEQUENCE IF NOT EXISTS public.plan_tiers_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.plan_tiers_id_seq OWNER TO apikeys;

ALTER SEQUENCE public.plan_tiers_id_seq OWNED BY public.plan_tiers.id;

ALTER TABLE ONLY public.plan_tiers ALTER COLUMN id SET DEFAULT nextval('public.plan_tiers_id_seq'::regclass);

-- create keys table

CREATE TABLE IF NOT EXISTS keys (
  id             integer primary key not null,
  hash           text unique not null,
  create_time    timestamp with time zone not null,
  expire_time    timestamp with time zone not null,
  last_used_time timestamp with time zone,
  prefix         text unique not null,
  "user"         text unique not null,
  status         text not null,
  plan_tier      text default 'free'::text not null
);

CREATE SEQUENCE IF NOT EXISTS public.keys_id_seq
  AS integer
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER SEQUENCE public.keys_id_seq OWNER TO apikeys;

ALTER SEQUENCE public.keys_id_seq OWNED BY public.keys.id;

ALTER TABLE ONLY public.keys ALTER COLUMN id SET DEFAULT nextval('public.keys_id_seq'::regclass);

ALTER TABLE ONLY public.keys ADD CONSTRAINT keys_plan_tier_fkey FOREIGN KEY (plan_tier) REFERENCES public.plan_tiers(name);
ALTER TABLE ONLY public.keys ADD CONSTRAINT keys_status_fkey FOREIGN KEY (status) REFERENCES public.key_status(status);
ALTER TABLE ONLY public.keys ADD CONSTRAINT keys_user_fkey FOREIGN KEY ("user") REFERENCES public.api_users(name);
  
-- populate keys status'

INSERT INTO key_status (status) VALUES ('active') ON CONFLICT ON CONSTRAINT key_status_pkey DO NOTHING;
INSERT INTO key_status (status) VALUES ('inactive') ON CONFLICT ON CONSTRAINT key_status_pkey DO NOTHING;;

-- populate plan tiers

INSERT INTO plan_tiers (name) VALUES ('free') ON CONFLICT ON CONSTRAINT plan_tiers_pkey DO NOTHING;
INSERT INTO plan_tiers (name, stripe_price_id_test) VALUES ('small', 'price_1NxrwRApRbPzcPEhAj832H8j') ON CONFLICT ON CONSTRAINT plan_tiers_pkey DO NOTHING;
INSERT INTO plan_tiers (name, stripe_price_id_test) VALUES ('medium', 'price_1NxrwZApRbPzcPEhyyHLPx74') ON CONFLICT ON CONSTRAINT plan_tiers_pkey DO NOTHING;
INSERT INTO plan_tiers (name) VALUES ('large') ON CONFLICT ON CONSTRAINT plan_tiers_pkey DO NOTHING;
INSERT INTO plan_tiers (name) VALUES ('enterprise') ON CONFLICT ON CONSTRAINT plan_tiers_pkey DO NOTHING;

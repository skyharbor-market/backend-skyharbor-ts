# sales scanner

The typescript written backend of skyharbor now includes the sales scanner feature. It runs in a separate nodejs thread. Some other notable new features are: exporting of logs to Grafana Cloud and scanning and parsing of audio NFTs.

## Example `.env` config file

An `.env` file should be placed at the root of the repo, this will contain all the required backend, sales scanner, and API configuration key=value pairs.

example file:

```bash
PORT=8080

HTTP_503_WAIT_TIME_MS=180000

# prod
DB_HOST_ADDR=104.248.54.140

EXPLORER_BASE_PATH=https://api.ergoplatform.com/api/v1
NODE_BASE_URL=http://127.0.0.1:9053

NODE_API_KEY=xxxx
NODE_WALLET_PASS=xxxx

SCANNER_DB_URL=jdbc:postgresql://localhost:5432/skyharbor
SCANNER_DB_USER=postgres
SCANNER_DB_PASS=xxxx
SCANNER_UNVERIFIED_COLL_IMAGE_URL=https://skyharbor-storage.fra1.cdn.digitaloceanspaces.com/collection-images/unverified/unverified-card.png.webp

SCANNER_BLOCK_POLL_RATE_MS=20000
SCANNER_POST_NEW_BLOCK_WAIT_TIME_MS=15000
SCANNER_INIT_BLOCK_SCAN_PERIOD=100
SCANNER_NANO_ERG_TX_FEE=1000000
SCANNER_API_REATTEMPTS=30
SCANNER_REATTEMPTS_DELAY_MS=10000
SCANNER_DECIMAL_PAY_THRESHOLD=10

SCANNER_MAINT_PERCENTAGE=20
SCANNER_MAINT_ADDRESS=9gw9QkUdzuUVgVmgX7dZvLmZpyjiKtDK2zhSrpYLPSRd5zAmVGK

LOKI_ENABLED=true
LOKI_ENDPOINT=https://logs-prod-006.grafana.net
LOKI_USERNAME=user
LOKI_PASSWORD=password
```

## New DB Migrations

### New `royalties` table

This table will include a many-to-one relationship between the [royalty addresses & percentages] to a NFT's Id. This will allow many different mechanisms i.e. API or UI retrieval of royalty data for a user to consume.

To perform the DB schema migration, log into the prod server running the DB and run the command,

```bash
psql -U postgres -h 127.0.0.1 -d skyharbor < migrate/01-add_royalties_table.sql
```

## Important files & functions

### Team Pay Split

This is located in the file `src/consts/salesScanner.ts` it contains an array of objects which contain the different team members wallet address and split percentage.

### Team Pay logic

The file which contains the logic which pays the team is located in, `src/functions/payteam.ts`.

### NFT Identify and Royalty Parsing

One of the most important functions in the sales scanner is located in the file, `src/classes/token.ts`, and is called, `getInfoOnSelf(logger: any)`. This function essentially checks to see what type of NFT the token is (image, audio, video, utility, etc), then it proceeds to extract the royalty ergotree and percentages data.

# enftx_backend

## API spec
<br>
base path: <br>
https://skyharbor-server.net <br>
<br>
routes: <br>
GET /api/collections/schema <br>
GET /api/collections <br>
GET /api/sales/schema <br>
<br>
GET /api/sales (?query params below)<br>

| parameter  | use                                                                                   | example val                                      |
|------------|---------------------------------------------------------------------------------------|--------------------------------------------------|
| collection | Select just indiv. collections, uses sys_name.  Omit to select All.                   | ergnomes, ergosaurs, spacefarmers                |
| status     | status of sales. Omit to select all.                                                  | active, inactive, complete, cancelled            |
| orderCol   | What order sales should be returned in.  Can use cols on both sales and tokens tables | list_time (order by most recent) status nft_name |
| order      | asc / desc ordered for the columns provided                                           | asc, desc                                        |
| limit      | limits rows returned by int provided                                                  | 69, 420                                          |

### Metrics

GET /api/metrics/topVolumes 

Returns collections by volume, total weekly volume is in nanoergs.

| parameter  | use                                                                                   | example val                                      |
|------------|---------------------------------------------------------------------------------------|--------------------------------------------------|
| limit      | limits rows returned by int provided                                                  | 69, 420                                          |

## Install -
clone repo

npm install 

## Run - 
npm run start

will be running on localhost 

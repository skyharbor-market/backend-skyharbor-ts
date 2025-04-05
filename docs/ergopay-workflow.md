# ergopay E2E Workflow

1. User clicks connect wallet from frontend UI

2. Frontend checks user's localstorage for a uuid variable, otherwise it will generate a new one and save it to a users localstorage.

3. Frontend generates and presents a QR code which will reference this URL, `ergopay://<skyharbor-backend.io>/api/ergopay/setAddr/<uuid>/#P2PK_ADDRESS#`

4. Backend receives the request and stores the default wallet address and uuid via this postgres query:
```sql
  insert into active_sessions
  values (default,$$${query.uuid}$$,current_timestamp,$$${body.wallet}$$)
  on conflict
  on constraint unique_uuid
  do update
  set last_connect_time = current_timestamp,
  wallet_address = $$${body.wallet}$$;
```

5. Using GraphQL subscriptions, we obtain the users wallet address as soon as it has been written to the active_sessions table and update the UI wallet button to show they are connected via ErgoPay

6. User then uses the website to buy/sell NFT(s), etc.

7. Frontend builds Tx and saves the `TxId`, `uuid`, and `unsignedReducedBase64` blob in the DB via this call,
  ```bash
  POST -d '{"txData": "unsignedTxb64", "uuid": "xxxxx-xxxxx-xxxxxx", "txId": "abcdef123"}' https://<skyharbor-backend.io>/api/ergopay/saveTx
  ```

8. If the previous call is successful, then we generate a QR code that redirects to the following URL, `ergopay://<skyharbor-backend.io>/api/ergopay/getTx/:txId/:walletAddress`

9. User should receive the unsigned tx to their ergopay app for them to sign and finalize the Tx

10. Imbedded in the ergopay response is a replyTo field which is basically a webhook to the API,
  `POST -d '{"txId": "abcdef123"}' https://<skyharbor-backend.io>/api/ergopay/signed`
which will notify the skyharbor backend when the user has actually signed the tx on their mobile device. When this call is made we flip a boolean flag in the pay_requests table.

11. Using GraphQL subscriptions, the frontend will query for the *signed* flag in the previous step which will give us the final confirmation that a user has completed the tx,
```sql
select tx_id from pay_requests where signed = true;
```

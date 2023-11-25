# Skyharbor API Keys Generation

## DB Migrations

DB Migrations for the new apikeys DB can be done by executing the `/migrate/00-apikeys.sql` script using the command,

```
psql -U postgres -h 127.0.0.1 --variable=apikeys_pass=<password> < migrate/00-apikeys.sql
```

## Backend APIs

### `POST /api/stripe/create-checkout-session`

```
{
 <stripe_price_id> 
}
```
Skyharbor subscriptions need to have a price ID, which is generated via Stripes CLI or UI Portal, [documentation](https://github.com/stripe-samples/checkout-single-subscription#how-to-run-locally)

more stripe checkout sessions [docs](https://stripe.com/docs/api/checkout/sessions)

### `POST /api/stripe/customer-portal`

This call will take the currently logged in user and make a DB call to see if he/she has a stripe customer id, if so then the backend will redirect the front end to stripes prebuilt UI pages, where the user can then self-manage their subscription(s).

```
  const custId = await getStripeCustomer("test-user")
  ...
  const returnUrl = process.env.DOMAIN // i.e. https://developer.skyharbor.io/

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: custId,
    return_url: returnUrl,
  })

  res.redirect(303, portalSession.url)
```

### `POST /api/stripe/webhook`

The purpose of this endpoint is to get realtime updates from the Stripe servers so we can manage if/when a user creates/updates/removes their subscription(s).

This endpoint requires a `stripe-signature` HTTP header and the raw body so we can verify that the message truly came from Stripe servers. Once that's confirmed then we determine the event type and handle the event accordingly.

### `POST /api/keys/generate`

This api allows a user to generate an API key based on their current tier plan, it defaults to free if a user doesn't currently have an active stripe customer id

When the request is made it should use the currently signed in user and make a DB call to see if an existing key already exists for the user. This is so we can retain key limits(tokens) that were previously used.

```
  const oldKey = await getApiKeyByUser(user)
  let oldLimits: KeyLimit[] | undefined = undefined
  if (typeof oldKey !== "undefined") {
    oldLimits = await getTokenPlanLimits(oldKey.hash)
  }
```

We then generate a new prefix (salt) and API key and then hash that API key so we only store the hashed value in our DB

```
  // generate an api prefix (salt) so we can reference it in the DB
  let pfix: ApiKeyResults = ""
  let newPrefix: number | boolean = false
  while (!newPrefix) {
    pfix = generateApiKey({ method: 'string', length: 8, pool: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" })
    newPrefix = await checkKeyPrefix(pfix.toString())
    if (typeof newPrefix === 'number') {
      return res.status(newPrefix).send({ "trace_id": uuid, "error": "generate api key called failed - couldn't generate prefix" })
    }
  }

  // generate api key and assign/update it to users account
  const key = generateApiKey({ method: 'string', prefix: pfix.toString(), length: 32 })
  const b2params = { salt: pfix.toString(), dkLen: 32 }
  const hash = blake2s(key.toString(), b2params)
  const decodedHash = Buffer.from(hash).toString('hex')
```

Lastly, we check if the user has an active subscription in stripe and associate that to the newly generated key, otherwise it is a free tier key and we then return the non hashed API key to user in the response.

`TODO:` do we want to allow API key generation outside of the UI?

## Public Facing APIs [WIP]

These are rate limited public facing APIs that will require users to pass in their API keys using the header

```
curl -H 'api_key: <prefix>.<api_key>' http://localhost:4444/api/v1/sales/test
```

### `/api/v1/sales/*`

### `/api/v1/txs/*`

## Front Components

From Stripes documentation they recommend using `<form>`'s to pass UI data to the backend APIs

```
<section>
  <form action="http://localhost:4444/api/stripe/create-checkout-session" method="POST">
    <input type="hidden" id="basicPrice" value={"price_1NxrwRApRbPzcPEhAj832H8j"} name="priceId" />
    <button>small tier</button>
  </form>
</section>
```

```
<section>
  <form action="http://localhost:4444/api/stripe/customer-portal" method="POST">
    <input type="hidden" id="basicPrice" value={"test-user"} name="user" />
    <button>manage subscription</button>
  </form>
</section>
```

I learned how to integrate with stripe using this [demo project](https://github.com/stripe-samples/checkout-single-subscription)
import express, { Request, Response } from "express"
import {
  getStripeCustomer,
  updateApiKeyWithUser,
  updateApiKeyWithSubscription,
  updateApiUserWithCustomerAndSub,
  addSubscriptionTask,
  removeSubscriptionTask,
  clearSubsciptionApiKey,
  clearCustomerApiUser
} from "./utils/db"
import cors from "cors"
import * as dotenv from "dotenv"
import path from "path"
import Stripe from "stripe"
import logger from "../logger"

const envFilePath = path.resolve(process.cwd(), './.env')
dotenv.config({ path: envFilePath })
const router = express.Router()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-08-16',
  typescript: true,
})

const origins = ['https://skyharbor.io', 'https://www.skyharbor.io', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://testapi.skyharbor.io', 'https://api.skyharbor.io', 'https://skyharbor-git-development-enftexchange.vercel.app']
const options: cors.CorsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'stripe-signature',
    'Content-Type',
    'Accept',
  ],
  methods: 'GET,OPTIONS,POST',
  origin: origins,
  preflightContinue: false,
}

router.options('*', cors(options), async (req: Request, res: Response) => {
  res.status(200)
})

router.post('/create-checkout-session', cors(options), async (req: Request, res: Response) => {
  const domainURL = process.env.DOMAIN
  const { priceId } = req.body

  // get stripe_customer_id using logged in user (if one exists)
  const custId = await getStripeCustomer("test-user")

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: custId,
      metadata: {
        price_id: priceId,
      },
      client_reference_id: "test-user", // TODO: set this currently logged in user
      success_url: `${domainURL}/`,
      cancel_url: `${domainURL}/`,
      // automatic_tax: { enabled: true }
    })

    return res.redirect(303, session.url ?? "")
  } catch (e) {
    logger.error({
      message: "failed to create stripe checkout session",
      status_code: 400,
      error: e.message
    })
    res.status(400);
    return res.send({
      error: {
        message: e.message,
      }
    })
  }
})

// only redirect user if they have a stripe_customer_id
router.post('/customer-portal', cors(options), async (req: Request, res: Response) => {
  // TODO: get stripe_customer_id using logged in user
  const custId = await getStripeCustomer("test-user")

  if (typeof custId === "undefined") {
    return res.status(500).send({ error: "stripe_customer_id not found" })
  }

  // This is the url to which the customer will be redirected when they are done
  // managing their billing with the portal.
  const returnUrl = process.env.DOMAIN

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: custId,
    return_url: returnUrl,
  })

  res.redirect(303, portalSession.url)
})

router.post("/webhook", async (req: Request, res: Response) => {
  let data!: Stripe.Event.Data
  let eventType: string = ""
  // Check if webhook signing is configured.
  if (process.env.STRIPE_WEBHOOK_SECRET) {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event: Stripe.Event
    const signature = req.headers["stripe-signature"]
    const rawBody = req.rawBody

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature!,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      logger.error({
        message: "Webhook signature verification failed",
        status_code: 400,
        error: err.message
      })
      return res.sendStatus(400)
    }
    // Extract the object from the event.
    data = event.data
    eventType = event.type
  } else {
    logger.error("STRIPE_WEBHOOK_SECRET is not set, we need this for stripe payments")
  }

  res.sendStatus(200)

  if (eventType === "checkout.session.completed") {
    const settled: Stripe.Checkout.Session = data.object as Stripe.Checkout.Session
    // update db with stripe_subscription_id and stripe_customer_id
    updateApiKeyWithUser(settled.client_reference_id!, settled.metadata!.price_id as string)
    updateApiUserWithCustomerAndSub(settled.client_reference_id!, settled.customer as string, settled.subscription as string)
  }

  if (eventType === "customer.subscription.updated") {
    const subscription: Stripe.Subscription = data.object as Stripe.Subscription
    if (subscription.cancel_at_period_end) {
      // schedule pg task to disable api key at the end of that billing cycle
      addSubscriptionTask(subscription.id, "deactivate", subscription.cancel_at as number)
    }

    // subscription has been renewed
    if (!subscription.cancel_at_period_end && typeof data.previous_attributes !== "undefined") {
      const prevAttr: Stripe.Subscription = data.previous_attributes as Stripe.Subscription
      const currPlan: Stripe.Plan = subscription.items.data[0].plan as Stripe.Plan
      console.log("currPlan", currPlan)
      if (prevAttr.cancel_at_period_end) {
        // remove scheduled pg task to disable api key at the end of that billing cycle
        removeSubscriptionTask(subscription.id)
      } else if (currPlan.id !== prevAttr.items.data[0].plan.id) {
        // subscription was upgraded or downgraded.
        // on downgrades we want to apply them at the end of billing cycle
        if (prevAttr.items.data[0].plan.amount! > currPlan.amount!) {
          addSubscriptionTask(subscription.id, "downgrade", subscription.current_period_end, currPlan.id)
        } else {
          // remove any scheduled pg task that would've downgraded a users plan
          removeSubscriptionTask(subscription.id)
          updateApiKeyWithSubscription(subscription.id, currPlan.id)
        }
      }
    }
  }

  if (eventType === "customer.subscription.deleted") {
    const subscription: Stripe.Subscription = data.object as Stripe.Subscription
    // NULL stripe_subscription_id and stripe_customer_id columns
    clearSubsciptionApiKey(subscription.id as string)
    clearCustomerApiUser(subscription.customer as string)
  }

})

export default router

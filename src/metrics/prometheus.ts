import * as promClient from "prom-client"

promClient.collectDefaultMetrics()

export const metrics = {
  newTokenSuccessCounter: new promClient.Counter({
    name: 'sales_scanner_process_new_tokens_success_total',
    help: 'Total number of successfully processed new tokens',
    labelNames: ["collection", "nftType"],
  }),
  newTokenFailedCounter: new promClient.Counter({
    name: 'sales_scanner_process_new_tokens_failed_total',
    help: 'Total number of failed processed new tokens',
    labelNames: ["collection", "nftType"],
  })
}

promClient.register.registerMetric(metrics.newTokenSuccessCounter)
promClient.register.registerMetric(metrics.newTokenFailedCounter)

export default promClient

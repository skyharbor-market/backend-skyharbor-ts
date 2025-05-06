# Monitoring

## Prometheus Metrics

I've started to incorportate prometheus style metrics into the app. These metrics are exposed via the new `/metrics` endpoint. I think the best way to push these metrics is to run a local prometheus instance to scrape the app and then do a `remote_write` to the grafana cloud instance.

### `prom-client` metrics

The prometheus metrics are configured in the file `src/metrics/prometheus.ts` and exported as an object named, `metrics`. This object is where we initialize our metric types, i.e. Counter, Gauge, Histogram. One can then reference this object to update the metrics via these 2 methods.

#### create metric type

```js
import * as promClient from "prom-client"

export const metrics = {
  ...
  counterExample: new promClient.Counter({
    name: 'sample_counter_metric',
    help: 'Description of sample_counter_metric',
    labelNames: ["label1", "label2"],
  })
}

promClient.register.registerMetric(metrics.counterExample)
```

#### update metric value

```js
import { metrics } from "./metrics/prometheus"

metrics.counterExample.labels("label_value1","label_value2").inc()
```

### Deploying `prometheus`

This is assuming prometheus is running as a docker container and the process would look like:

```bash
mkdir ~/prometheus
cd prometheus
vi prometheus.yml
```

```yaml
global:
  scrape_interval: 15s
  scrape_timeout: 10s
  evaluation_interval: 15s

scrape_configs:
  - job_name: sales-scanner
    honor_timestamps: true
    scrape_interval: 30s
    scrape_timeout: 10s
    metrics_path: /metrics
    scheme: http
    static_configs:
      - targets:
          - host.docker.internal:8080

remote_write:
  - url: https://prometheus-prod-13-prod-us-east-0.grafana.net/api/prom/push
    basic_auth:
      username: 1936020
      password: <Your Grafana.com API Token>
```

```bash
vi docker-compose.yml
```

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.0.1
    container_name: prometheus
    command:
      - "--config.file=/etc/prometheus/prometheus.yml"
      - "--web.enable-lifecycle"
      - "--storage.tsdb.retention.size=32MB"
    ports:
      - 9090:9090
    restart: unless-stopped
    volumes:
      - ./:/etc/prometheus
      - prom_data:/prometheus

volumes:
  prom_data:
```

start the docker service

```bash
docker compose up -d
```

## Grafana Cloud - Alertmanager

Coming soon

## Grafana Cloud - Discord Integration

Coming soon

## OpenTelemetry Metrics

Coming soon

## Grafana Cloud - Tempo

Coming soon

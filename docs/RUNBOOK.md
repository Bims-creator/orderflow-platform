# Runbook

Operational response guide for the four alerts defined in
`k8s/base/prometheus-rules.yaml`. Alertmanager is reachable via:

```bash
kubectl -n monitoring port-forward svc/monitoring-kube-prometheus-alertmanager 9093
```

---

## OrderFlowServiceDown (critical)

**Fires when:** Prometheus hasn't scraped `api-service` or `worker-service`
for 2 minutes.

1. Confirm scope: is it one pod or all replicas of a service?
   ```bash
   kubectl -n orderflow get pods -l app.kubernetes.io/part-of=orderflow
   ```
2. If pods are crash-looping, check logs and recent events:
   ```bash
   kubectl -n orderflow logs deploy/api-service --tail=100
   kubectl -n orderflow describe pod <pod-name>
   ```
3. If pods are healthy but not scraped, check the ServiceMonitor is matching:
   ```bash
   kubectl -n orderflow get servicemonitor api-service -o yaml
   ```
4. Common root causes: bad image (check ArgoCD sync status/recent deploy),
   Redis unreachable (readiness probe fails → pod never becomes Ready),
   resource limits too low causing OOMKills.
5. If the last ArgoCD sync introduced this, roll back: ArgoCD UI → Application
   → History and rollback, or revert the commit that bumped the image tag.

## OrderFlowHighQueueBacklog (warning)

**Fires when:** `worker_service_queue_depth` stays above 50 for 5 minutes —
orders are arriving faster than they're being processed.

1. Check current depth and processing rate on the Grafana dashboard
   ("Queue depth" and "Orders processed / sec" panels).
2. Check worker-service isn't down or throttled:
   ```bash
   kubectl -n orderflow get pods -l app.kubernetes.io/name=worker-service
   kubectl -n orderflow top pods -l app.kubernetes.io/name=worker-service
   ```
3. If workers are healthy but under-provisioned, the HPA should scale them
   automatically (up to `maxReplicas: 8`); confirm it's doing so:
   ```bash
   kubectl -n orderflow get hpa worker-service
   ```
4. If HPA is already maxed out, that's a capacity signal — raise
   `maxReplicas` in `k8s/base/worker-service.yaml` (via a PR, not `kubectl
   edit`, so ArgoCD stays the source of truth).

## OrderFlowHighErrorRate (warning)

**Fires when:** More than 5% of `api-service` requests return 5xx over 5
minutes.

1. Check which route is failing:
   ```bash
   kubectl -n orderflow logs deploy/api-service --tail=200 | grep -i error
   ```
2. Check Redis connectivity — most 5xx paths in `api-service` originate from
   Redis calls failing (`/readyz` will report `not ready` if so).
3. Check whether this correlates with a recent deploy (ArgoCD → Application →
   History). If so, roll back first, investigate after.

## OrderFlowSlowProcessing (warning)

**Fires when:** p95 order-processing time exceeds 4s for 5 minutes.

1. Check `MIN_PROCESSING_MS` / `MAX_PROCESSING_MS` env vars on
   worker-service — these simulate work in this demo app and directly
   control this metric.
2. In a real service, this is where you'd check downstream dependency
   latency (payment gateway, inventory service, etc.) and worker CPU
   saturation (`kubectl top pods`).
3. If worker pods are CPU-throttled, check `resources.limits.cpu` in
   `k8s/base/worker-service.yaml` against actual usage.

---

## General diagnostic commands

```bash
export KUBECONFIG=infra/terraform/.kubeconfig

# ArgoCD sync/health status
kubectl -n argocd get application orderflow-production -o wide

# App pods, quick health
kubectl -n orderflow get pods -o wide
kubectl -n orderflow get events --sort-by=.lastTimestamp | tail -20

# Prometheus targets (confirm scraping is healthy)
kubectl -n monitoring port-forward svc/monitoring-kube-prometheus-prometheus 9090
# then open http://localhost:9090/targets
```

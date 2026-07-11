# Live demo script

A ~10 minute walkthrough that shows the full platform working, not just the
app.

## 0. Setup (before the audience joins)

```bash
cd infra/terraform
terraform apply       # provisions kind cluster + ArgoCD + kube-prometheus-stack
```

Takes several minutes on first run (pulling ArgoCD + Prometheus/Grafana
images). Confirm everything is healthy:

```bash
export KUBECONFIG=$(pwd)/.kubeconfig
kubectl get nodes
kubectl -n argocd get application orderflow-production
kubectl -n orderflow get pods
```

## 1. Show the GitOps sync (2 min)

```bash
kubectl -n argocd port-forward svc/argocd-server 8080:80
```

Open http://localhost:8080, log in as `admin` (password from
`kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d`).

Point out: the `orderflow-production` Application, synced straight from the
`k8s/overlays/production` path in the git repo, with auto-sync + self-heal
on. Nobody ran `kubectl apply` — ArgoCD did.

## 2. Drive traffic through the app (2 min)

```bash
curl -X POST http://localhost:30080/orders \
  -H "Content-Type: application/json" \
  -d '{"item":"widget","quantity":3}'

curl http://localhost:30080/orders
```

Run a handful of these (or a quick shell loop) to generate a steady stream.

## 3. Show it live in Grafana (2 min)

```bash
# Grafana is at http://localhost:30030 (admin / value of grafana_admin_password)
```

Open the **OrderFlow** dashboard: orders created/sec, orders processed/sec,
queue depth, and p95 latencies updating in real time as the curl loop runs.

## 4. Trigger an alert on purpose (2 min)

Scale worker-service to zero to make the queue back up, then watch
`OrderFlowHighQueueBacklog` go from healthy to pending to firing:

```bash
kubectl -n orderflow scale deploy/worker-service --replicas=0
# generate ~60 orders quickly, then:
kubectl -n monitoring port-forward svc/monitoring-kube-prometheus-alertmanager 9093
# open http://localhost:9093 and watch the alert appear
```

Scale worker-service back up (or just wait — ArgoCD's self-heal will restore
the replica count from git within a few minutes, which is itself worth
pointing out):

```bash
kubectl -n orderflow scale deploy/worker-service --replicas=2
```

## 5. Show the CI/CD loop end-to-end (2 min)

Make a trivial change (e.g. a log message in `apps/api-service/src/index.js`),
push to `main`, and narrate the GitHub Actions run:

1. `test` + `lint` (hadolint, kubeconform)
2. `build-scan-push` — Trivy scan gates the pipeline; image pushed to GHCR
3. `update-manifests` — bumps `k8s/overlays/production/kustomization.yaml`
   to the new commit SHA and pushes that back to `main`

Then flip back to the ArgoCD UI: within its poll interval (or hit
**Refresh**/**Sync**), the Application shows `OutOfSync` briefly, then syncs
the new image automatically.

That loop — commit → CI builds & scans → manifest updated → ArgoCD deploys —
is the whole point of the repo.

# OrderFlow

A small order-processing app used as the payload for a real DevOps platform:
Terraform-provisioned Kubernetes, GitOps delivery via ArgoCD, a CI/CD pipeline
that actually builds/scans/promotes images, and full observability with
Prometheus, Grafana, and alerting.

The app itself is intentionally simple — an API that queues orders and a
worker that processes them through Redis. The interesting part is everything
around it. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full
picture and [`docs/DEMO.md`](docs/DEMO.md) for a live walkthrough script.

## Stack

- **App**: Node.js (`apps/api-service`, `apps/worker-service`), Redis, both
  instrumented with Prometheus metrics and liveness/readiness probes.
- **CI/CD**: GitHub Actions — lint (hadolint, kubeconform) → test → build →
  Trivy scan → push to GHCR → bump the production image tag in git.
- **IaC**: Terraform (`infra/terraform`) provisions a local `kind` cluster and
  bootstraps ArgoCD + kube-prometheus-stack.
- **GitOps**: ArgoCD watches `k8s/overlays/production` and auto-syncs —
  Terraform never deploys the app directly.
- **Manifests**: Kustomize, `k8s/base` + `overlays/staging` + `overlays/production`.
- **Observability**: ServiceMonitors, a provisioned Grafana dashboard, and a
  PrometheusRule with four real alerts (see [`docs/RUNBOOK.md`](docs/RUNBOOK.md)).

## Quickstart

Requires Docker Desktop, `kind`, `kubectl`, `helm`, and `terraform`.

```bash
cd infra/terraform
terraform init
terraform apply
```

This creates a 3-node `kind` cluster, installs ArgoCD and kube-prometheus-stack,
and points ArgoCD at this repo's `k8s/overlays/production`. First run takes a
few minutes (image pulls). Once it settles:

```bash
export KUBECONFIG=$(pwd)/.kubeconfig
kubectl -n orderflow get pods
```

| What | URL | Credentials |
|---|---|---|
| App | http://localhost:30080 | — |
| Grafana | http://localhost:30030 | `admin` / value of `grafana_admin_password` var |
| Prometheus | http://localhost:30090 | — |
| ArgoCD | `kubectl -n argocd port-forward svc/argocd-server 8080:80`, then http://localhost:8080 | `admin` / `kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' \| base64 -d` |

Try it:

```bash
curl -X POST http://localhost:30080/orders \
  -H "Content-Type: application/json" \
  -d '{"item":"widget","quantity":3}'

curl http://localhost:30080/orders
```

## Tear down

```bash
cd infra/terraform
terraform destroy
```

## Repo layout

```
apps/                  api-service + worker-service source, tests, Dockerfiles
infra/terraform/       kind cluster + ArgoCD + kube-prometheus-stack bootstrap
k8s/base/              Kustomize base manifests (Deployments, HPAs, ServiceMonitors,
                       PrometheusRule, Grafana dashboard ConfigMap)
k8s/overlays/          staging + production environment overlays
.github/workflows/     CI/CD pipeline
docs/                  architecture, runbook, demo script
```

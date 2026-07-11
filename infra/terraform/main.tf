# Provisions a local kind cluster and bootstraps the two platform components
# every environment in this repo depends on: ArgoCD (GitOps delivery) and
# kube-prometheus-stack (metrics, dashboards, alerting).
#
# Deliberate separation of concerns:
#   - Terraform owns cluster lifecycle + cluster-wide platform tooling.
#   - ArgoCD (see argocd-application.tf) owns the application itself, synced
#     straight from this git repo's k8s/overlays/* — Terraform never applies
#     app manifests directly.

resource "null_resource" "kind_cluster" {
  triggers = {
    config_hash  = filesha256("${path.module}/kind-config.yaml")
    cluster_name = var.cluster_name
  }

  provisioner "local-exec" {
    working_dir = path.module
    interpreter = ["PowerShell", "-Command"]
    command     = <<-EOT
      $ErrorActionPreference = "Stop"
      $existing = kind get clusters
      if ($existing -notcontains "${var.cluster_name}") {
        kind create cluster --name ${var.cluster_name} --config kind-config.yaml --kubeconfig .kubeconfig
      } else {
        kind get kubeconfig --name ${var.cluster_name} | Out-File -Encoding ascii .kubeconfig
      }
    EOT
  }

  provisioner "local-exec" {
    when        = destroy
    interpreter = ["PowerShell", "-Command"]
    command     = "kind delete cluster --name ${self.triggers.cluster_name}"
  }
}

resource "null_resource" "wait_for_nodes" {
  depends_on = [null_resource.kind_cluster]

  triggers = {
    cluster = null_resource.kind_cluster.id
  }

  provisioner "local-exec" {
    working_dir = path.module
    interpreter = ["PowerShell", "-Command"]
    command     = "kubectl --kubeconfig .kubeconfig wait --for=condition=Ready nodes --all --timeout=180s"
  }
}

resource "helm_release" "argocd" {
  name             = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  namespace        = "argocd"
  create_namespace = true
  timeout          = 600

  values = [
    yamlencode({
      configs = {
        params = {
          "server.insecure" = true
        }
      }
    })
  ]

  depends_on = [null_resource.wait_for_nodes]
}

resource "helm_release" "kube_prometheus_stack" {
  name             = "monitoring"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  namespace        = "monitoring"
  create_namespace = true
  timeout          = 900

  values = [
    yamlencode({
      grafana = {
        adminPassword = var.grafana_admin_password
        service = {
          type     = "NodePort"
          nodePort = 30030
        }
        sidecar = {
          dashboards = {
            enabled         = true
            searchNamespace = "ALL"
          }
        }
      }
      prometheus = {
        service = {
          type     = "NodePort"
          nodePort = 30090
        }
        prometheusSpec = {
          serviceMonitorSelectorNilUsesHelmValues = false
          ruleSelectorNilUsesHelmValues           = false
          podMonitorSelectorNilUsesHelmValues     = false
          retention                               = "6h"
          resources = {
            requests = {
              cpu    = "100m"
              memory = "256Mi"
            }
          }
        }
      }
    })
  ]

  depends_on = [null_resource.wait_for_nodes]
}

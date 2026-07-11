# The GitOps handoff: once ArgoCD is running (see main.tf), this Application
# tells it to continuously reconcile the cluster against
# k8s/overlays/production in this same repo. Terraform applies this pointer
# once; from then on ArgoCD - not Terraform - drives what's actually running.

resource "kubectl_manifest" "orderflow_production" {
  depends_on = [helm_release.argocd]

  yaml_body = yamlencode({
    apiVersion = "argoproj.io/v1alpha1"
    kind       = "Application"
    metadata = {
      name      = "orderflow-production"
      namespace = "argocd"
    }
    spec = {
      project = "default"
      source = {
        repoURL        = var.git_repo_url
        targetRevision = var.git_target_revision
        path           = "k8s/overlays/production"
      }
      destination = {
        server    = "https://kubernetes.default.svc"
        namespace = "orderflow"
      }
      syncPolicy = {
        automated = {
          prune    = true
          selfHeal = true
        }
        syncOptions = ["CreateNamespace=true"]
      }
    }
  })
}

output "kubeconfig_path" {
  description = "Path to the kubeconfig for the local kind cluster"
  value       = "${path.module}/.kubeconfig"
}

output "next_steps" {
  description = "Commands to access the platform UIs after apply"
  value       = <<-EOT
    export KUBECONFIG=${path.module}/.kubeconfig

    ArgoCD UI:    kubectl -n argocd port-forward svc/argocd-server 8080:80
                  https://localhost:8080  (user: admin, password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)

    Prometheus:   http://localhost:30090
    Grafana:      http://localhost:30030  (user: admin, password: see grafana_admin_password variable)
    App (once ArgoCD has synced): http://localhost:30080
  EOT
}

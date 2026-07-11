variable "cluster_name" {
  description = "Name of the local kind cluster"
  type        = string
  default     = "orderflow"
}

variable "git_repo_url" {
  description = "Git repository URL that ArgoCD syncs the production overlay from"
  type        = string
  default     = "https://github.com/Bims-creator/orderflow-platform.git"
}

variable "git_target_revision" {
  description = "Git branch/tag ArgoCD tracks"
  type        = string
  default     = "main"
}

variable "grafana_admin_password" {
  description = "Admin password for the Grafana instance (demo only - not for production use)"
  type        = string
  default     = "orderflow-demo"
  sensitive   = true
}

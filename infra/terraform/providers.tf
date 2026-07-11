provider "kubernetes" {
  config_path = "${path.module}/.kubeconfig"
}

provider "helm" {
  kubernetes {
    config_path = "${path.module}/.kubeconfig"
  }
}

provider "kubectl" {
  config_path      = "${path.module}/.kubeconfig"
  load_config_file = true
}

# Provider configuration
# hashicorp/google v4.0
# hashicorp/google-beta v4.0
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.0.0"
}

# GKE cluster for GPU workloads
resource "google_container_cluster" "gpu_cluster" {
  provider = google-beta
  name     = var.cluster_name
  location = var.zone
  project  = var.project_id

  # Enable Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Network configuration
  network    = var.network_config.network_name
  subnetwork = var.network_config.subnet_name

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = var.network_config.enable_private_nodes
    enable_private_endpoint = var.network_config.enable_private_endpoint
    master_ipv4_cidr_block = var.network_config.master_ipv4_cidr_block
  }

  # IP allocation policy
  ip_allocation_policy {
    cluster_secondary_range_name  = var.network_config.pod_range_name
    services_secondary_range_name = var.network_config.service_range_name
  }

  # Master authorized networks
  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.network_config.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Network policy
  network_policy {
    enabled  = var.network_config.network_policy_enabled
    provider = var.network_config.network_policy_provider
  }

  # Datapath provider for enhanced networking
  datapath_provider = var.network_config.datapath_provider

  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1

  # Maintenance policy
  maintenance_policy {
    daily_maintenance_window {
      start_time = var.maintenance_config.daily_maintenance_window.start_time
      duration   = var.maintenance_config.daily_maintenance_window.duration
    }

    dynamic "maintenance_exclusion" {
      for_each = var.maintenance_config.maintenance_exclusions
      content {
        exclusion_name = maintenance_exclusion.value.name
        start_time     = maintenance_exclusion.value.start_time
        end_time       = maintenance_exclusion.value.end_time
        exclusion_options {
          scope = maintenance_exclusion.value.scope
        }
      }
    }
  }

  # Security configuration
  security_posture_config {
    mode               = var.security_config.security_posture_config.mode
    vulnerability_mode = var.security_config.security_posture_config.vulnerability_mode
  }

  # Binary authorization
  enable_binary_authorization = var.security_config.enable_binary_authorization

  # Confidential nodes
  confidential_nodes {
    enabled = var.security_config.enable_confidential_nodes
  }

  # Labels
  resource_labels = var.labels
}

# GPU node pool
resource "google_container_node_pool" "gpu_nodes" {
  provider = google-beta
  name     = var.gpu_node_pool_config.name
  location = var.zone
  cluster  = google_container_cluster.gpu_cluster.name
  project  = var.project_id

  initial_node_count = var.gpu_node_pool_config.initial_node_count

  # Autoscaling configuration
  autoscaling {
    min_node_count = var.gpu_node_pool_config.min_node_count
    max_node_count = var.gpu_node_pool_config.max_node_count
  }

  # Node configuration
  node_config {
    machine_type = var.gpu_node_pool_config.machine_type
    disk_size_gb = var.gpu_node_pool_config.disk_size_gb
    disk_type    = var.gpu_node_pool_config.disk_type

    # GPU configuration
    guest_accelerator {
      type  = var.gpu_node_pool_config.accelerator_config.type
      count = var.gpu_node_pool_config.accelerator_config.count
      gpu_driver_version = var.gpu_node_pool_config.accelerator_config.gpu_driver_version
      gpu_partition_size = var.gpu_node_pool_config.accelerator_config.gpu_partition_size
    }

    # Spot/preemptible configuration
    preemptible = var.gpu_node_pool_config.preemptible
    spot        = var.gpu_node_pool_config.spot

    # Service account and OAuth scopes
    service_account = var.gpu_node_pool_config.service_account
    oauth_scopes    = var.gpu_node_pool_config.oauth_scopes

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = var.security_config.shielded_instance_config.enable_secure_boot
      enable_vtpm                = var.security_config.shielded_instance_config.enable_vtpm
      enable_integrity_monitoring = var.security_config.shielded_instance_config.enable_integrity_monitoring
    }

    # Workload identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Labels and tags
    labels = var.labels
    tags   = var.gpu_node_pool_config.tags
  }

  # Management configuration
  management {
    auto_repair  = var.gpu_node_pool_config.auto_repair
    auto_upgrade = var.gpu_node_pool_config.auto_upgrade
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = var.gpu_node_pool_config.max_surge
    max_unavailable = var.gpu_node_pool_config.max_unavailable
  }
}

# Outputs
output "gpu_cluster_id" {
  value       = google_container_cluster.gpu_cluster.id
  description = "The ID of the GPU cluster"
}

output "cluster_monitoring_config" {
  value = {
    monitoring_service = google_container_cluster.gpu_cluster.monitoring_service
    logging_service   = google_container_cluster.gpu_cluster.logging_service
  }
  description = "Monitoring configuration for the cluster"
}

output "cluster_security_config" {
  value = {
    workload_identity_enabled = var.security_config.enable_workload_identity
    binary_authorization     = var.security_config.enable_binary_authorization
    network_policy_enabled   = var.network_config.network_policy_enabled
  }
  description = "Security configuration for the cluster"
}
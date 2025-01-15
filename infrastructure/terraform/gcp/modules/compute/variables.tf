# Provider version constraints
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
}

# Basic GCP project configuration variables
variable "project_id" {
  type        = string
  description = "The GCP project ID where resources will be deployed"
}

variable "region" {
  type        = string
  description = "The GCP region where compute resources will be deployed"
}

variable "zone" {
  type        = string
  description = "The GCP zone within the region for compute resource deployment"
}

variable "cluster_name" {
  type        = string
  description = "Name of the GKE cluster for GPU workloads"
}

# Enhanced GPU node pool configuration
variable "gpu_node_pool_config" {
  type = object({
    name                = string
    machine_type        = string
    min_node_count      = number
    max_node_count      = number
    initial_node_count  = number
    disk_size_gb        = number
    disk_type          = string
    gpu_type           = string
    gpu_count          = number
    preemptible        = bool
    spot               = bool
    auto_repair        = bool
    auto_upgrade       = bool
    max_surge          = number
    max_unavailable    = number
    local_ssd_count    = number
    oauth_scopes       = list(string)
    service_account    = string
    tags               = list(string)
    accelerator_config = object({
      count              = number
      type               = string
      gpu_driver_version = string
      gpu_partition_size = string
    })
    autoscaling_config = object({
      enabled                  = bool
      min_cpu_utilization     = number
      max_cpu_utilization     = number
      min_memory_utilization  = number
      max_memory_utilization  = number
      gpu_utilization_target  = number
      scale_down_delay        = string
      scale_down_factor      = number
      scale_up_factor        = number
    })
  })
  description = "Configuration for GPU node pools including machine type, GPU specs, and autoscaling settings"
}

# Network configuration
variable "network_config" {
  type = object({
    network_name           = string
    subnet_name           = string
    pod_range_name        = string
    pod_ipv4_cidr_block   = string
    service_range_name    = string
    service_ipv4_cidr     = string
    enable_private_nodes  = bool
    enable_private_endpoint = bool
    master_ipv4_cidr_block = string
    master_authorized_networks = list(object({
      cidr_block   = string
      display_name = string
    }))
    network_policy_enabled = bool
    network_policy_provider = string
    datapath_provider     = string
  })
  description = "Network configuration including VPC, subnet, and IP range settings"
}

# Resource labels
variable "labels" {
  type = map(string)
  description = "Labels to be applied to all resources for cost tracking and organization"
  default = {}
}

# Maintenance configuration
variable "maintenance_config" {
  type = object({
    daily_maintenance_window = object({
      start_time = string
      duration   = string
    })
    recurring_window = object({
      start_time = string
      end_time   = string
      recurrence = string
    })
    maintenance_exclusions = list(object({
      name       = string
      start_time = string
      end_time   = string
      scope      = string
    }))
    auto_upgrade_settings = object({
      enabled                  = bool
      surge_upgrade           = bool
      max_surge              = number
      max_unavailable        = number
      node_pool_soaking_duration = string
    })
  })
  description = "Configuration for maintenance windows and upgrade settings"
}

# Security configuration
variable "security_config" {
  type = object({
    enable_workload_identity = bool
    workload_pool           = string
    enable_confidential_nodes = bool
    enable_secure_boot      = bool
    enable_integrity_monitoring = bool
    enable_binary_authorization = bool
    security_posture_config = object({
      mode                  = string
      vulnerability_mode    = string
    })
    network_security_config = object({
      enable_intranode_visibility = bool
      enable_network_policy      = bool
      provider                  = string
      datapath_provider         = string
    })
    shielded_instance_config = object({
      enable_secure_boot          = bool
      enable_vtpm                = bool
      enable_integrity_monitoring = bool
    })
  })
  description = "Security settings including workload identity and network policies"
}
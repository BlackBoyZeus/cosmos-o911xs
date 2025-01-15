# Project and Region Configuration
variable "project_id" {
  type        = string
  description = "GCP project identifier for resource deployment"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "region" {
  type        = string
  description = "GCP region for resource deployment"
  
  validation {
    condition     = can(regex("^[a-z]+-[a-z]+-[0-9]$", var.region))
    error_message = "Region must be a valid GCP region name (e.g., us-central1)."
  }
}

# GPU Cluster Configuration
variable "gpu_cluster_config" {
  type = object({
    machine_type    = string
    min_node_count  = number
    max_node_count  = number
    gpu_type        = string
    gpu_count       = number
    disk_size_gb    = number
    preemptible     = bool
    auto_scaling    = bool
    service_account = string
  })
  
  description = "Configuration object for GPU cluster including machine type, node count, and GPU specifications"
  
  validation {
    condition     = var.gpu_cluster_config.machine_type == "a2-ultragpu-8g"
    error_message = "Machine type must be a2-ultragpu-8g for A100 GPU support."
  }
  
  validation {
    condition     = var.gpu_cluster_config.min_node_count >= 1 && var.gpu_cluster_config.max_node_count <= 100
    error_message = "Node count must be between 1 and 100."
  }
  
  validation {
    condition     = var.gpu_cluster_config.gpu_type == "nvidia-a100-80gb"
    error_message = "GPU type must be nvidia-a100-80gb."
  }
  
  validation {
    condition     = var.gpu_cluster_config.gpu_count >= 1 && var.gpu_cluster_config.gpu_count <= 8
    error_message = "GPU count must be between 1 and 8."
  }
}

# Storage Configuration
variable "storage_config" {
  type = object({
    hot_tier_bucket_name     = string
    cold_tier_bucket_name    = string
    backup_bucket_name       = string
    hot_tier_storage_class   = string
    cold_tier_storage_class  = string
    hot_tier_retention_days  = number
    cold_tier_retention_days = number
    backup_retention_days    = number
    versioning_enabled      = bool
    lifecycle_rules         = list(map(string))
  })
  
  description = "Configuration object for storage resources including bucket names, storage classes, and lifecycle rules"
  
  validation {
    condition     = var.storage_config.hot_tier_retention_days >= 30
    error_message = "Hot tier retention must be at least 30 days."
  }
  
  validation {
    condition     = var.storage_config.cold_tier_retention_days >= 90
    error_message = "Cold tier retention must be at least 90 days."
  }
  
  validation {
    condition     = var.storage_config.backup_retention_days >= 30
    error_message = "Backup retention must be at least 30 days."
  }
}

# Database Configuration
variable "database_config" {
  type = object({
    instance_name       = string
    database_version    = string
    tier               = string
    ha_mode            = string
    backup_enabled     = bool
    backup_schedule_hours = number
    max_connections    = number
    performance_tier   = string
    memory_size_gb     = number
  })
  
  description = "Configuration object for database resources including Datastore and Memorystore settings"
  
  validation {
    condition     = var.database_config.ha_mode == "REGIONAL"
    error_message = "HA mode must be REGIONAL for 99.9% availability."
  }
  
  validation {
    condition     = var.database_config.backup_schedule_hours >= 1 && var.database_config.backup_schedule_hours <= 24
    error_message = "Backup schedule must be between 1 and 24 hours."
  }
  
  validation {
    condition     = var.database_config.max_connections >= 1000
    error_message = "Maximum connections must be at least 1000 for high concurrency."
  }
  
  validation {
    condition     = var.database_config.performance_tier == "ENTERPRISE"
    error_message = "Performance tier must be ENTERPRISE for production workloads."
  }
}

# Resource Labels
variable "labels" {
  type = map(string)
  description = "Resource labels for cost tracking and organization"
  
  validation {
    condition     = length(var.labels) > 0
    error_message = "At least one label must be specified for resource organization."
  }
  
  validation {
    condition     = can([for k, v in var.labels : regex("^[a-z][a-z0-9_-]{0,62}$", k)])
    error_message = "Label keys must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores."
  }
}
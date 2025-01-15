# Azure Provider version ~> 3.0

variable "project_name" {
  type        = string
  description = "Name of the Cosmos World Foundation Model project for resource naming"
  default     = "cosmos-wfm"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "location" {
  type        = string
  description = "Azure region for resource deployment"
  default     = "eastus"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group"
}

variable "gpu_cluster_config" {
  type = object({
    node_count = number
    vm_size    = string
    subnet_id  = string
    network_config = object({
      vnet_name          = string
      vnet_address_space = list(string)
      subnet_prefixes    = list(string)
    })
    scaling_config = object({
      min_count     = number
      max_count     = number
      target_cpu_utilization = number
    })
    node_labels = map(string)
    node_taints = list(string)
  })
  description = "Configuration for GPU cluster including node count, VM size, and networking"

  validation {
    condition     = contains(["Standard_NC24ads_A100_v4", "Standard_ND96asr_v4", "Standard_NC24rs_v3"], var.gpu_cluster_config.vm_size)
    error_message = "VM size must be a GPU-enabled size supporting NVIDIA GPUs"
  }

  validation {
    condition     = var.gpu_cluster_config.node_count >= 1
    error_message = "Node count must be at least 1"
  }
}

variable "storage_config" {
  type = object({
    account_tier             = string
    account_replication_type = string
    containers = list(object({
      name                  = string
      container_access_type = string
    }))
    lifecycle_rules = list(object({
      name    = string
      enabled = bool
      filters = object({
        prefix_match = list(string)
        blob_types   = list(string)
      })
      actions = object({
        base_blob = object({
          tier_to_cool_after_days    = number
          tier_to_archive_after_days = number
          delete_after_days          = number
        })
      })
    }))
  })
  description = "Configuration for storage accounts and containers"

  validation {
    condition     = contains(["Standard", "Premium"], var.storage_config.account_tier)
    error_message = "Account tier must be either Standard or Premium"
  }
}

variable "database_config" {
  type = object({
    throughput          = number
    consistency_level   = string
    geo_locations      = list(object({
      location          = string
      failover_priority = number
    }))
    backup_config = object({
      type                = string
      interval_in_minutes = number
      retention_in_hours  = number
    })
    collections = list(object({
      name               = string
      partition_key_path = string
      throughput        = number
    }))
  })
  description = "Configuration for Cosmos DB instances"

  validation {
    condition     = var.database_config.throughput >= 400 && var.database_config.throughput <= 1000000
    error_message = "Database throughput must be between 400 and 1000000 RU/s"
  }

  validation {
    condition     = contains(["Strong", "BoundedStaleness", "Session", "ConsistentPrefix", "Eventual"], var.database_config.consistency_level)
    error_message = "Invalid consistency level specified"
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for all Azure resources"
  default     = {
    Environment = "dev"
    Project     = "cosmos-wfm"
    ManagedBy   = "terraform"
  }
}
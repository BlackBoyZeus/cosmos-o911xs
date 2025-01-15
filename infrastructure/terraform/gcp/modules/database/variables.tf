# Terraform version constraint
terraform {
  required_version = ">=1.0.0"
}

# Core project configuration
variable "project_id" {
  type        = string
  description = "The GCP project ID where resources will be created"
}

variable "region" {
  type        = string
  description = "The GCP region where database resources will be deployed"
  default     = "us-central1"
}

# Cloud Datastore configuration
variable "datastore_config" {
  type = object({
    namespace = string
    indexes = list(object({
      kind       = string
      properties = list(string)
      direction  = string
    }))
    backup_schedule = object({
      schedule     = string # cron format
      retention_days = number
      time_zone    = string
    })
    scaling = object({
      min_instances = number
      max_instances = number
      target_cpu_utilization = number
    })
  })
  description = "Configuration settings for Cloud Datastore instance"
  default = {
    namespace = "cosmos-wfm"
    indexes = [
      {
        kind       = "video_metadata"
        properties = ["created_at", "status"]
        direction  = "ASCENDING"
      }
    ]
    backup_schedule = {
      schedule        = "0 */6 * * *" # Every 6 hours
      retention_days  = 30
      time_zone      = "UTC"
    }
    scaling = {
      min_instances = 1
      max_instances = 10
      target_cpu_utilization = 0.65
    }
  }
}

# Cloud Memorystore configuration
variable "memorystore_config" {
  type = object({
    tier = string
    memory_size_gb = number
    version = string
    auth_enabled = bool
    maintenance_window = object({
      day = string
      hour = number
    })
    backup_config = object({
      backup_schedule = string # cron format
      retention_days = number
    })
    redis_configs = map(string)
  })
  description = "Configuration settings for Cloud Memorystore instance"
  default = {
    tier           = "STANDARD_HA"
    memory_size_gb = 32
    version        = "REDIS_6_X"
    auth_enabled   = true
    maintenance_window = {
      day  = "SUNDAY"
      hour = 2
    }
    backup_config = {
      backup_schedule = "0 */12 * * *" # Every 12 hours
      retention_days  = 14
    }
    redis_configs = {
      maxmemory-policy = "allkeys-lru"
      notify-keyspace-events = "KEA"
      timeout = "3600"
    }
  }
}

# Resource labeling
variable "labels" {
  type        = map(string)
  description = "Labels to apply to all resources created by this module"
  default     = {
    environment = "production"
    managed_by  = "terraform"
    project     = "cosmos-wfm"
    component   = "database"
  }
}

# Network configuration
variable "network_config" {
  type = object({
    network = string
    subnetwork = string
    ip_range = string
    authorized_networks = list(object({
      name  = string
      cidr  = string
    }))
    private_service_access = bool
  })
  description = "Network configuration for database instances"
  default = {
    network     = "default"
    subnetwork  = "default"
    ip_range    = "10.0.0.0/24"
    authorized_networks = [
      {
        name = "internal"
        cidr = "10.0.0.0/8"
      }
    ]
    private_service_access = true
  }
}
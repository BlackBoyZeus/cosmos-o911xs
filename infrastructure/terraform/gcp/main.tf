# Provider Configuration
# hashicorp/google ~> 4.0
# hashicorp/google-beta ~> 4.0
terraform {
  required_version = ">= 1.0.0"
  
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

  backend "gcs" {
    bucket = "cosmos-terraform-state"
    prefix = "gcp"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Local Variables
locals {
  zones = ["${var.region}-a", "${var.region}-b", "${var.region}-c"]
  
  common_labels = merge(var.labels, {
    environment = terraform.workspace
    managed_by  = "terraform"
    project     = "cosmos-wfm"
  })
}

# GPU Compute Infrastructure
module "compute" {
  source = "./modules/compute"
  
  project_id = var.project_id
  region     = var.region
  zones      = local.zones
  
  cluster_config = {
    name               = "cosmos-gpu-cluster"
    machine_type       = var.gpu_cluster_config.machine_type
    min_node_count     = var.gpu_cluster_config.min_node_count
    max_node_count     = var.gpu_cluster_config.max_node_count
    gpu_type           = var.gpu_cluster_config.gpu_type
    gpu_count          = var.gpu_cluster_config.gpu_count
    disk_size_gb       = var.gpu_cluster_config.disk_size_gb
    preemptible        = var.gpu_cluster_config.preemptible
    auto_scaling       = var.gpu_cluster_config.auto_scaling
    service_account    = var.gpu_cluster_config.service_account
  }

  scheduling_config = {
    on_host_maintenance = "TERMINATE"
    automatic_restart   = false
    preemptible        = var.gpu_cluster_config.preemptible
  }

  labels = local.common_labels
}

# Storage Resources
module "storage" {
  source = "./modules/storage"
  
  project_id = var.project_id
  region     = var.region
  
  storage_config = {
    hot_tier_bucket = {
      name           = var.storage_config.hot_tier_bucket_name
      storage_class  = var.storage_config.hot_tier_storage_class
      retention_days = var.storage_config.hot_tier_retention_days
    }
    cold_tier_bucket = {
      name           = var.storage_config.cold_tier_bucket_name
      storage_class  = var.storage_config.cold_tier_storage_class
      retention_days = var.storage_config.cold_tier_retention_days
    }
    backup_bucket = {
      name           = var.storage_config.backup_bucket_name
      storage_class  = "COLDLINE"
      retention_days = var.storage_config.backup_retention_days
    }
    versioning_enabled = var.storage_config.versioning_enabled
    lifecycle_rules    = var.storage_config.lifecycle_rules
  }

  labels = local.common_labels
}

# Database Resources
module "database" {
  source = "./modules/database"
  
  project_id = var.project_id
  region     = var.region
  zones      = local.zones
  
  database_config = {
    instance_name         = var.database_config.instance_name
    database_version      = var.database_config.database_version
    tier                  = var.database_config.tier
    ha_mode              = var.database_config.ha_mode
    backup_enabled        = var.database_config.backup_enabled
    backup_schedule_hours = var.database_config.backup_schedule_hours
    max_connections      = var.database_config.max_connections
    performance_tier     = var.database_config.performance_tier
    memory_size_gb       = var.database_config.memory_size_gb
  }

  labels = local.common_labels
}

# Outputs
output "gpu_cluster_id" {
  value       = module.compute.gpu_cluster.id
  description = "The ID of the GPU cluster for workload management"
}

output "storage_buckets" {
  value = {
    raw_data        = module.storage.raw_data_bucket.name
    processed_data  = module.storage.processed_data_bucket.name
    model_artifacts = module.storage.model_artifacts_bucket.name
  }
  description = "Storage bucket identifiers for data lifecycle management"
}

output "database_endpoints" {
  value = {
    datastore = module.database.datastore_id
    memorystore = module.database.memorystore_id
    high_availability = module.database.high_availability_config
  }
  description = "Database and cache connection endpoints with HA configuration"
  sensitive   = true
}
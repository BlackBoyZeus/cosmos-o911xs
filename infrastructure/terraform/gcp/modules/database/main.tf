# Provider configuration
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Configure the Google Cloud provider
provider "google" {
  project = var.project_id
  region  = var.region
}

# Create VPC for private service access
resource "google_compute_network" "database_network" {
  count                   = var.network_config.private_service_access ? 1 : 0
  name                    = "cosmos-db-network"
  auto_create_subnetworks = false
}

# Configure private service access
resource "google_compute_global_address" "private_ip_alloc" {
  count         = var.network_config.private_service_access ? 1 : 0
  name          = "cosmos-db-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.database_network[0].id
}

resource "google_service_networking_connection" "private_service_connection" {
  count                   = var.network_config.private_service_access ? 1 : 0
  network                 = google_compute_network.database_network[0].id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc[0].name]
}

# Cloud Datastore configuration
resource "google_datastore_index" "metadata_indexes" {
  for_each = { for idx in var.datastore_config.indexes : idx.kind => idx }

  kind = each.value.kind
  properties {
    name      = each.value.properties[0]
    direction = each.value.direction
  }
  properties {
    name      = each.value.properties[1]
    direction = each.value.direction
  }
}

# Cloud Memorystore (Redis) instance
resource "google_redis_instance" "cache" {
  name           = "cosmos-cache"
  tier           = var.memorystore_config.tier
  memory_size_gb = var.memorystore_config.memory_size_gb
  region         = var.region

  authorized_network = var.network_config.private_service_access ? google_compute_network.database_network[0].id : var.network_config.network
  
  redis_version     = var.memorystore_config.version
  auth_enabled      = var.memorystore_config.auth_enabled

  maintenance_policy {
    weekly_maintenance_window {
      day = var.memorystore_config.maintenance_window.day
      start_time {
        hours = var.memorystore_config.maintenance_window.hour
        minutes = 0
        seconds = 0
        nanos = 0
      }
    }
  }

  redis_configs = var.memorystore_config.redis_configs

  labels = var.labels

  depends_on = [google_service_networking_connection.private_service_connection]
}

# Backup bucket for database exports
resource "google_storage_bucket" "backup_bucket" {
  name          = "cosmos-db-backups-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.datastore_config.backup_schedule.retention_days
    }
    action {
      type = "Delete"
    }
  }

  labels = var.labels
}

# Cloud Scheduler job for Datastore backups
resource "google_cloud_scheduler_job" "datastore_backup" {
  name        = "datastore-backup-job"
  description = "Scheduled backup job for Cloud Datastore"
  schedule    = var.datastore_config.backup_schedule.schedule
  time_zone   = var.datastore_config.backup_schedule.time_zone

  http_target {
    http_method = "POST"
    uri         = "https://datastore.googleapis.com/v1/projects/${var.project_id}:export"
    
    oauth_token {
      service_account_email = google_service_account.backup_service_account.email
    }

    body = base64encode(jsonencode({
      outputUrlPrefix = "gs://${google_storage_bucket.backup_bucket.name}/datastore"
      entityFilter = {
        kinds = [for idx in var.datastore_config.indexes : idx.kind]
        namespaceIds = [var.datastore_config.namespace]
      }
    }))
  }
}

# Service account for backup operations
resource "google_service_account" "backup_service_account" {
  account_id   = "cosmos-backup-sa"
  display_name = "Cosmos Database Backup Service Account"
}

# IAM roles for backup service account
resource "google_project_iam_member" "backup_roles" {
  for_each = toset([
    "roles/datastore.importExportAdmin",
    "roles/storage.objectViewer"
  ])
  
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.backup_service_account.email}"
}

# Outputs
output "datastore_id" {
  value = var.project_id
  description = "Cloud Datastore instance identifier"
}

output "datastore_endpoint" {
  value = "https://datastore.googleapis.com/v1/projects/${var.project_id}"
  description = "Cloud Datastore connection endpoint"
}

output "memorystore_id" {
  value = google_redis_instance.cache.id
  description = "Cloud Memorystore instance identifier"
}

output "memorystore_endpoint" {
  value = google_redis_instance.cache.host
  description = "Cloud Memorystore connection endpoint"
}

output "backup_bucket" {
  value = google_storage_bucket.backup_bucket.name
  description = "GCS bucket for database backups"
}
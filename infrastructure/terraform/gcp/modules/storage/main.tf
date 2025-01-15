# Terraform configuration for GCP Cloud Storage resources
# Provider version: hashicorp/google ~> 4.0

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

# Common configuration for all storage buckets
locals {
  common_bucket_config = {
    project                     = var.project_id
    location                   = var.bucket_location
    uniform_bucket_level_access = true
    encryption = {
      default_kms_key_name = "projects/${var.project_id}/locations/global/keyRings/cosmos-keyring/cryptoKeys/cosmos-storage-key"
    }
    labels = {
      environment = var.environment
      managed_by  = "terraform"
      project     = "cosmos-wfm"
    }
  }
}

# Raw video data storage bucket with 90-day retention
resource "google_storage_bucket" "raw_data_bucket" {
  name                        = "cosmos-raw-data-${var.environment}"
  project                     = local.common_bucket_config.project
  location                   = local.common_bucket_config.location
  storage_class              = "STANDARD"
  uniform_bucket_level_access = local.common_bucket_config.uniform_bucket_level_access
  labels                     = local.common_bucket_config.labels
  
  encryption {
    default_kms_key_name = local.common_bucket_config.encryption.default_kms_key_name
  }

  lifecycle_rule {
    condition {
      age = 90
      with_state = "ANY"
    }
    action {
      type = "Delete"
    }
  }

  versioning {
    enabled = false
  }
}

# Processed data storage bucket with 1-year retention and compression
resource "google_storage_bucket" "processed_data_bucket" {
  name                        = "cosmos-processed-data-${var.environment}"
  project                     = local.common_bucket_config.project
  location                   = local.common_bucket_config.location
  storage_class              = "STANDARD"
  uniform_bucket_level_access = local.common_bucket_config.uniform_bucket_level_access
  labels                     = local.common_bucket_config.labels

  encryption {
    default_kms_key_name = local.common_bucket_config.encryption.default_kms_key_name
  }

  # Transition to NEARLINE after 30 days
  lifecycle_rule {
    condition {
      age = 30
      with_state = "ANY"
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  # Delete after 365 days
  lifecycle_rule {
    condition {
      age = 365
      with_state = "ANY"
    }
    action {
      type = "Delete"
    }
  }

  versioning {
    enabled = false
  }
}

# Model artifacts storage bucket with versioning
resource "google_storage_bucket" "model_artifacts_bucket" {
  name                        = "cosmos-model-artifacts-${var.environment}"
  project                     = local.common_bucket_config.project
  location                   = local.common_bucket_config.location
  storage_class              = "STANDARD"
  uniform_bucket_level_access = local.common_bucket_config.uniform_bucket_level_access
  labels                     = local.common_bucket_config.labels

  encryption {
    default_kms_key_name = local.common_bucket_config.encryption.default_kms_key_name
  }

  versioning {
    enabled = true
  }

  # Delete old versions after newer versions exist
  lifecycle_rule {
    condition {
      num_newer_versions = 5
      with_state        = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
}

# Output values for use in other modules
output "raw_data_bucket" {
  value = {
    name = google_storage_bucket.raw_data_bucket.name
    url  = google_storage_bucket.raw_data_bucket.url
  }
  description = "Raw video data storage bucket details"
}

output "processed_data_bucket" {
  value = {
    name = google_storage_bucket.processed_data_bucket.name
    url  = google_storage_bucket.processed_data_bucket.url
  }
  description = "Processed data storage bucket details"
}

output "model_artifacts_bucket" {
  value = {
    name = google_storage_bucket.model_artifacts_bucket.name
    url  = google_storage_bucket.model_artifacts_bucket.url
  }
  description = "Model artifacts storage bucket details"
}
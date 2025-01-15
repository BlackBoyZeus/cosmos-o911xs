# Core Terraform functionality for variable definitions and validation rules
terraform {
  required_version = ">=1.0.0"
}

variable "project_id" {
  type        = string
  description = "The GCP project ID where storage resources will be created"
  
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be between 6 and 30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

variable "bucket_location" {
  type        = string
  description = "The GCP location where storage buckets will be deployed"
  default     = "US-CENTRAL1"
  
  validation {
    condition     = can(regex("^(US|EU|ASIA|[A-Z]+-[A-Z]+\\d)$", var.bucket_location))
    error_message = "Location must be a valid GCP region or multi-region location (e.g., US, EU, ASIA, US-CENTRAL1)."
  }
}

variable "raw_data_bucket_name" {
  type        = string
  description = "Name for the bucket storing raw video data"
  
  validation {
    condition     = can(regex("^[a-z0-9][-_.a-z0-9]{1,61}[a-z0-9]$", var.raw_data_bucket_name))
    error_message = "Bucket name must be between 3 and 63 characters, start and end with a number or letter, and contain only lowercase letters, numbers, hyphens, underscores, and dots."
  }
}

variable "processed_data_bucket_name" {
  type        = string
  description = "Name for the bucket storing processed video data"
  
  validation {
    condition     = can(regex("^[a-z0-9][-_.a-z0-9]{1,61}[a-z0-9]$", var.processed_data_bucket_name))
    error_message = "Bucket name must be between 3 and 63 characters, start and end with a number or letter, and contain only lowercase letters, numbers, hyphens, underscores, and dots."
  }
}

variable "model_artifacts_bucket_name" {
  type        = string
  description = "Name for the bucket storing model artifacts and checkpoints"
  
  validation {
    condition     = can(regex("^[a-z0-9][-_.a-z0-9]{1,61}[a-z0-9]$", var.model_artifacts_bucket_name))
    error_message = "Bucket name must be between 3 and 63 characters, start and end with a number or letter, and contain only lowercase letters, numbers, hyphens, underscores, and dots."
  }
}

variable "storage_class" {
  type        = string
  description = "Storage class to use for the buckets"
  default     = "STANDARD"
  
  validation {
    condition     = contains(["STANDARD", "NEARLINE", "COLDLINE", "ARCHIVE"], var.storage_class)
    error_message = "Storage class must be one of: STANDARD, NEARLINE, COLDLINE, ARCHIVE."
  }
}

variable "lifecycle_rules" {
  type = map(object({
    age_in_days            = number
    action                 = string
    target_storage_class   = optional(string)
    with_state            = optional(string)
    matches_storage_class = optional(list(string))
  }))
  description = "Map of lifecycle rules for bucket objects"
  
  default = {
    "transition_to_nearline" = {
      age_in_days          = 30
      action              = "SetStorageClass"
      target_storage_class = "NEARLINE"
    },
    "transition_to_coldline" = {
      age_in_days          = 90
      action              = "SetStorageClass"
      target_storage_class = "COLDLINE"
    },
    "delete_old_objects" = {
      age_in_days          = 365
      action              = "Delete"
    }
  }
  
  validation {
    condition     = alltrue([
      for rule in var.lifecycle_rules : 
        rule.age_in_days > 0 &&
        contains(["Delete", "SetStorageClass"], rule.action) &&
        (rule.action != "SetStorageClass" || contains(["NEARLINE", "COLDLINE", "ARCHIVE"], rule.target_storage_class))
    ])
    error_message = "Invalid lifecycle rule configuration. Age must be positive, action must be Delete or SetStorageClass, and target storage class must be valid when specified."
  }
}

variable "encryption_key_name" {
  type        = string
  description = "The Cloud KMS key name to use for bucket encryption"
  default     = ""
  
  validation {
    condition     = var.encryption_key_name == "" || can(regex("^projects/[^/]+/locations/[^/]+/keyRings/[^/]+/cryptoKeys/[^/]+$", var.encryption_key_name))
    error_message = "Encryption key name must be empty or a valid KMS key name in the format: projects/PROJECT_ID/locations/LOCATION/keyRings/RING_NAME/cryptoKeys/KEY_NAME"
  }
}
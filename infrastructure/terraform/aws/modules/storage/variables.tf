# Environment configuration
variable "environment" {
  description = "Deployment environment identifier (dev/staging/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "cosmos-wfm"
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

# Bucket naming variables
variable "raw_data_bucket_name" {
  description = "Name of S3 bucket for raw video data storage"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.raw_data_bucket_name))
    error_message = "Bucket name must contain only lowercase letters, numbers, dots, and hyphens."
  }
}

variable "processed_data_bucket_name" {
  description = "Name of S3 bucket for processed video data storage"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.processed_data_bucket_name))
    error_message = "Bucket name must contain only lowercase letters, numbers, dots, and hyphens."
  }
}

variable "model_artifacts_bucket_name" {
  description = "Name of S3 bucket for model weights and checkpoints storage"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9.-]+$", var.model_artifacts_bucket_name))
    error_message = "Bucket name must contain only lowercase letters, numbers, dots, and hyphens."
  }
}

# Data lifecycle variables
variable "raw_data_retention_days" {
  description = "Number of days to retain raw data before transitioning to Glacier storage"
  type        = number
  default     = 90
  validation {
    condition     = var.raw_data_retention_days >= 30 && var.raw_data_retention_days <= 365
    error_message = "Raw data retention period must be between 30 and 365 days."
  }
}

variable "processed_data_retention_days" {
  description = "Number of days to retain processed data before expiration"
  type        = number
  default     = 365
  validation {
    condition     = var.processed_data_retention_days >= 90 && var.processed_data_retention_days <= 730
    error_message = "Processed data retention period must be between 90 and 730 days."
  }
}

variable "processed_data_compression_days" {
  description = "Number of days before transitioning processed data to Standard-IA storage class"
  type        = number
  default     = 90
  validation {
    condition     = var.processed_data_compression_days >= 30 && var.processed_data_compression_days <= 180
    error_message = "Processed data compression transition period must be between 30 and 180 days."
  }
}

# Storage configuration variables
variable "enable_versioning" {
  description = "Flag to enable versioning on model artifacts bucket"
  type        = bool
  default     = true
}

# Resource tagging
variable "tags" {
  description = "Common tags to be applied to all storage resources"
  type        = map(string)
  default = {
    Project     = "cosmos-wfm"
    Terraform   = "true"
    Environment = "dev"
  }
  validation {
    condition     = length(var.tags) > 0
    error_message = "At least one tag must be specified."
  }
}
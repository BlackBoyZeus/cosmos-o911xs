# AWS Region Configuration
variable "aws_region" {
  description = "AWS region for deploying resources"
  type        = string
  default     = "us-west-2"

  validation {
    condition     = can(regex("^(us|eu|ap|sa|ca|me|af)-(north|south|east|west|central)-[1-3]$", var.aws_region))
    error_message = "AWS region must be a valid region identifier (e.g., us-west-2, eu-central-1)."
  }
}

# Environment Configuration
variable "environment" {
  description = "Deployment environment identifier"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Project Configuration
variable "project_name" {
  description = "Project name for resource naming and tagging"
  type        = string
  default     = "cosmos-wfm"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,28}[a-z0-9]$", var.project_name))
    error_message = "Project name must be 4-30 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens."
  }
}

# Network Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC network"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# GPU Cluster Configuration
variable "gpu_instance_type" {
  description = "AWS GPU instance type for model training and inference"
  type        = string
  default     = "p4d.24xlarge"

  validation {
    condition     = contains(["p4d.24xlarge"], var.gpu_instance_type)
    error_message = "GPU instance type must be p4d.24xlarge for Cosmos WFM platform."
  }
}

variable "gpu_cluster_size" {
  description = "Number of GPU instances in the cluster"
  type        = number
  default     = 4

  validation {
    condition     = var.gpu_cluster_size >= 1 && var.gpu_cluster_size <= 64
    error_message = "GPU cluster size must be between 1 and 64 instances."
  }
}

# Storage Configuration
variable "storage_bucket_prefix" {
  description = "Prefix for S3 bucket names"
  type        = string
  default     = "cosmos-wfm"

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$", var.storage_bucket_prefix))
    error_message = "Storage bucket prefix must be 3-63 characters, contain only lowercase letters, numbers, and hyphens, and start/end with a letter or number."
  }
}

# Database Configuration
variable "db_instance_class" {
  description = "DocumentDB instance class"
  type        = string
  default     = "db.r6g.2xlarge"

  validation {
    condition     = can(regex("^db\\.r6g\\.(large|xlarge|2xlarge|4xlarge|8xlarge|12xlarge|16xlarge)$", var.db_instance_class))
    error_message = "DocumentDB instance class must be a valid r6g instance type."
  }
}

variable "db_instance_count" {
  description = "Number of DocumentDB instances"
  type        = number
  default     = 3

  validation {
    condition     = var.db_instance_count >= 1 && var.db_instance_count <= 16
    error_message = "DocumentDB instance count must be between 1 and 16."
  }
}

variable "backup_retention_days" {
  description = "Number of days to retain DocumentDB backups"
  type        = number
  default     = 7

  validation {
    condition     = var.backup_retention_days >= 1 && var.backup_retention_days <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# Resource Tagging
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "cosmos-wfm"
    Environment = "dev"
    Terraform   = "true"
    Service     = "ml-platform"
  }

  validation {
    condition     = contains(keys(var.tags), "Project") && contains(keys(var.tags), "Environment")
    error_message = "Tags must include at minimum 'Project' and 'Environment' keys."
  }
}
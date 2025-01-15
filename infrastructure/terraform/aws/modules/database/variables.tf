# Instance Configuration
variable "cluster_instance_class" {
  description = "The instance class to use for DocumentDB cluster nodes (e.g. db.r6g.large)"
  type        = string
  default     = "db.r6g.large"
}

variable "cluster_instance_count" {
  description = "Number of instances to create in the DocumentDB cluster"
  type        = number
  default     = 3
  validation {
    condition     = var.cluster_instance_count >= 1 && var.cluster_instance_count <= 16
    error_message = "Cluster instance count must be between 1 and 16."
  }
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain automated DocumentDB backups"
  type        = number
  default     = 7
  validation {
    condition     = var.backup_retention_period >= 1 && var.backup_retention_period <= 35
    error_message = "Backup retention period must be between 1 and 35 days."
  }
}

# Network Configuration
variable "vpc_id" {
  description = "ID of the VPC where the DocumentDB cluster will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs where the DocumentDB cluster can be deployed"
  type        = list(string)
  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnet IDs are required for high availability."
  }
}

variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the DocumentDB cluster"
  type        = list(string)
  default     = []
  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "All elements must be valid CIDR blocks."
  }
}

# Environment Configuration
variable "environment" {
  description = "Environment name for resource naming and tagging (e.g. dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Tagging Configuration
variable "tags" {
  description = "Map of tags to apply to all database resources"
  type        = map(string)
  default     = {}
}

# Engine Configuration
variable "engine_version" {
  description = "Version number of the DocumentDB engine"
  type        = string
  default     = "4.0.0"
}

# Security Configuration
variable "master_username" {
  description = "Username for the master DB user"
  type        = string
  sensitive   = true
}

variable "master_password" {
  description = "Password for the master DB user"
  type        = string
  sensitive   = true
}

variable "tls_enabled" {
  description = "Enable/disable TLS for database connections"
  type        = bool
  default     = true
}

# Performance Configuration
variable "preferred_maintenance_window" {
  description = "The weekly time range during which system maintenance can occur (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
  validation {
    condition     = can(regex("^[a-z]{3}:[0-9]{2}:[0-9]{2}-[a-z]{3}:[0-9]{2}:[0-9]{2}$", var.preferred_maintenance_window))
    error_message = "Maintenance window must be in the format 'ddd:hh:mm-ddd:hh:mm'."
  }
}

variable "skip_final_snapshot" {
  description = "Determines whether a final DB snapshot is created before cluster deletion"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Prevents the cluster from being deleted"
  type        = bool
  default     = true
}

# Monitoring Configuration
variable "enable_performance_insights" {
  description = "Enable/disable Performance Insights for the cluster"
  type        = bool
  default     = true
}

variable "monitoring_interval" {
  description = "The interval, in seconds, between points when Enhanced Monitoring metrics are collected"
  type        = number
  default     = 30
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be one of: 0, 1, 5, 10, 15, 30, 60."
  }
}
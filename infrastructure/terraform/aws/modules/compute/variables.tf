# Project name variable with validation for allowed characters
variable "project_name" {
  description = "Project name used for resource naming and tagging"
  type        = string
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]*$", var.project_name))
    error_message = "Project name must start with a letter and can only contain letters, numbers, and hyphens."
  }
}

# Environment variable with strict validation
variable "environment" {
  description = "Deployment environment (dev/staging/prod)"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# VPC CIDR block with validation
variable "vpc_cidr" {
  description = "CIDR block for the VPC network"
  type        = string
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

# GPU instance type with validation for allowed families
variable "instance_type" {
  description = "GPU instance type for compute nodes"
  type        = string
  default     = "p4d.24xlarge"
  
  validation {
    condition     = can(regex("^(p4d|p3|g4dn|g5)\\.", var.instance_type))
    error_message = "Instance type must be a valid GPU instance type (p4d, p3, g4dn, or g5 family)."
  }
}

# Cluster size with min/max validation
variable "cluster_size" {
  description = "Number of GPU instances in the cluster"
  type        = number
  default     = 1
  
  validation {
    condition     = var.cluster_size >= 1 && var.cluster_size <= 100
    error_message = "Cluster size must be between 1 and 100 instances."
  }
}

# Availability zones with format validation
variable "availability_zones" {
  description = "List of AWS availability zones for deployment"
  type        = list(string)
  
  validation {
    condition     = alltrue([for az in var.availability_zones : can(regex("^[a-z]{2}-[a-z]+-[0-9][a-z]$", az))])
    error_message = "Availability zones must be in the format: region-az-number (e.g., us-east-1a)."
  }
}

# Subnet count with minimum validation
variable "subnet_count" {
  description = "Number of private subnets to create"
  type        = number
  default     = 2
  
  validation {
    condition     = var.subnet_count >= 2
    error_message = "At least 2 subnets are required for high availability."
  }
}

# Resource tags with required tag validation
variable "tags" {
  description = "Resource tags for cost allocation and organization"
  type        = map(string)
  default = {
    Terraform = "true"
    Project   = "cosmos-wfm"
  }
  
  validation {
    condition     = contains(keys(var.tags), "Project") && contains(keys(var.tags), "Terraform")
    error_message = "Tags must include 'Project' and 'Terraform' keys."
  }
}

# AMI ID for GPU instances
variable "ami_id" {
  description = "AMI ID for GPU instances (must include NVIDIA drivers)"
  type        = string
  
  validation {
    condition     = can(regex("^ami-[a-f0-9]{17}$", var.ami_id))
    error_message = "AMI ID must be a valid AWS AMI identifier."
  }
}

# Root volume configuration
variable "root_volume_size" {
  description = "Size of the root volume in GB"
  type        = number
  default     = 100
  
  validation {
    condition     = var.root_volume_size >= 100 && var.root_volume_size <= 16384
    error_message = "Root volume size must be between 100 GB and 16384 GB."
  }
}

# Security group rules for GPU cluster
variable "allowed_cidr_blocks" {
  description = "List of CIDR blocks allowed to access the GPU cluster"
  type        = list(string)
  
  validation {
    condition     = alltrue([for cidr in var.allowed_cidr_blocks : can(cidrhost(cidr, 0))])
    error_message = "All CIDR blocks must be valid IPv4 CIDR notation."
  }
}

# Instance profile configuration
variable "instance_profile_name" {
  description = "Name of the IAM instance profile for GPU instances"
  type        = string
  
  validation {
    condition     = can(regex("^[\\w+=,.@-]{1,128}$", var.instance_profile_name))
    error_message = "Instance profile name must be valid IAM resource name."
  }
}

# Auto Scaling configuration
variable "enable_auto_scaling" {
  description = "Enable auto scaling for the GPU cluster"
  type        = bool
  default     = true
}

variable "auto_scaling_config" {
  description = "Auto scaling configuration for the GPU cluster"
  type = object({
    min_size         = number
    max_size         = number
    desired_capacity = number
  })
  default = {
    min_size         = 1
    max_size         = 10
    desired_capacity = 1
  }
  
  validation {
    condition     = var.auto_scaling_config.min_size <= var.auto_scaling_config.desired_capacity && var.auto_scaling_config.desired_capacity <= var.auto_scaling_config.max_size
    error_message = "Auto scaling desired capacity must be between min and max size."
  }
}
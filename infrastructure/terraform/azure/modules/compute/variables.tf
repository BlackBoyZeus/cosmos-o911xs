# Resource group configuration
variable "resource_group_name" {
  description = "Name of the Azure resource group where compute resources will be deployed"
  type        = string

  validation {
    condition     = length(var.resource_group_name) > 0 && can(regex("^[a-zA-Z0-9-_]*$", var.resource_group_name))
    error_message = "Resource group name must be non-empty and contain only alphanumeric characters, hyphens, and underscores"
  }
}

# Location configuration
variable "location" {
  description = "Azure region where compute resources will be deployed (must support H100/A100 GPUs)"
  type        = string

  validation {
    condition     = can(regex("^(eastus|westus2|southcentralus|westeurope|eastasia)$", var.location))
    error_message = "Location must be a valid Azure region that supports NVIDIA H100/A100 GPU instances"
  }
}

# GPU cluster configuration
variable "gpu_cluster_name" {
  description = "Name of the GPU cluster virtual machine scale set (must be unique within resource group)"
  type        = string

  validation {
    condition     = length(var.gpu_cluster_name) >= 3 && length(var.gpu_cluster_name) <= 24 && can(regex("^[a-z][a-z0-9-]*[a-z0-9]$", var.gpu_cluster_name))
    error_message = "GPU cluster name must be 3-24 characters, start with a letter, and contain only lowercase letters, numbers, and hyphens"
  }
}

variable "gpu_node_count" {
  description = "Number of GPU nodes in the cluster (consider quota limits)"
  type        = number
  default     = 1

  validation {
    condition     = var.gpu_node_count > 0 && var.gpu_node_count <= 100
    error_message = "GPU node count must be between 1 and 100 nodes"
  }
}

variable "gpu_vm_size" {
  description = "Azure VM size for GPU nodes (H100 or A100)"
  type        = string
  default     = "Standard_NC24ads_A100_v4"

  validation {
    condition     = can(regex("^Standard_NC[0-9]+ads_(A100|H100)_v4$", var.gpu_vm_size))
    error_message = "VM size must be a valid GPU-enabled size (A100 or H100 v4 series)"
  }
}

# Network configuration
variable "vnet_address_space" {
  description = "Address space for the virtual network in CIDR notation (must not overlap with existing networks)"
  type        = list(string)
  default     = ["10.0.0.0/16"]

  validation {
    condition     = can([for addr in var.vnet_address_space : regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", addr)]) && length(var.vnet_address_space) > 0
    error_message = "Virtual network address space must be valid CIDR notation and list cannot be empty"
  }
}

variable "subnet_address_prefix" {
  description = "Address prefix for the GPU cluster subnet in CIDR notation (must be within vnet_address_space)"
  type        = list(string)
  default     = ["10.0.1.0/24"]

  validation {
    condition     = can([for addr in var.subnet_address_prefix : regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/[0-9]{1,2}$", addr)]) && length(var.subnet_address_prefix) > 0
    error_message = "Subnet address prefix must be valid CIDR notation and list cannot be empty"
  }
}

# Access configuration
variable "admin_username" {
  description = "Admin username for GPU nodes (must follow Linux username conventions)"
  type        = string
  default     = "azureuser"

  validation {
    condition     = can(regex("^[a-z][-a-z0-9]*$", var.admin_username)) && length(var.admin_username) >= 1 && length(var.admin_username) <= 64
    error_message = "Admin username must be 1-64 characters, start with lowercase letter, and contain only lowercase letters, numbers, and hyphens"
  }
}
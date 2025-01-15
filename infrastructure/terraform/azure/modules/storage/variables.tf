# Azure Resource Manager provider version ~> 3.0

variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group where storage resources will be created"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-_]{1,90}$", var.resource_group_name))
    error_message = "Resource group name must be 1-90 characters long and can only contain alphanumeric characters, hyphens, and underscores."
  }
}

variable "location" {
  type        = string
  description = "Azure region for storage resource deployment"
}

variable "storage_account_name" {
  type        = string
  description = "Name of the Azure storage account for the Cosmos WFM Platform"
  
  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Storage account name must be 3-24 characters long and can only contain lowercase letters and numbers."
  }
}

variable "storage_account_tier" {
  type        = string
  description = "Performance tier of the storage account (Standard or Premium)"
  default     = "Standard"
  
  validation {
    condition     = contains(["Standard", "Premium"], var.storage_account_tier)
    error_message = "Storage account tier must be either Standard or Premium."
  }
}

variable "storage_replication_type" {
  type        = string
  description = "Replication configuration for the storage account"
  default     = "GRS"
  
  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.storage_replication_type)
    error_message = "Storage replication type must be one of: LRS, GRS, RAGRS, ZRS, GZRS, RAGZRS."
  }
}

variable "container_access_types" {
  type        = map(string)
  description = "Access level configuration for each storage container"
  default = {
    "video-data"      = "private"
    "model-artifacts" = "private"
    "datasets"        = "private"
    "temp"           = "private"
  }
}

variable "lifecycle_rules" {
  type = list(object({
    name                = string
    enabled            = bool
    prefix_match       = list(string)
    tier_to_cool_after = number
    tier_to_archive_after = number
    delete_after       = number
  }))
  description = "Lifecycle management rules for automatic tiering between hot and cold storage"
  default = [
    {
      name                = "video-archive"
      enabled            = true
      prefix_match       = ["video-data/"]
      tier_to_cool_after = 30
      tier_to_archive_after = 90
      delete_after       = 365
    },
    {
      name                = "dataset-archive"
      enabled            = true
      prefix_match       = ["datasets/"]
      tier_to_cool_after = 60
      tier_to_archive_after = 180
      delete_after       = 730
    }
  ]
}

variable "network_rules" {
  type = object({
    default_action             = string
    ip_rules                  = list(string)
    virtual_network_subnet_ids = list(string)
    bypass                    = list(string)
  })
  description = "Network access rules for storage account security"
  default = {
    default_action             = "Deny"
    ip_rules                  = []
    virtual_network_subnet_ids = []
    bypass                    = ["AzureServices"]
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for cost allocation and resource management"
  default = {
    Environment = "production"
    Project     = "cosmos-wfm"
    ManagedBy   = "terraform"
  }
}
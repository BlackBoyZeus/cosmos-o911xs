# Azure Resource Manager provider version ~> 3.0

variable "resource_group_name" {
  type        = string
  description = "Name of the Azure resource group where Cosmos DB resources will be created"
}

variable "location" {
  type        = string
  description = "Azure region for primary Cosmos DB deployment"
}

variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "cosmos_db_config" {
  type = object({
    account_name            = string
    database_name          = string
    throughput             = optional(number, 4000)
    max_throughput         = optional(number, 10000)
    backup_retention_hours = optional(number, 72)
    backup_interval_minutes = optional(number, 240)
    geo_locations = list(object({
      location          = string
      failover_priority = number
      zone_redundant    = optional(bool, false)
    }))
    consistency_level = optional(string, "Session")
    enable_autoscale  = optional(bool, true)
    enable_analytical_storage = optional(bool, false)
    enable_free_tier  = optional(bool, false)
    capabilities      = optional(list(string), [])
    is_virtual_network_filter_enabled = optional(bool, true)
    public_network_access_enabled    = optional(bool, false)
    backup_policy = optional(object({
      type                = optional(string, "Periodic")
      interval_in_minutes = optional(number, 240)
      retention_in_hours  = optional(number, 72)
      storage_redundancy  = optional(string, "Geo")
    }))
  })
  description = "Comprehensive configuration object for Cosmos DB account and database settings"

  validation {
    condition     = var.cosmos_db_config.throughput >= 4000 && var.cosmos_db_config.throughput <= 1000000
    error_message = "Throughput must be between 4000 and 1000000 RU/s"
  }

  validation {
    condition     = length(var.cosmos_db_config.geo_locations) >= 1
    error_message = "At least one geo location must be specified"
  }

  validation {
    condition     = contains(["Eventual", "Session", "BoundedStaleness", "Strong", "ConsistentPrefix"], var.cosmos_db_config.consistency_level)
    error_message = "Invalid consistency level. Must be one of: Eventual, Session, BoundedStaleness, Strong, ConsistentPrefix"
  }
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for cost allocation, environment identification, and resource management"
  default = {
    managed_by = "terraform"
    component  = "database"
  }

  validation {
    condition     = can(lookup(var.tags, "environment")) && can(lookup(var.tags, "project"))
    error_message = "Tags must include 'environment' and 'project' keys"
  }
}

variable "network_rules" {
  type = object({
    ip_rules                   = optional(list(string), [])
    virtual_network_rules      = optional(list(string), [])
    bypass_ip_rules           = optional(list(string), [])
    subnet_ids                = optional(list(string), [])
  })
  description = "Network rules for Cosmos DB access control"
  default     = {}
}

variable "private_endpoint_config" {
  type = object({
    enabled              = optional(bool, true)
    subnet_id            = string
    private_dns_zone_ids = list(string)
  })
  description = "Configuration for Cosmos DB private endpoint"
  default = {
    enabled              = false
    subnet_id            = ""
    private_dns_zone_ids = []
  }
}

variable "diagnostic_settings" {
  type = object({
    enabled                  = optional(bool, true)
    log_analytics_workspace_id = string
    retention_days           = optional(number, 30)
    logs_categories         = optional(list(string), ["DataPlaneRequests", "QueryRuntimeStatistics", "PartitionKeyStatistics", "ControlPlaneRequests"])
    metrics_categories      = optional(list(string), ["Requests", "DataUsage"])
  })
  description = "Configuration for Cosmos DB diagnostic settings"
  default = {
    enabled                  = false
    log_analytics_workspace_id = ""
    retention_days           = 30
    logs_categories         = []
    metrics_categories      = []
  }
}
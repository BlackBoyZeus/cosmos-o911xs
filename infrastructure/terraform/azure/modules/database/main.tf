# Provider configuration for Azure and Random
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Generate unique suffix for globally unique Cosmos DB account name
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
  numeric = true
  min_numeric = 2
}

# Primary Cosmos DB account with MongoDB API compatibility
resource "azurerm_cosmosdb_account" "cosmos_db_account" {
  name                = "cosmos-${var.environment}-${random_string.suffix.result}"
  location            = var.location
  resource_group_name = var.resource_group_name
  offer_type         = "Standard"
  kind               = "MongoDB"
  
  # Enable MongoDB API and advanced features
  capabilities {
    name = "EnableMongo"
  }
  capabilities {
    name = "EnableServerless"
  }
  capabilities {
    name = "EnableAggregationPipeline"
  }
  capabilities {
    name = "mongoEnableDocLevelTTL"
  }

  # Configure consistency policy for high availability
  consistency_policy {
    consistency_level       = var.cosmos_db_config.consistency_level
    max_interval_in_seconds = 5
    max_staleness_prefix   = 100
  }

  # Configure geo-redundant locations
  dynamic "geo_location" {
    for_each = var.cosmos_db_config.geo_locations
    content {
      location          = geo_location.value.location
      failover_priority = geo_location.value.failover_priority
      zone_redundant    = geo_location.value.zone_redundant
    }
  }

  # Configure backup policy
  backup {
    type                = var.cosmos_db_config.backup_policy.type
    interval_in_minutes = var.cosmos_db_config.backup_policy.interval_in_minutes
    retention_in_hours  = var.cosmos_db_config.backup_policy.retention_in_hours
    storage_redundancy  = var.cosmos_db_config.backup_policy.storage_redundancy
  }

  # Enable system-assigned managed identity
  identity {
    type = "SystemAssigned"
  }

  # Network security configuration
  is_virtual_network_filter_enabled = var.cosmos_db_config.is_virtual_network_filter_enabled
  public_network_access_enabled    = var.cosmos_db_config.public_network_access_enabled
  network_acl_bypass_for_azure_services = true

  # Network rules
  dynamic "virtual_network_rule" {
    for_each = var.network_rules.virtual_network_rules
    content {
      id = virtual_network_rule.value
    }
  }

  dynamic "ip_range_filter" {
    for_each = var.network_rules.ip_rules
    content {
      ip_range = ip_range_filter.value
    }
  }

  # Enable analytical storage if configured
  analytical_storage_enabled = var.cosmos_db_config.enable_analytical_storage

  # Tags for resource management
  tags = merge(var.tags, {
    environment = var.environment
    component   = "cosmos-db"
  })
}

# Main database for metadata, model info and safety logs
resource "azurerm_cosmosdb_mongo_database" "cosmos_db_database" {
  name                = var.cosmos_db_config.database_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.cosmos_db_account.name

  # Configure autoscaling throughput
  dynamic "autoscale_settings" {
    for_each = var.cosmos_db_config.enable_autoscale ? [1] : []
    content {
      max_throughput = var.cosmos_db_config.max_throughput
    }
  }

  # Configure fixed throughput if autoscale is disabled
  dynamic "throughput" {
    for_each = var.cosmos_db_config.enable_autoscale ? [] : [1]
    content {
      throughput = var.cosmos_db_config.throughput
    }
  }
}

# Private endpoint configuration if enabled
resource "azurerm_private_endpoint" "cosmos_db_pe" {
  count               = var.private_endpoint_config.enabled ? 1 : 0
  name                = "pe-${azurerm_cosmosdb_account.cosmos_db_account.name}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.private_endpoint_config.subnet_id

  private_service_connection {
    name                           = "psc-${azurerm_cosmosdb_account.cosmos_db_account.name}"
    private_connection_resource_id = azurerm_cosmosdb_account.cosmos_db_account.id
    is_manual_connection          = false
    subresource_names            = ["MongoDB"]
  }

  dynamic "private_dns_zone_group" {
    for_each = length(var.private_endpoint_config.private_dns_zone_ids) > 0 ? [1] : []
    content {
      name                 = "default"
      private_dns_zone_ids = var.private_endpoint_config.private_dns_zone_ids
    }
  }

  tags = var.tags
}

# Diagnostic settings if enabled
resource "azurerm_monitor_diagnostic_setting" "cosmos_db_diag" {
  count                      = var.diagnostic_settings.enabled ? 1 : 0
  name                       = "diag-${azurerm_cosmosdb_account.cosmos_db_account.name}"
  target_resource_id         = azurerm_cosmosdb_account.cosmos_db_account.id
  log_analytics_workspace_id = var.diagnostic_settings.log_analytics_workspace_id

  dynamic "log" {
    for_each = var.diagnostic_settings.logs_categories
    content {
      category = log.value
      enabled  = true
      retention_policy {
        enabled = true
        days    = var.diagnostic_settings.retention_days
      }
    }
  }

  dynamic "metric" {
    for_each = var.diagnostic_settings.metrics_categories
    content {
      category = metric.value
      enabled  = true
      retention_policy {
        enabled = true
        days    = var.diagnostic_settings.retention_days
      }
    }
  }
}
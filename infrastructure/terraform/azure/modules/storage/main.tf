# Azure Storage Module for Cosmos WFM Platform
# Provider version: ~> 3.0

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

locals {
  storage_account_name = var.storage_account_name
  default_container_access_type = "private"
  
  # Network security configuration
  default_network_rules = {
    default_action = "Deny"
    bypass = ["AzureServices"]
    ip_rules = []
    virtual_network_subnet_ids = []
  }
}

# Primary storage account for the Cosmos WFM platform
resource "azurerm_storage_account" "main" {
  name                     = local.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = var.storage_account_tier
  account_replication_type = var.storage_replication_type
  
  # Security configurations
  enable_https_traffic_only       = true
  min_tls_version                = "TLS1_2"
  allow_nested_items_to_be_public = false
  
  # Network rules
  network_rules {
    default_action             = local.default_network_rules.default_action
    bypass                     = local.default_network_rules.bypass
    ip_rules                   = local.default_network_rules.ip_rules
    virtual_network_subnet_ids = local.default_network_rules.virtual_network_subnet_ids
  }

  # Blob service properties
  blob_properties {
    versioning_enabled = true
    change_feed_enabled = true
    
    delete_retention_policy {
      days = 30
    }
    
    container_delete_retention_policy {
      days = 30
    }
  }

  # Data protection
  large_file_share_enabled = true

  # Lifecycle management
  dynamic "lifecycle_rule" {
    for_each = var.lifecycle_rules
    content {
      name    = lifecycle_rule.value.name
      enabled = lifecycle_rule.value.enabled
      
      filters {
        prefix_match = lifecycle_rule.value.prefix_match
      }
      
      actions {
        base_blob {
          tier_to_cool_after_days    = lifecycle_rule.value.tier_to_cool_after
          tier_to_archive_after_days = lifecycle_rule.value.tier_to_archive_after
          delete_after_days          = lifecycle_rule.value.delete_after
        }
      }
    }
  }

  tags = var.tags
}

# Container for raw video data
resource "azurerm_storage_container" "video_data" {
  name                  = var.video_container_name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = local.default_container_access_type
  
  metadata = {
    content_type = "video"
    purpose      = "raw_video_storage"
  }
}

# Container for model artifacts
resource "azurerm_storage_container" "model_artifacts" {
  name                  = var.model_container_name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = local.default_container_access_type
  
  metadata = {
    content_type = "model"
    purpose      = "model_storage"
  }
}

# Container for training datasets
resource "azurerm_storage_container" "datasets" {
  name                  = var.dataset_container_name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = local.default_container_access_type
  
  metadata = {
    content_type = "dataset"
    purpose      = "training_data"
  }
}

# Output values for reference by other modules
output "storage_account_id" {
  value       = azurerm_storage_account.main.id
  description = "The ID of the storage account"
}

output "primary_blob_endpoint" {
  value       = azurerm_storage_account.main.primary_blob_endpoint
  description = "The primary blob endpoint URL"
}

output "container_names" {
  value = {
    video_data      = azurerm_storage_container.video_data.name
    model_artifacts = azurerm_storage_container.model_artifacts.name
    datasets        = azurerm_storage_container.datasets.name
  }
  description = "Map of created container names"
}
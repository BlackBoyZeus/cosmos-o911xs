# Azure Provider configuration with enhanced features
# Provider version: ~> 3.0
terraform {
  required_version = ">= 1.0.0"
  
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

  backend "azurerm" {
    # Backend configuration should be provided via backend config file or CLI
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = true
    }
    key_vault {
      purge_soft_delete_on_destroy = false
      recover_soft_deleted_key_vaults = true
    }
  }
}

# Local variables for enhanced resource naming and configuration
locals {
  # Default tags for all resources
  default_tags = {
    Environment         = var.environment
    Project            = var.project_name
    ManagedBy          = "terraform"
    DataClassification = "confidential"
    SecurityLevel      = "high"
  }

  # Resource naming convention with guaranteed uniqueness
  name_suffix         = random_string.suffix.result
  resource_group_name = "${var.project_name}-${var.environment}-rg"
  
  # Monitoring thresholds
  monitoring_config = {
    cpu_threshold    = 80
    memory_threshold = 85
    disk_threshold   = 90
  }

  # Backup and disaster recovery settings
  dr_config = {
    backup_retention_days = 30
    geo_redundant        = var.environment == "prod"
  }
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Primary resource group with enhanced security controls
resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.default_tags

  lifecycle {
    prevent_destroy = true
  }
}

# Enhanced GPU compute infrastructure module
module "compute" {
  source = "./modules/compute"

  resource_group_name = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  project_name       = var.project_name
  environment        = var.environment
  
  gpu_cluster_config = {
    node_count = var.gpu_cluster_config.node_count
    vm_size    = var.gpu_cluster_config.vm_size
    subnet_id  = var.gpu_cluster_config.subnet_id
    network_config = var.gpu_cluster_config.network_config
    scaling_config = var.gpu_cluster_config.scaling_config
    node_labels    = var.gpu_cluster_config.node_labels
    node_taints    = var.gpu_cluster_config.node_taints
  }

  monitoring_config = local.monitoring_config
  tags             = local.default_tags
}

# Enhanced storage infrastructure module
module "storage" {
  source = "./modules/storage"

  resource_group_name = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  project_name       = var.project_name
  environment        = var.environment
  
  storage_config = {
    account_tier             = var.storage_config.account_tier
    account_replication_type = var.storage_config.account_replication_type
    containers              = var.storage_config.containers
    lifecycle_rules         = var.storage_config.lifecycle_rules
  }

  dr_config = local.dr_config
  tags      = local.default_tags
}

# Enhanced database infrastructure module
module "database" {
  source = "./modules/database"

  resource_group_name = azurerm_resource_group.main.name
  location           = azurerm_resource_group.main.location
  project_name       = var.project_name
  environment        = var.environment
  
  database_config = {
    throughput        = var.database_config.throughput
    consistency_level = var.database_config.consistency_level
    geo_locations     = var.database_config.geo_locations
    backup_config     = var.database_config.backup_config
    collections       = var.database_config.collections
  }

  dr_config = local.dr_config
  tags      = local.default_tags
}

# Outputs for resource references
output "resource_group" {
  value = {
    id       = azurerm_resource_group.main.id
    name     = azurerm_resource_group.main.name
    location = azurerm_resource_group.main.location
  }
  description = "Primary resource group details"
}

output "compute_resources" {
  value = {
    gpu_cluster_id       = module.compute.gpu_cluster_id
    gpu_cluster_identity = module.compute.gpu_cluster_identity
  }
  description = "GPU compute infrastructure details"
  sensitive   = true
}

output "storage_resources" {
  value = {
    storage_account_id    = module.storage.storage_account_id
    primary_blob_endpoint = module.storage.primary_blob_endpoint
  }
  description = "Storage infrastructure details"
  sensitive   = true
}

output "database_resources" {
  value = {
    cosmos_db_id         = module.database.cosmos_db_id
    cosmos_db_endpoint   = module.database.cosmos_db_endpoint
  }
  description = "Database infrastructure details"
  sensitive   = true
}
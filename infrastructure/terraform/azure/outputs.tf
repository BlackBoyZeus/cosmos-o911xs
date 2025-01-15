# Resource Group Outputs
output "resource_group_id" {
  description = "The ID of the Azure Resource Group containing Cosmos WFM infrastructure"
  value       = azurerm_resource_group.main.id
}

output "resource_group_name" {
  description = "The name of the Azure Resource Group containing Cosmos WFM infrastructure"
  value       = azurerm_resource_group.main.name
}

# GPU Compute Infrastructure Outputs
output "gpu_cluster_id" {
  description = "The ID of the GPU cluster for model training and inference"
  value       = module.compute.gpu_cluster_id
  sensitive   = true
}

output "gpu_cluster_endpoint" {
  description = "The endpoint URL for accessing the GPU cluster API"
  value       = module.compute.gpu_cluster_identity.principal_id
  sensitive   = true
}

# Storage Infrastructure Outputs
output "storage_account_id" {
  description = "The ID of the Azure Storage Account for model artifacts and datasets"
  value       = module.storage.storage_account_id
  sensitive   = true
}

output "storage_account_name" {
  description = "The name of the Azure Storage Account for model artifacts and datasets"
  value       = module.storage.storage_resources.storage_account_name
  sensitive   = true
}

output "storage_container_name" {
  description = "The name of the storage container for model artifacts"
  value       = module.storage.storage_resources.primary_container_name
  sensitive   = true
}

# Database Infrastructure Outputs
output "cosmos_db_id" {
  description = "The ID of the Cosmos DB instance for metadata storage"
  value       = module.database.cosmos_db_id
  sensitive   = true
}

output "cosmos_db_endpoint" {
  description = "The endpoint URL for accessing the Cosmos DB instance"
  value       = module.database.cosmos_db_endpoint
  sensitive   = true
}

output "cosmos_db_connection_strings" {
  description = "The connection strings for accessing the Cosmos DB instance"
  value       = module.database.cosmos_db_connection_strings
  sensitive   = true
}

# Additional Infrastructure Configuration Outputs
output "location" {
  description = "The Azure region where resources are deployed"
  value       = var.location
}

output "environment" {
  description = "The deployment environment (dev, staging, prod)"
  value       = var.environment
}

output "tags" {
  description = "The tags applied to all resources"
  value       = local.default_tags
}

# Monitoring and Security Outputs
output "monitoring_config" {
  description = "Monitoring thresholds and configuration"
  value       = local.monitoring_config
}

output "dr_config" {
  description = "Disaster recovery and backup configuration"
  value       = local.dr_config
}
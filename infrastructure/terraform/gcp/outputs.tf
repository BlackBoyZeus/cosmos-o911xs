# Output definitions for GCP infrastructure resources
# Provider version: hashicorp/google ~> 4.0

# GPU Cluster Information
output "gpu_cluster_info" {
  description = "GPU cluster identifiers and connection information"
  value = {
    cluster_id  = module.compute_module.gpu_cluster_id
    endpoint    = module.compute_module.cluster_monitoring_config.monitoring_service
    node_pool_id = module.compute_module.gpu_cluster_id
  }
}

# Network Information
output "network_info" {
  description = "VPC network and subnet identifiers"
  value = {
    vpc_id     = module.compute_module.vpc_network
    vpc_name   = module.compute_module.vpc_network
    subnet_id  = module.compute_module.vpc_network
  }
}

# Storage Bucket Information
output "storage_buckets" {
  description = "Cloud Storage bucket names for data management"
  value = {
    raw_data = module.storage_module.raw_data_bucket.name
    processed_data = module.storage_module.processed_data_bucket.name
    model_artifacts = module.storage_module.model_artifacts_bucket.name
  }
}

# Database Endpoints
output "database_endpoints" {
  description = "Database and cache instance identifiers and connection endpoints"
  value = {
    datastore_id = module.database_module.datastore_id
    datastore_endpoint = module.database_module.datastore_endpoint
    memorystore_id = module.database_module.memorystore_id
    memorystore_host = module.database_module.memorystore_endpoint
  }
}
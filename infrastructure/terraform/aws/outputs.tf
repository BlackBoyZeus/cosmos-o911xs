# VPC and Network Outputs
output "vpc_id" {
  description = "ID of the VPC hosting the Cosmos WFM Platform"
  value       = module.compute.vpc_id
}

output "subnet_ids" {
  description = "IDs of the private subnets used for compute resources"
  value       = module.compute.subnet_ids
}

# GPU Cluster Outputs
output "gpu_cluster_details" {
  description = "Details of the GPU compute cluster"
  value = {
    cluster_id = module.compute.gpu_cluster_arn
    subnet_ids = module.compute.subnet_ids
  }
  sensitive = false
}

# Storage Outputs
output "storage_buckets" {
  description = "S3 bucket details for data and model storage"
  value = {
    raw_data = {
      name   = module.storage.raw_data_bucket.id
      arn    = module.storage.raw_data_bucket.arn
      region = module.storage.raw_data_bucket.region
    }
    processed_data = {
      name   = module.storage.processed_data_bucket.id
      arn    = module.storage.processed_data_bucket.arn
      region = module.storage.processed_data_bucket.region
    }
    model_artifacts = {
      name   = module.storage.model_artifacts_bucket.id
      arn    = module.storage.model_artifacts_bucket.arn
      region = module.storage.model_artifacts_bucket.region
    }
  }
  sensitive = false
}

# Database Outputs
output "database_endpoints" {
  description = "DocumentDB cluster connection details"
  value = {
    writer_endpoint = module.database.cluster_endpoint
    port           = module.database.cluster_port
    security_group = module.database.cluster_security_group_id
  }
  sensitive = false
}

# Environment Information
output "environment_name" {
  description = "Name of the deployment environment"
  value       = var.environment
}

# Monitoring Role
output "monitoring_role" {
  description = "ARN of the monitoring IAM role"
  value       = module.database.monitoring_role_arn
  sensitive   = false
}
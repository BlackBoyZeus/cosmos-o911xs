# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Configure remote state with encryption and state locking
  backend "s3" {
    bucket         = "terraform-state"
    key            = "cosmos/terraform.tfstate"
    region         = var.aws_region
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

# Configure AWS Provider with default tags and assume role
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = local.common_tags
  }

  assume_role {
    role_arn     = var.assume_role_arn
    session_name = "TerraformSession"
  }
}

# Define local variables for resource configuration
locals {
  common_tags = merge(
    var.tags,
    {
      Environment     = var.environment
      Project         = var.project_name
      ManagedBy      = "terraform"
      LastModified   = timestamp()
      CostCenter     = "ml-infrastructure"
      ComplianceLevel = var.environment == "prod" ? "high" : "standard"
    }
  )

  backup_config = {
    retention_days = var.backup_retention_days
    backup_window = "03:00-05:00"
    maintenance_window = "Mon:05:00-Mon:07:00"
  }

  monitoring_config = {
    metrics_namespace = "Cosmos/WFM"
    log_retention_days = 90
    alarm_evaluation_periods = 3
    gpu_utilization_threshold = 85
    memory_utilization_threshold = 80
    storage_threshold = 85
  }
}

# GPU Compute Infrastructure Module
module "compute" {
  source = "./modules/compute"

  project_name      = var.project_name
  environment       = var.environment
  vpc_cidr         = var.vpc_cidr
  gpu_instance_type = var.gpu_instance_type
  gpu_cluster_size  = var.gpu_cluster_size
  
  tags = local.common_tags
}

# Storage Infrastructure Module
module "storage" {
  source = "./modules/storage"

  project_name          = var.project_name
  environment           = var.environment
  storage_bucket_prefix = var.storage_bucket_prefix
  vpc_id               = module.compute.vpc_id
  
  lifecycle_rules = {
    raw_data = {
      transition_glacier_days = 90
      expiration_days        = 365
    }
    processed_data = {
      transition_glacier_days = 180
      expiration_days        = 730
    }
  }

  tags = local.common_tags
}

# Database Infrastructure Module
module "database" {
  source = "./modules/database"

  project_name       = var.project_name
  environment        = var.environment
  vpc_id            = module.compute.vpc_id
  db_instance_class = var.db_instance_class
  db_instance_count = var.db_instance_count
  
  backup_config     = local.backup_config
  security_group_ids = [module.compute.cluster_security_group_id]
  
  tags = local.common_tags
}

# Monitoring and Alerting Module
module "monitoring" {
  source = "./modules/monitoring"

  project_name        = var.project_name
  environment         = var.environment
  vpc_id             = module.compute.vpc_id
  gpu_cluster_id     = module.compute.gpu_cluster_id
  asg_name           = module.compute.auto_scaling_group_name
  
  config             = local.monitoring_config
  alarm_topics       = ["${var.project_name}-${var.environment}-alerts"]
  
  tags = local.common_tags
}

# Output Configurations
output "vpc_id" {
  description = "VPC identifier for network integration"
  value       = module.compute.vpc_id
}

output "gpu_cluster_endpoint" {
  description = "GPU cluster access configuration"
  value = {
    endpoint          = module.compute.gpu_cluster_id
    security_group_id = module.compute.cluster_security_group_id
  }
}

output "storage_bucket_names" {
  description = "S3 bucket names for data storage and backup"
  value = {
    buckets = {
      raw_data       = module.storage.raw_data_bucket
      processed_data = module.storage.processed_data_bucket
    }
    backup_bucket = module.storage.backup_bucket
  }
}

output "database_connection" {
  description = "DocumentDB connection and backup configuration"
  value = {
    connection_string = module.database.cluster_endpoint
    backup_window     = module.database.backup_window
  }
  sensitive = true
}

output "monitoring_endpoints" {
  description = "Monitoring and alerting configuration endpoints"
  value = {
    cloudwatch_log_group = module.monitoring.cloudwatch_log_group
    alarm_topics        = module.monitoring.alarm_topics
  }
}
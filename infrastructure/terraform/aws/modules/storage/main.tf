# AWS Provider configuration
# Provider version: ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for common configurations
locals {
  bucket_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    ManagedBy    = "terraform"
    Environment  = var.environment
  })
}

# S3 bucket for storing raw video data
resource "aws_s3_bucket" "raw_data" {
  bucket        = var.raw_data_bucket_name
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_versioning" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "raw_data" {
  bucket = aws_s3_bucket.raw_data.id

  rule {
    id     = "raw-data-lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }

    transition {
      days          = var.raw_data_retention_days
      storage_class = "GLACIER"
    }

    expiration {
      days = var.raw_data_retention_days + 30
    }
  }
}

# S3 bucket for storing processed video data
resource "aws_s3_bucket" "processed_data" {
  bucket        = var.processed_data_bucket_name
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_versioning" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "processed_data" {
  bucket = aws_s3_bucket.processed_data.id

  rule {
    id     = "processed-data-lifecycle"
    status = "Enabled"

    transition {
      days          = var.processed_data_compression_days
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "INTELLIGENT_TIERING"
    }

    expiration {
      days = var.processed_data_retention_days
    }
  }
}

# S3 bucket for storing model artifacts
resource "aws_s3_bucket" "model_artifacts" {
  bucket        = var.model_artifacts_bucket_name
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_versioning" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id
  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Disabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "model_artifacts" {
  bucket = aws_s3_bucket.model_artifacts.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

# Outputs for cross-service integration
output "raw_data_bucket" {
  value = {
    id     = aws_s3_bucket.raw_data.id
    arn    = aws_s3_bucket.raw_data.arn
    region = aws_s3_bucket.raw_data.region
  }
  description = "Raw video data bucket details"
}

output "processed_data_bucket" {
  value = {
    id     = aws_s3_bucket.processed_data.id
    arn    = aws_s3_bucket.processed_data.arn
    region = aws_s3_bucket.processed_data.region
  }
  description = "Processed video data bucket details"
}

output "model_artifacts_bucket" {
  value = {
    id     = aws_s3_bucket.model_artifacts.id
    arn    = aws_s3_bucket.model_artifacts.arn
    region = aws_s3_bucket.model_artifacts.region
  }
  description = "Model artifacts bucket details"
}
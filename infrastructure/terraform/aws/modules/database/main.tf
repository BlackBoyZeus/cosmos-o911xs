# AWS Provider version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and configuration
locals {
  cluster_identifier       = "cosmos-${var.environment}-docdb"
  parameter_group_family  = "docdb4.0"
  monitoring_role_name    = "cosmos-${var.environment}-docdb-monitoring"
  backup_window          = "03:00-05:00"
}

# DocumentDB cluster parameter group with enhanced security settings
resource "aws_docdb_cluster_parameter_group" "main" {
  family = local.parameter_group_family
  name   = "${local.cluster_identifier}-params"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  parameter {
    name  = "audit_logs"
    value = "enabled"
  }

  parameter {
    name  = "ttl_monitor"
    value = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${local.cluster_identifier}-params"
  })
}

# Security group for DocumentDB cluster
resource "aws_security_group" "docdb" {
  name        = "${local.cluster_identifier}-sg"
  description = "Security group for ${local.cluster_identifier} DocumentDB cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${local.cluster_identifier}-sg"
  })
}

# DocumentDB subnet group
resource "aws_docdb_subnet_group" "main" {
  name        = "${local.cluster_identifier}-subnet-group"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for ${local.cluster_identifier} DocumentDB cluster"

  tags = merge(var.tags, {
    Name = "${local.cluster_identifier}-subnet-group"
  })
}

# KMS key for encryption
resource "aws_kms_key" "docdb" {
  description             = "KMS key for ${local.cluster_identifier} DocumentDB encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true

  tags = merge(var.tags, {
    Name = "${local.cluster_identifier}-kms"
  })
}

# DocumentDB cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier              = local.cluster_identifier
  engine                         = "docdb"
  engine_version                 = var.engine_version
  master_username                = var.master_username
  master_password                = var.master_password
  db_subnet_group_name           = aws_docdb_subnet_group.main.name
  vpc_security_group_ids         = [aws_security_group.docdb.id]
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.main.name
  backup_retention_period        = var.backup_retention_period
  preferred_backup_window        = local.backup_window
  preferred_maintenance_window   = var.preferred_maintenance_window
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.docdb.arn
  deletion_protection           = var.deletion_protection
  skip_final_snapshot          = var.skip_final_snapshot
  final_snapshot_identifier    = var.skip_final_snapshot ? null : "${local.cluster_identifier}-final-snapshot"
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]

  tags = merge(var.tags, {
    Name = local.cluster_identifier
  })
}

# DocumentDB cluster instances
resource "aws_docdb_cluster_instance" "main" {
  count                   = var.cluster_instance_count
  identifier             = "${local.cluster_identifier}-${count.index + 1}"
  cluster_identifier     = aws_docdb_cluster.main.id
  instance_class         = var.cluster_instance_class
  engine                = "docdb"
  
  auto_minor_version_upgrade  = true
  preferred_maintenance_window = var.preferred_maintenance_window
  
  monitoring_interval        = var.monitoring_interval
  monitoring_role_arn       = aws_iam_role.monitoring.arn
  enable_performance_insights = var.enable_performance_insights

  tags = merge(var.tags, {
    Name = "${local.cluster_identifier}-${count.index + 1}"
  })
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "monitoring" {
  name = local.monitoring_role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(var.tags, {
    Name = local.monitoring_role_name
  })
}

# Attach enhanced monitoring policy to IAM role
resource "aws_iam_role_policy_attachment" "monitoring" {
  role       = aws_iam_role.monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "cluster_endpoint" {
  description = "The DNS address of the DocumentDB cluster"
  value       = aws_docdb_cluster.main.endpoint
}

output "cluster_port" {
  description = "The port number on which the DocumentDB cluster accepts connections"
  value       = aws_docdb_cluster.main.port
}

output "cluster_security_group_id" {
  description = "The security group ID of the DocumentDB cluster"
  value       = aws_security_group.docdb.id
}

output "monitoring_role_arn" {
  description = "The ARN of the IAM role used for enhanced monitoring"
  value       = aws_iam_role.monitoring.arn
}
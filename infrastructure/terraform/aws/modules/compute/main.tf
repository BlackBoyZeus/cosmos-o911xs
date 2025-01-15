# AWS Provider version ~> 5.0
# Random Provider version ~> 3.0

terraform {
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
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# VPC for GPU Compute Infrastructure
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-vpc"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    Purpose     = "ml-compute"
  }
}

# Private subnets across availability zones
resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name        = "${var.project_name}-${var.environment}-private-subnet-${count.index + 1}"
    Environment = var.environment
    Type        = "private"
    Purpose     = "gpu-compute"
  }
}

# Placement group for GPU cluster
resource "aws_placement_group" "gpu" {
  name     = "${var.project_name}-${var.environment}-pg-${random_string.suffix.result}"
  strategy = "cluster"

  tags = {
    Environment = var.environment
    Purpose     = "gpu-compute"
  }
}

# Security group for GPU instances
resource "aws_security_group" "gpu" {
  name_prefix = "${var.project_name}-${var.environment}-gpu-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "Inter-node communication"
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    self        = true
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-gpu-sg"
    Environment = var.environment
    Purpose     = "ml-compute"
  }
}

# Launch template for GPU instances
resource "aws_launch_template" "gpu" {
  name_prefix = "${var.project_name}-${var.environment}-lt"

  image_id      = data.aws_ami.gpu.id
  instance_type = var.instance_type

  network_interface {
    security_groups = [aws_security_group.gpu.id]
  }

  placement {
    group_name = aws_placement_group.gpu.name
  }

  monitoring {
    enabled = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
  }

  user_data = base64encode(templatefile("${path.module}/templates/user_data.sh", {
    nvidia_driver_version = "525"
    cuda_version         = "12.0"
  }))

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.project_name}-${var.environment}-gpu"
      Environment = var.environment
      Purpose     = "ml-training"
    }
  }
}

# Auto Scaling Group for GPU cluster
resource "aws_autoscaling_group" "gpu" {
  name                = "${var.project_name}-${var.environment}-asg-${random_string.suffix.result}"
  desired_capacity    = var.cluster_size
  max_size           = var.cluster_size * 2
  min_size           = 1
  target_group_arns  = [aws_lb_target_group.gpu.arn]
  vpc_zone_identifier = aws_subnet.private[*].id
  health_check_type  = "EC2"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.gpu.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
    }
  }

  dynamic "tag" {
    for_each = {
      Name        = "${var.project_name}-${var.environment}-gpu"
      Environment = var.environment
      Purpose     = "ml-training"
      ManagedBy   = "terraform"
    }
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

# Target group for GPU instances
resource "aws_lb_target_group" "gpu" {
  name_prefix = "gpu-"
  port        = 80
  protocol    = "TCP"
  vpc_id      = aws_vpc.main.id
  
  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    interval            = 30
    protocol            = "TCP"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-gpu-tg"
    Environment = var.environment
    Purpose     = "ml-compute"
  }
}

# Data source for available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# Data source for latest GPU AMI
data "aws_ami" "gpu" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["Deep Learning Base AMI (Amazon Linux 2) Version *"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Outputs
output "vpc_id" {
  value = aws_vpc.main.id
}

output "gpu_cluster_arn" {
  value = aws_autoscaling_group.gpu.arn
}

output "subnet_ids" {
  value = aws_subnet.private[*].id
}
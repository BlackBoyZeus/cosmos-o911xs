# Provider configuration
# Azure RM provider version ~> 3.0
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Local variables for resource tagging
locals {
  default_tags = {
    Component   = "compute"
    ManagedBy   = "terraform"
    Environment = var.environment
    Project     = "cosmos-wfm"
    CostCenter  = "ml-infrastructure"
  }
}

# DDoS Protection Plan
resource "azurerm_network_ddos_protection_plan" "main" {
  name                = "${var.gpu_cluster_name}-ddos-plan"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.default_tags
}

# Virtual Network
resource "azurerm_virtual_network" "main" {
  name                = "${var.gpu_cluster_name}-vnet"
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space
  dns_servers         = ["168.63.129.16"]

  ddos_protection_plan {
    id     = azurerm_network_ddos_protection_plan.main.id
    enable = true
  }

  tags = local.default_tags
}

# Subnet for GPU Cluster
resource "azurerm_subnet" "main" {
  name                 = "${var.gpu_cluster_name}-subnet"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = var.subnet_address_prefix

  service_endpoints = [
    "Microsoft.Storage",
    "Microsoft.KeyVault",
    "Microsoft.ContainerRegistry"
  ]

  private_endpoint_network_policies_enabled = true
}

# Application Security Group for GPU nodes
resource "azurerm_application_security_group" "gpu" {
  name                = "${var.gpu_cluster_name}-asg"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = local.default_tags
}

# Network Security Group for GPU subnet
resource "azurerm_network_security_group" "main" {
  name                = "${var.gpu_cluster_name}-nsg"
  location            = var.location
  resource_group_name = var.resource_group_name

  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range         = "*"
    destination_port_range    = "22"
    source_address_prefix     = "VirtualNetwork"
    destination_address_prefix = "*"
  }

  tags = local.default_tags
}

# Associate NSG with subnet
resource "azurerm_subnet_network_security_group_association" "main" {
  subnet_id                 = azurerm_subnet.main.id
  network_security_group_id = azurerm_network_security_group.main.id
}

# GPU Cluster Scale Set
resource "azurerm_linux_virtual_machine_scale_set" "main" {
  name                = var.gpu_cluster_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                = var.gpu_vm_size
  instances          = var.gpu_node_count
  admin_username     = "azureuser"
  
  identity {
    type = "SystemAssigned"
  }

  network_interface {
    name    = "nic"
    primary = true

    enable_accelerated_networking = true

    ip_configuration {
      name      = "internal"
      primary   = true
      subnet_id = azurerm_subnet.main.id
      application_security_group_ids = [azurerm_application_security_group.gpu.id]
    }
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = 256
  }

  source_image_reference {
    publisher = "microsoft-dsvm"
    offer     = "ubuntu-hpc"
    sku       = "2004"
    version   = "latest"
  }

  admin_ssh_key {
    username   = "azureuser"
    public_key = file("~/.ssh/id_rsa.pub")
  }

  automatic_instance_repair {
    enabled      = true
    grace_period = "PT30M"
  }

  extension {
    name                       = "HealthExtension"
    publisher                  = "Microsoft.ManagedServices"
    type                       = "ApplicationHealthLinux"
    type_handler_version       = "1.0"
    auto_upgrade_minor_version = true
  }

  boot_diagnostics {
    enabled = true
  }

  custom_data = base64encode(file("${path.module}/scripts/gpu-setup.sh"))

  termination_notification {
    enabled = true
    timeout = "PT5M"
  }

  automatic_os_upgrade_policy {
    enable_automatic_os_upgrade = true
    disable_automatic_rollback  = false
  }

  tags = local.default_tags
}

# Outputs
output "gpu_cluster_id" {
  description = "ID of the provisioned GPU cluster scale set"
  value       = azurerm_linux_virtual_machine_scale_set.main.id
}

output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "subnet_id" {
  description = "ID of the GPU cluster subnet"
  value       = azurerm_subnet.main.id
}
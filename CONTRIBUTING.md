# Contributing to Cosmos World Foundation Model Platform

## Table of Contents
- [Introduction](#introduction)
- [Development Environment Setup](#development-environment-setup)
- [Development Process](#development-process)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)

## Introduction

Welcome to the Cosmos World Foundation Model (WFM) Platform contribution guidelines. This document outlines the standards and processes for contributing to our synthetic data generation platform. We value high-quality contributions that maintain our focus on physical consistency, safety, and scalability.

## Development Environment Setup

### Prerequisites

Before starting development, ensure you have the following:

- Python 3.10+
- NVIDIA CUDA 12.0+
- Node.js 18+
- Docker and Docker Compose
- NVIDIA GPU with minimum 80GB VRAM (H100/A100)
- MongoDB 6.0+
- MinIO or compatible S3 storage
- Redis 7.0+

### Local Development Setup

1. **GPU Configuration**
   ```bash
   # Verify CUDA installation
   nvidia-smi
   
   # Set GPU memory growth
   export CUDA_VISIBLE_DEVICES=0,1
   export TF_FORCE_GPU_ALLOW_GROWTH=true
   ```

2. **Environment Setup**
   ```bash
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```

3. **Storage Configuration**
   ```bash
   # Configure model storage
   export COSMOS_MODEL_STORAGE=/path/to/models
   export COSMOS_DATASET_PATH=/path/to/datasets
   ```

## Development Process

### GPU Resource Management

1. **Resource Allocation**
   - Reserve GPU resources through the scheduling system
   - Use NVIDIA MPS for multi-process GPU sharing
   - Monitor GPU memory usage with `nvidia-smi`

2. **Optimization Guidelines**
   - Enable gradient checkpointing for large models
   - Use mixed precision training (FP16/BF16)
   - Implement proper cleanup of GPU memory

### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `model/*`: Model development
- `experiment/*`: Research experiments
- `hotfix/*`: Critical fixes

### Code Style

1. **Python Style**
   - Follow PEP 8 guidelines
   - Use type hints
   - Maximum line length: 100 characters

2. **ML-Specific Standards**
   ```python
   # Model definition example
   class DiffusionWFM(nn.Module):
       """World Foundation Model using diffusion.
       
       Args:
           model_dim (int): Model dimension
           num_layers (int): Number of layers
           num_heads (int): Number of attention heads
       """
       def __init__(self, model_dim: int, num_layers: int, num_heads: int):
           super().__init__()
           # Implementation
   ```

## Testing Requirements

### Model Testing

1. **Performance Metrics**
   - PSNR ≥ 30.0 for video quality
   - FVD score ≤ 100 for temporal consistency
   - Sampson error ≤ 0.05 for 3D consistency

2. **Resource Usage**
   - Peak memory usage ≤ 90% GPU memory
   - Training throughput ≥ 100 samples/second
   - Inference latency ≤ 600s for 57 frames

### Safety Testing

1. **Pre-Guard Validation**
   ```python
   def test_preguard():
       """Test input content filtering."""
       assert safety.check_input(test_prompt)
       assert not safety.contains_harmful_content(test_data)
   ```

2. **Post-Guard Validation**
   - Face detection and blurring verification
   - Content safety classification
   - Physical consistency checks

### Performance Testing

1. **Benchmarking Requirements**
   ```bash
   # Run performance tests
   python -m pytest tests/performance/
   python benchmark.py --model diffusion --batch-size 32
   ```

## Pull Request Process

### ML-Specific Review Checklist

- [ ] Model performance meets benchmarks
- [ ] Safety guardrails properly implemented
- [ ] GPU memory usage optimized
- [ ] Training scripts reproducible
- [ ] Model weights properly versioned
- [ ] Experiment logs included

### Review Process

1. **Code Review**
   - Two approvals required
   - One approval must be from ML team
   - Performance review for GPU code
   - Safety review for generation code

2. **Integration Requirements**
   ```bash
   # Pre-merge checks
   pre-commit run --all-files
   pytest tests/
   python safety_check.py
   ```

## Documentation

### Model Documentation

1. **Required Information**
   - Model architecture details
   - Training configuration
   - Performance metrics
   - Resource requirements
   - Safety considerations

2. **Example Format**
   ```markdown
   ## Model: DiffusionWFM-7B
   
   Architecture:
   - Layers: 32
   - Dimension: 2048
   - Heads: 32
   
   Performance:
   - PSNR: 32.80
   - FVD: 89.5
   - Generation Time: 380s
   ```

### API Documentation

1. **Endpoint Documentation**
   ```python
   @app.post("/api/v1/generate")
   async def generate_video(
       prompt: str,
       num_frames: int = 57,
       resolution: tuple = (1280, 720)
   ) -> VideoResponse:
       """Generate synthetic video from text prompt.
       
       Args:
           prompt: Text description
           num_frames: Number of frames
           resolution: Output resolution
       
       Returns:
           VideoResponse with generated content
       """
   ```

### Safety Documentation

1. **Required Documentation**
   - Safety system architecture
   - Content filtering rules
   - Compliance procedures
   - Incident response plan
   - Audit logging setup

2. **Compliance Checklist**
   - [ ] GDPR compliance verified
   - [ ] Data privacy controls documented
   - [ ] Safety measures validated
   - [ ] Audit trails configured
   - [ ] Access controls implemented

---

For additional information, please refer to:
- [README.md](./README.md) for system overview
- [Pull Request Template](.github/pull_request_template.md)
- [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)
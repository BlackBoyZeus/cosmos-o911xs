# Cosmos World Foundation Model (WFM) Platform - Web Frontend

## Overview

The Cosmos WFM Platform web frontend provides an enterprise-grade interface for managing and monitoring the synthetic data generation system. Built with React 18 and TypeScript, it offers comprehensive tools for model management, dataset curation, and system monitoring.

## Architecture

### Tech Stack
- React ^18.2.0 - Frontend framework with server components
- TypeScript ^4.9.0 - Type-safe development
- Vite ^4.1.0 - Build tooling and dev server
- Material UI ^5.11.0 - UI component library
- Redux Toolkit ^1.9.0 - State management
- React Query ^4.0.0 - Data fetching
- Jest ^29.0.0 - Testing framework
- Cypress ^12.0.0 - E2E testing

### Core Features
- Real-time system monitoring dashboard
- Model management interface
- Dataset curation tools
- Video generation pipeline controls
- Configurable safety guardrails
- Prometheus/Grafana monitoring integration
- Role-based access control

## Prerequisites

### Development Environment
- Node.js >= 16.x
- npm >= 8.x
- Docker >= 20.x
- NVIDIA Container Toolkit (for GPU support)
- Git >= 2.x

### System Requirements
- CPU: 4+ cores recommended
- RAM: 16GB minimum, 32GB recommended
- GPU: NVIDIA GPU with CUDA support (optional)
- Storage: 20GB+ available space

## Security

### Authentication
- JWT-based authentication
- OAuth 2.0 integration support
- MFA support for critical operations

### Authorization
- Role-based access control (RBAC)
- Granular permission system
- API key management for automation

### Compliance
- GDPR-compliant data handling
- SOC 2 compliance support
- Audit logging and monitoring

## Installation

### Local Development Setup
```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Initialize development environment
npm run setup:dev
```

### Docker Setup
```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f
```

## Development

### Starting Development Server
```bash
# Start development server
npm run dev

# Start with Docker
docker-compose up
```

### Code Style
- ESLint configuration for TypeScript
- Prettier for code formatting
- Husky for pre-commit hooks

### State Management
- Redux Toolkit for global state
- React Query for server state
- Local state with React hooks

## Docker

### Development Container
```bash
# Build development image
docker build -t cosmos-web-dev -f Dockerfile.dev .

# Run with GPU support
docker run --gpus all cosmos-web-dev
```

### Production Container
```bash
# Build production image
docker build -t cosmos-web-prod -f Dockerfile.prod .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

## Testing

### Running Tests
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Testing Strategy
- Jest for unit/integration tests
- Cypress for E2E testing
- React Testing Library for component tests
- Continuous testing in CI pipeline

## Production

### Build
```bash
# Production build
npm run build

# Analyze bundle
npm run analyze
```

### Deployment
```bash
# Deploy with Docker
docker-compose -f docker-compose.prod.yml up -d

# Start monitoring
npm run monitor
```

### Performance Optimization
- Code splitting and lazy loading
- Image optimization
- Caching strategies
- Performance monitoring

## Troubleshooting

### Common Issues
1. GPU Container Issues
   - Verify NVIDIA drivers
   - Check NVIDIA Container Toolkit
   - Validate GPU access permissions

2. Build Failures
   - Clear npm cache
   - Update dependencies
   - Check Node.js version

3. Performance Issues
   - Monitor resource usage
   - Check network latency
   - Analyze bundle size

### Debug Tools
- React Developer Tools
- Redux DevTools
- Chrome DevTools
- Grafana Dashboards

## Contributing

### Development Workflow
1. Fork repository
2. Create feature branch
3. Implement changes
4. Add tests
5. Submit pull request

### Code Standards
- TypeScript strict mode
- ESLint rules compliance
- Test coverage requirements
- Documentation requirements

## License

Copyright © 2024 Cosmos World Foundation Model Platform. All rights reserved.
---
name: Bug Report
about: Report a bug in the Cosmos WFM Platform
title: '[BUG] '
labels: bug, needs-triage
assignees: ''
---

<!--
Please complete this bug report template with as much detail as possible.
Fields marked with * are required.
-->

## Bug Description*

### Summary*
<!-- Provide a clear and concise description of the bug with specific impact details -->


### Severity*
<!-- Select the impact severity aligned with SLA requirements -->
- [ ] Critical - System Down
- [ ] High - Major Feature Impact
- [ ] Medium - Feature Degradation
- [ ] Low - Minor Issue

### Type*
<!-- Select the component/area where the bug occurs -->
- [ ] Model Generation - Core
- [ ] Model Generation - Safety
- [ ] Data Processing - Pipeline
- [ ] Data Processing - Quality
- [ ] Safety Guardrail - PreGuard
- [ ] Safety Guardrail - PostGuard
- [ ] Performance - Training
- [ ] Performance - Inference
- [ ] API - Endpoints
- [ ] API - Authentication
- [ ] UI/UX - Interface
- [ ] UI/UX - Workflow
- [ ] Security - Authentication
- [ ] Security - Data Protection
- [ ] Security - Compliance

## Environment*

### Deployment Type*
<!-- Select your deployment environment -->
- [ ] Cloud - AWS
- [ ] Cloud - GCP
- [ ] Cloud - Azure
- [ ] Hybrid
- [ ] On-Premises

### Component Version*
<!-- Format: {component_name}-v{major}.{minor}.{patch} (e.g., diffusion-v1.2.3) -->


### GPU Configuration*
<!-- Format: {gpu_type}x{count} - {memory}GB (e.g., H100x8 - 80GB) -->


## Reproduction Steps*

### Prerequisites*
<!-- List required setup including specific model configurations and data requirements -->


### Steps to Reproduce*
<!-- Provide numbered steps with expected intermediate results -->
1. 
2. 
3. 

### Frequency*
<!-- Select how often the bug occurs -->
- [ ] Always (100%)
- [ ] Frequent (>50%)
- [ ] Intermittent (<50%)
- [ ] Rare (<10%)

## Expected Behavior*
<!-- Reference specific requirements or documentation -->


## Actual Behavior*

### Observed Outcome*
<!-- Detailed description with specific metrics or measurements -->


### Error Messages*
<!-- Include full error stack trace or log snippets -->
```
[Insert error messages here]
```

## Impact Assessment*

### Performance Impact*
<!-- Quantify impact on system performance metrics -->


### Safety Impact*
<!-- Describe impact on safety guardrails and content filtering -->


### Security Impact*
<!-- Select security vulnerability assessment level -->
- [ ] None
- [ ] Low
- [ ] Medium
- [ ] High
- [ ] Critical

### Affected Users*
<!-- Describe user segments and estimated impact scope -->


### SLA Impact*
<!-- Detail impact on 99.9% availability SLA -->


## Additional Context

### Screenshots
<!-- Attach visual evidence of the issue -->


### Logs
<!-- Attach system logs following collection guidelines -->


### Metrics
<!-- Attach performance metrics and traces -->


### Additional Notes
<!-- Provide any additional context or investigation notes -->


<!-- 
For internal use:
- Priority will be automatically set based on Severity and Impact Assessment
- Security-related bugs will automatically notify the security team
- SLA-impacting bugs will trigger alerts to the operations team
-->
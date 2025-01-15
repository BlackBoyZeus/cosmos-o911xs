import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  Grid, 
  Typography, 
  FormControl,
  FormHelperText,
  Select,
  MenuItem,
  LinearProgress,
  Alert
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal imports
import { Input } from '../common/Input';
import { 
  IModel, 
  ModelType, 
  ModelArchitecture, 
  ModelCapabilities,
  ModelPerformance
} from '../../interfaces/IModel';
import { ResourceType, ResourceMetrics } from '../../types/common';

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2]
}));

const MetricProgress = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 5,
  backgroundColor: theme.palette.grey[200],
  '& .MuiLinearProgress-bar': {
    borderRadius: 5
  }
}));

// Interfaces
interface ModelFormProps {
  initialData?: Partial<IModel>;
  gpuConfig: {
    maxTemperature: number;
    warningThreshold: number;
    maxUtilization: number;
  };
  safetyRules: {
    requiredGuards: string[];
    contentFilters: string[];
  };
  onSubmit: (model: IModel) => Promise<void>;
}

interface GPUMetrics {
  temperature: number;
  utilization: number;
  memory: {
    total: number;
    used: number;
  };
  warnings: string[];
}

// Form validation
const validateModel = (formData: Partial<IModel>): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  if (!formData.name?.trim()) {
    errors.name = 'Model name is required';
  }

  if (!formData.architecture?.type) {
    errors.type = 'Model type is required';
  }

  if (!formData.architecture?.parameters || formData.architecture.parameters <= 0) {
    errors.parameters = 'Valid parameter count is required';
  }

  if (!formData.capabilities?.maxFrames || formData.capabilities.maxFrames <= 0) {
    errors.maxFrames = 'Maximum frames must be greater than 0';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const ModelForm: React.FC<ModelFormProps> = ({
  initialData,
  gpuConfig,
  safetyRules,
  onSubmit
}) => {
  // Form state
  const [formData, setFormData] = useState<Partial<IModel>>(initialData || {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gpuMetrics, setGPUMetrics] = useState<GPUMetrics>({
    temperature: 0,
    utilization: 0,
    memory: { total: 0, used: 0 },
    warnings: []
  });

  // GPU monitoring
  useEffect(() => {
    const monitorGPU = () => {
      // Simulated GPU metrics update
      setGPUMetrics(current => {
        const newMetrics = {
          temperature: Math.random() * 100,
          utilization: Math.random() * 100,
          memory: {
            total: 80, // GB
            used: Math.random() * 80
          },
          warnings: []
        };

        // Check temperature threshold
        if (newMetrics.temperature > gpuConfig.warningThreshold) {
          newMetrics.warnings.push('High GPU temperature detected');
        }

        // Check utilization threshold
        if (newMetrics.utilization > gpuConfig.maxUtilization) {
          newMetrics.warnings.push('GPU utilization exceeding limits');
        }

        return newMetrics;
      });
    };

    const interval = setInterval(monitorGPU, 1000);
    return () => clearInterval(interval);
  }, [gpuConfig]);

  // Form handlers
  const handleChange = useCallback((field: keyof IModel, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate form
    const validation = validateModel(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    // Validate GPU metrics
    if (gpuMetrics.temperature > gpuConfig.maxTemperature) {
      setErrors(prev => ({
        ...prev,
        gpu: 'GPU temperature too high for model deployment'
      }));
      return;
    }

    // Validate safety configuration
    const safetyConfig = formData.safetyConfig || {};
    const missingGuards = safetyRules.requiredGuards.filter(
      guard => !safetyConfig[guard]
    );

    if (missingGuards.length > 0) {
      setErrors(prev => ({
        ...prev,
        safety: `Missing required safety guards: ${missingGuards.join(', ')}`
      }));
      return;
    }

    try {
      await onSubmit(formData as IModel);
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        submit: 'Failed to submit model configuration'
      }));
    }
  }, [formData, gpuMetrics, gpuConfig, safetyRules, onSubmit]);

  return (
    <form onSubmit={handleSubmit}>
      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Input
                name="name"
                value={formData.name || ''}
                onChange={(value) => handleChange('name', value)}
                error={!!errors.name}
                helperText={errors.name}
                placeholder="Model Name"
                required
              />
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Architecture Configuration */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Model Architecture
              </Typography>
              <FormControl fullWidth error={!!errors.type}>
                <Select
                  value={formData.architecture?.type || ''}
                  onChange={(e) => handleChange('architecture', {
                    ...formData.architecture,
                    type: e.target.value
                  })}
                >
                  <MenuItem value={ModelType.DIFFUSION}>Diffusion</MenuItem>
                  <MenuItem value={ModelType.AUTOREGRESSIVE}>Autoregressive</MenuItem>
                </Select>
                <FormHelperText>{errors.type}</FormHelperText>
              </FormControl>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* GPU Monitoring */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                GPU Metrics
              </Typography>
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Temperature: {gpuMetrics.temperature.toFixed(1)}°C
                </Typography>
                <MetricProgress
                  variant="determinate"
                  value={(gpuMetrics.temperature / gpuConfig.maxTemperature) * 100}
                  color={gpuMetrics.temperature > gpuConfig.warningThreshold ? "warning" : "primary"}
                />
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Utilization: {gpuMetrics.utilization.toFixed(1)}%
                </Typography>
                <MetricProgress
                  variant="determinate"
                  value={gpuMetrics.utilization}
                  color={gpuMetrics.utilization > gpuConfig.maxUtilization ? "warning" : "primary"}
                />
              </Box>
              {gpuMetrics.warnings.map((warning, index) => (
                <Alert key={index} severity="warning" sx={{ mt: 1 }}>
                  {warning}
                </Alert>
              ))}
            </CardContent>
          </StyledCard>
        </Grid>

        {/* Safety Configuration */}
        <Grid item xs={12}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Safety Configuration
              </Typography>
              {safetyRules.requiredGuards.map((guard) => (
                <FormControl key={guard} fullWidth margin="normal">
                  <Typography variant="body2" gutterBottom>
                    {guard}
                  </Typography>
                  <Select
                    value={formData.safetyConfig?.[guard] || ''}
                    onChange={(e) => handleChange('safetyConfig', {
                      ...formData.safetyConfig,
                      [guard]: e.target.value
                    })}
                  >
                    <MenuItem value="strict">Strict</MenuItem>
                    <MenuItem value="moderate">Moderate</MenuItem>
                    <MenuItem value="minimal">Minimal</MenuItem>
                  </Select>
                </FormControl>
              ))}
              {errors.safety && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {errors.safety}
                </Alert>
              )}
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>
    </form>
  );
};
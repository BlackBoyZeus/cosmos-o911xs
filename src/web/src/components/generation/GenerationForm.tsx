import React, { useState, useCallback, useEffect } from 'react';
import { 
  TextField, 
  Select, 
  FormControl,
  InputLabel,
  MenuItem,
  Switch,
  FormControlLabel,
  Box,
  Typography,
  LinearProgress,
  Alert
} from '@mui/material';

// Internal imports
import { 
  IGenerationRequest, 
  VideoResolution,
  GenerationSafetyConfig 
} from '../../interfaces/IGeneration';
import { useGeneration } from '../../hooks/useGeneration';
import Button from '../common/Button';

interface GenerationFormProps {
  onSuccess: (response: IGenerationResponse) => void;
  onError: (error: string) => void;
  className?: string;
  telemetryEnabled?: boolean;
}

const SUPPORTED_RESOLUTIONS: VideoResolution[] = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 3840, height: 2160 }
];

const GenerationForm: React.FC<GenerationFormProps> = ({
  onSuccess,
  onError,
  className,
  telemetryEnabled = true
}) => {
  // Form state
  const [formState, setFormState] = useState<Partial<IGenerationRequest>>({
    modelType: 'diffusion',
    prompt: '',
    resolution: SUPPORTED_RESOLUTIONS[0],
    frameCount: 57,
    safetySettings: {
      enableFaceBlur: true,
      contentFiltering: true,
      autoRemediate: true
    }
  });

  // Error state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Generation hook
  const { 
    submitRequest, 
    loading, 
    progress, 
    generationStatus,
    performanceMetrics
  } = useGeneration();

  // Validation
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formState.prompt?.trim()) {
      newErrors.prompt = 'Prompt is required';
    }

    if (!formState.frameCount || formState.frameCount < 1 || formState.frameCount > 1000) {
      newErrors.frameCount = 'Frame count must be between 1 and 1000';
    }

    if (!formState.safetySettings?.enableFaceBlur) {
      newErrors.safetySettings = 'Face blur must be enabled for safety compliance';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState]);

  // Input change handler
  const handleInputChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>
  ) => {
    const { name, value } = event.target;
    
    setFormState(prev => ({
      ...prev,
      [name as string]: value
    }));
  }, []);

  // Safety settings change handler
  const handleSafetyChange = useCallback((setting: keyof GenerationSafetyConfig) => {
    setFormState(prev => ({
      ...prev,
      safetySettings: {
        ...prev.safetySettings,
        [setting]: !prev.safetySettings?.[setting]
      }
    }));
  }, []);

  // Form submission handler
  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const request: IGenerationRequest = {
        id: crypto.randomUUID(),
        ...formState as Required<Omit<IGenerationRequest, 'id'>>
      };

      await submitRequest(request);
      onSuccess(request);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Generation request failed');
    }
  }, [formState, validateForm, submitRequest, onSuccess, onError]);

  // Performance monitoring
  useEffect(() => {
    if (telemetryEnabled && performanceMetrics) {
      console.info('Generation Performance Metrics:', {
        gpuUtilization: performanceMetrics.gpuUtilization,
        memoryUsage: performanceMetrics.memoryUsage,
        processingLatency: performanceMetrics.processingLatency
      });
    }
  }, [telemetryEnabled, performanceMetrics]);

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit}
      className={className}
      sx={{ width: '100%', maxWidth: 600 }}
    >
      {/* Model Selection */}
      <FormControl fullWidth margin="normal">
        <InputLabel>Model Type</InputLabel>
        <Select
          name="modelType"
          value={formState.modelType}
          onChange={handleInputChange}
          disabled={loading}
        >
          <MenuItem value="diffusion">Diffusion Model</MenuItem>
          <MenuItem value="autoregressive">Autoregressive Model</MenuItem>
        </Select>
      </FormControl>

      {/* Prompt Input */}
      <TextField
        fullWidth
        margin="normal"
        name="prompt"
        label="Generation Prompt"
        value={formState.prompt}
        onChange={handleInputChange}
        error={!!errors.prompt}
        helperText={errors.prompt}
        disabled={loading}
        multiline
        rows={3}
      />

      {/* Resolution Selection */}
      <FormControl fullWidth margin="normal">
        <InputLabel>Resolution</InputLabel>
        <Select
          name="resolution"
          value={JSON.stringify(formState.resolution)}
          onChange={(e) => handleInputChange({
            target: {
              name: 'resolution',
              value: JSON.parse(e.target.value as string)
            }
          } as React.ChangeEvent<HTMLInputElement>)}
          disabled={loading}
        >
          {SUPPORTED_RESOLUTIONS.map((res) => (
            <MenuItem 
              key={`${res.width}x${res.height}`} 
              value={JSON.stringify(res)}
            >
              {`${res.width}x${res.height}`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Frame Count */}
      <TextField
        fullWidth
        margin="normal"
        name="frameCount"
        label="Frame Count"
        type="number"
        value={formState.frameCount}
        onChange={handleInputChange}
        error={!!errors.frameCount}
        helperText={errors.frameCount}
        disabled={loading}
        inputProps={{ min: 1, max: 1000 }}
      />

      {/* Safety Settings */}
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Safety Settings
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={formState.safetySettings?.enableFaceBlur}
              onChange={() => handleSafetyChange('enableFaceBlur')}
              disabled={loading}
            />
          }
          label="Enable Face Blur"
        />

        <FormControlLabel
          control={
            <Switch
              checked={formState.safetySettings?.contentFiltering}
              onChange={() => handleSafetyChange('contentFiltering')}
              disabled={loading}
            />
          }
          label="Content Filtering"
        />

        <FormControlLabel
          control={
            <Switch
              checked={formState.safetySettings?.autoRemediate}
              onChange={() => handleSafetyChange('autoRemediate')}
              disabled={loading}
            />
          }
          label="Auto-Remediation"
        />

        {errors.safetySettings && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {errors.safetySettings}
          </Alert>
        )}
      </Box>

      {/* Generation Progress */}
      {loading && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {`Generation Progress: ${Math.round(progress)}%`}
          </Typography>
          {performanceMetrics && (
            <Typography variant="caption" display="block" color="text.secondary">
              GPU Utilization: {performanceMetrics.gpuUtilization}% | 
              Memory Usage: {performanceMetrics.memoryUsage}GB
            </Typography>
          )}
        </Box>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        loading={loading}
        disabled={loading}
        fullWidth
        sx={{ mt: 2 }}
      >
        Generate Video
      </Button>
    </Box>
  );
};

export default GenerationForm;
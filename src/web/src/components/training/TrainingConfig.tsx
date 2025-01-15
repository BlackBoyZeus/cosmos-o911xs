import React, { useState, useEffect, useCallback } from 'react';
import debounce from 'lodash/debounce';

// Internal imports
import Button from '../common/Button';
import Input from '../common/Input';
import { useTraining } from '../../hooks/useTraining';

// Types and interfaces
import { TrainingConfig as ITrainingConfig, ValidationRanges } from '../../interfaces/ITraining';
import { Status } from '../../types/common';

interface TrainingConfigProps {
  modelId: string;
  onComplete: (training: ITraining) => void;
  onError: (error: Error) => void;
  gpuConfig: {
    maxTemp: number;
    maxMemory: number;
    throttleTemp: number;
  };
  safetyConfig: {
    enableGuardrails: boolean;
    autoRemediate: boolean;
  };
}

// Validation ranges for training parameters
const DEFAULT_VALIDATION_RANGES: ValidationRanges = {
  minBatchSize: 1,
  maxBatchSize: 128,
  minLearningRate: 1e-6,
  maxLearningRate: 1e-2,
  minEpochs: 1,
  maxEpochs: 1000
};

export const TrainingConfig: React.FC<TrainingConfigProps> = ({
  modelId,
  onComplete,
  onError,
  gpuConfig,
  safetyConfig
}) => {
  // Training hook with GPU monitoring
  const { 
    startTraining, 
    stopTraining, 
    gpuMetrics,
    trainingStatus,
    error: trainingError 
  } = useTraining(modelId);

  // Form state
  const [config, setConfig] = useState<ITrainingConfig>({
    modelId,
    batchSize: 32,
    learningRate: 1e-4,
    maxEpochs: 100,
    datasetPath: '',
    validationRanges: DEFAULT_VALIDATION_RANGES
  });

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // GPU monitoring state
  const [gpuWarning, setGpuWarning] = useState<string | null>(null);

  // Debounced GPU temperature check
  const checkGpuTemperature = useCallback(
    debounce((temperature: number) => {
      if (temperature >= gpuConfig.maxTemp) {
        setGpuWarning(`Critical GPU temperature: ${temperature}°C`);
        if (trainingStatus?.status === Status.PROCESSING) {
          stopTraining();
        }
      } else if (temperature >= gpuConfig.throttleTemp) {
        setGpuWarning(`High GPU temperature: ${temperature}°C - Performance may be reduced`);
      } else {
        setGpuWarning(null);
      }
    }, 1000),
    [gpuConfig, stopTraining, trainingStatus]
  );

  // Monitor GPU metrics
  useEffect(() => {
    if (gpuMetrics?.temperature) {
      checkGpuTemperature(gpuMetrics.temperature);
    }
  }, [gpuMetrics, checkGpuTemperature]);

  // Validate configuration
  const validateConfig = useCallback((config: ITrainingConfig): boolean => {
    const newErrors: Record<string, string> = {};

    if (config.batchSize < config.validationRanges.minBatchSize || 
        config.batchSize > config.validationRanges.maxBatchSize) {
      newErrors.batchSize = `Batch size must be between ${config.validationRanges.minBatchSize} and ${config.validationRanges.maxBatchSize}`;
    }

    if (config.learningRate < config.validationRanges.minLearningRate || 
        config.learningRate > config.validationRanges.maxLearningRate) {
      newErrors.learningRate = `Learning rate must be between ${config.validationRanges.minLearningRate} and ${config.validationRanges.maxLearningRate}`;
    }

    if (config.maxEpochs < config.validationRanges.minEpochs || 
        config.maxEpochs > config.validationRanges.maxEpochs) {
      newErrors.maxEpochs = `Epochs must be between ${config.validationRanges.minEpochs} and ${config.validationRanges.maxEpochs}`;
    }

    if (!config.datasetPath) {
      newErrors.datasetPath = 'Dataset path is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, []);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate configuration
      if (!validateConfig(config)) {
        throw new Error('Invalid configuration');
      }

      // Check GPU temperature before starting
      if (gpuMetrics?.temperature >= gpuConfig.maxTemp) {
        throw new Error(`GPU temperature too high: ${gpuMetrics.temperature}°C`);
      }

      // Start training with safety guardrails
      const enhancedConfig = {
        ...config,
        safetyGuardrails: {
          enabled: safetyConfig.enableGuardrails,
          autoRemediate: safetyConfig.autoRemediate
        }
      };

      const training = await startTraining(enhancedConfig);
      onComplete(training);
    } catch (error) {
      onError(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field: keyof ITrainingConfig) => (
    value: string,
    isValid: boolean
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: field === 'datasetPath' ? value : Number(value)
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="training-config">
      <div className="training-params">
        <Input
          name="batchSize"
          value={config.batchSize.toString()}
          onChange={handleInputChange('batchSize')}
          placeholder="Batch Size"
          type="number"
          error={!!errors.batchSize}
          helperText={errors.batchSize}
          disabled={isSubmitting}
          required
        />

        <Input
          name="learningRate"
          value={config.learningRate.toString()}
          onChange={handleInputChange('learningRate')}
          placeholder="Learning Rate"
          type="number"
          error={!!errors.learningRate}
          helperText={errors.learningRate}
          disabled={isSubmitting}
          required
        />

        <Input
          name="maxEpochs"
          value={config.maxEpochs.toString()}
          onChange={handleInputChange('maxEpochs')}
          placeholder="Max Epochs"
          type="number"
          error={!!errors.maxEpochs}
          helperText={errors.maxEpochs}
          disabled={isSubmitting}
          required
        />

        <Input
          name="datasetPath"
          value={config.datasetPath}
          onChange={handleInputChange('datasetPath')}
          placeholder="Dataset Path"
          type="text"
          error={!!errors.datasetPath}
          helperText={errors.datasetPath}
          disabled={isSubmitting}
          required
        />
      </div>

      {gpuWarning && (
        <div className="gpu-warning" role="alert">
          {gpuWarning}
        </div>
      )}

      {trainingError && (
        <div className="error-message" role="alert">
          {trainingError}
        </div>
      )}

      <div className="training-controls">
        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={isSubmitting || !!gpuWarning}
          loading={isSubmitting}
        >
          Start Training
        </Button>

        {trainingStatus?.status === Status.PROCESSING && (
          <Button
            variant="outlined"
            color="error"
            onClick={stopTraining}
            disabled={isSubmitting}
          >
            Stop Training
          </Button>
        )}
      </div>
    </form>
  );
};

export default TrainingConfig;
// External imports
import axios from 'axios'; // ^1.6.0

// Internal imports
import { ITraining } from '../interfaces/ITraining';
import { makeRequest } from '../utils/api';
import { apiConfig } from '../config/api';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { Status, ResourceType } from '../types/common';
import { ApiResponse } from '../types/api';

// Constants for GPU monitoring and rate limiting
const TRAINING_ENDPOINT = ENDPOINTS.TRAINING.CREATE_JOB;
const METRICS_POLLING_INTERVAL = 5000; // 5 seconds
const GPU_TEMP_THRESHOLD = 75; // Celsius
const GPU_UTILIZATION_THRESHOLD = 0.9; // 90%

/**
 * Initiates a new model training job with GPU availability check and temperature-based throttling
 * @param config Training configuration parameters
 * @returns Promise resolving to created training job details with GPU allocation info
 */
export async function startTraining(config: ITraining['config']): Promise<ITraining> {
  try {
    // Check GPU availability and temperature before starting
    const gpuMetrics = await makeRequest<ResourceMetrics>({
      endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
      method: 'GET'
    });

    if (gpuMetrics.data) {
      // Validate GPU temperature and utilization
      if (gpuMetrics.data.temperature > GPU_TEMP_THRESHOLD) {
        throw new Error(`GPU temperature too high: ${gpuMetrics.data.temperature}°C`);
      }
      if (gpuMetrics.data.utilization > GPU_UTILIZATION_THRESHOLD) {
        throw new Error(`GPU utilization too high: ${gpuMetrics.data.utilization * 100}%`);
      }
    }

    // Validate training configuration parameters
    validateTrainingConfig(config);

    // Create training job with GPU-aware settings
    const response = await makeRequest<ITraining>({
      endpoint: TRAINING_ENDPOINT,
      method: 'POST',
      params: {
        ...config,
        gpuRequirements: {
          minTemp: 0,
          maxTemp: GPU_TEMP_THRESHOLD,
          minUtilization: 0,
          maxUtilization: GPU_UTILIZATION_THRESHOLD
        }
      }
    });

    return response.data;
  } catch (error) {
    console.error('Failed to start training:', error);
    throw error;
  }
}

/**
 * Retrieves current status and metrics of a training job with GPU metrics
 * @param trainingId UUID of training job
 * @returns Promise resolving to current training job status with GPU metrics
 */
export async function getTrainingStatus(trainingId: string): Promise<ITraining> {
  try {
    const response = await makeRequest<ITraining>({
      endpoint: ENDPOINTS.TRAINING.JOB_STATUS.replace(':id', trainingId),
      method: 'GET'
    });

    // Enhance response with GPU metrics
    const gpuMetrics = await makeRequest<ResourceMetrics>({
      endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
      method: 'GET'
    });

    if (response.data && gpuMetrics.data) {
      return {
        ...response.data,
        metrics: {
          ...response.data.metrics,
          resourceMetrics: gpuMetrics.data
        }
      };
    }

    return response.data;
  } catch (error) {
    console.error('Failed to get training status:', error);
    throw error;
  }
}

/**
 * Stops an ongoing training job with graceful GPU shutdown
 * @param trainingId UUID of training job to stop
 * @returns Promise resolving to void on successful stoppage
 */
export async function stopTraining(trainingId: string): Promise<void> {
  try {
    // Get current GPU state before stopping
    const gpuMetrics = await makeRequest<ResourceMetrics>({
      endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
      method: 'GET'
    });

    // Log GPU metrics before shutdown
    console.debug('GPU metrics before shutdown:', gpuMetrics.data);

    await makeRequest<void>({
      endpoint: ENDPOINTS.TRAINING.CANCEL_JOB.replace(':id', trainingId),
      method: 'POST',
      params: {
        gracefulShutdown: true,
        gpuCooldownPeriod: 30 // 30 seconds cooldown
      }
    });
  } catch (error) {
    console.error('Failed to stop training:', error);
    throw error;
  }
}

/**
 * Retrieves detailed training metrics including GPU utilization and temperature
 * @param trainingId UUID of training job
 * @returns Promise resolving to detailed training and GPU metrics
 */
export async function getTrainingMetrics(trainingId: string): Promise<ITraining['metrics']> {
  try {
    const [metricsResponse, gpuMetrics] = await Promise.all([
      makeRequest<ITraining['metrics']>({
        endpoint: ENDPOINTS.TRAINING.METRICS.replace(':id', trainingId),
        method: 'GET'
      }),
      makeRequest<ResourceMetrics>({
        endpoint: ENDPOINTS.MONITORING.GPU_METRICS,
        method: 'GET'
      })
    ]);

    // Combine training metrics with GPU metrics
    return {
      ...metricsResponse.data,
      resourceMetrics: gpuMetrics.data,
      gpuHealth: calculateGpuHealth(gpuMetrics.data)
    };
  } catch (error) {
    console.error('Failed to get training metrics:', error);
    throw error;
  }
}

/**
 * Validates training configuration parameters against defined ranges
 * @param config Training configuration to validate
 * @throws Error if validation fails
 */
function validateTrainingConfig(config: ITraining['config']): void {
  const { validationRanges } = config;

  if (config.batchSize < validationRanges.minBatchSize || 
      config.batchSize > validationRanges.maxBatchSize) {
    throw new Error(`Batch size must be between ${validationRanges.minBatchSize} and ${validationRanges.maxBatchSize}`);
  }

  if (config.learningRate < validationRanges.minLearningRate || 
      config.learningRate > validationRanges.maxLearningRate) {
    throw new Error(`Learning rate must be between ${validationRanges.minLearningRate} and ${validationRanges.maxLearningRate}`);
  }

  if (config.maxEpochs < validationRanges.minEpochs || 
      config.maxEpochs > validationRanges.maxEpochs) {
    throw new Error(`Max epochs must be between ${validationRanges.minEpochs} and ${validationRanges.maxEpochs}`);
  }
}

/**
 * Calculates GPU health status based on temperature and utilization
 * @param metrics GPU resource metrics
 * @returns GPU health status string
 */
function calculateGpuHealth(metrics: ResourceMetrics): string {
  if (!metrics) return 'unknown';

  if (metrics.temperature > GPU_TEMP_THRESHOLD || 
      metrics.utilization > GPU_UTILIZATION_THRESHOLD) {
    return 'warning';
  }

  if (metrics.temperature > GPU_TEMP_THRESHOLD * 0.9 || 
      metrics.utilization > GPU_UTILIZATION_THRESHOLD * 0.9) {
    return 'caution';
  }

  return 'healthy';
}
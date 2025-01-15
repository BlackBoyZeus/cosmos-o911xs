// External imports - with versions
import { useEffect, useCallback } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from '../store';

// Internal imports
import { 
  startTrainingJob,
  monitorGPUMetrics,
  updateTrainingStatus,
  updateJobPriority,
  clearMetricsCache,
  selectGPUMetrics,
  selectJobPriority
} from '../store/trainingSlice';
import { ITrainingConfig } from '../interfaces/ITraining';
import { Status } from '../types/common';

// Constants for polling and thresholds
const POLLING_INTERVAL = 5000; // 5 seconds
const GPU_POLLING_INTERVAL = 10000; // 10 seconds
const GPU_TEMP_THRESHOLD = 80; // Celsius
const GPU_MEMORY_THRESHOLD = 0.9; // 90% utilization

/**
 * Custom hook for managing model training operations with comprehensive monitoring
 * @param modelId Unique identifier of the model being trained
 * @returns Training management interface
 */
export const useTraining = (modelId: string) => {
  const dispatch = useDispatch();

  // Select training state from Redux store
  const trainingStatus = useSelector(state => state.training.trainingJobs[modelId]);
  const gpuMetrics = useSelector(state => selectGPUMetrics(state, modelId));
  const jobPriority = useSelector(state => selectJobPriority(state, modelId));
  const error = useSelector(state => state.training.error);

  /**
   * Starts a new training job with the provided configuration
   */
  const startTraining = useCallback(async (config: ITrainingConfig) => {
    try {
      await dispatch(startTrainingJob({
        ...config,
        modelId
      })).unwrap();

      // Start monitoring intervals
      startMonitoring();
    } catch (error) {
      console.error('Failed to start training:', error);
      throw error;
    }
  }, [dispatch, modelId]);

  /**
   * Gracefully stops the training job with cleanup
   */
  const stopTraining = useCallback(async () => {
    try {
      await dispatch(updateTrainingStatus({ 
        id: modelId, 
        status: Status.CANCELLED 
      }));
      
      // Cleanup monitoring and cache
      dispatch(clearMetricsCache(modelId));
    } catch (error) {
      console.error('Failed to stop training:', error);
      throw error;
    }
  }, [dispatch, modelId]);

  /**
   * Starts monitoring intervals for training status and GPU metrics
   */
  const startMonitoring = useCallback(() => {
    // Monitor training status
    const statusInterval = setInterval(() => {
      if (trainingStatus?.status === Status.PROCESSING) {
        dispatch(monitorGPUMetrics(modelId));
      }
    }, POLLING_INTERVAL);

    // Monitor GPU metrics
    const gpuInterval = setInterval(() => {
      if (gpuMetrics) {
        // Check GPU temperature threshold
        if (gpuMetrics.temperature >= GPU_TEMP_THRESHOLD) {
          console.warn(`High GPU temperature: ${gpuMetrics.temperature}°C`);
          dispatch(updateJobPriority({ 
            id: modelId,
            priority: jobPriority * 0.8 // Reduce priority when GPU is hot
          }));
        }

        // Check GPU memory threshold
        if (gpuMetrics.memoryUsage >= GPU_MEMORY_THRESHOLD) {
          console.warn(`High GPU memory usage: ${gpuMetrics.memoryUsage * 100}%`);
        }
      }
    }, GPU_POLLING_INTERVAL);

    // Cleanup function
    return () => {
      clearInterval(statusInterval);
      clearInterval(gpuInterval);
    };
  }, [dispatch, modelId, trainingStatus, gpuMetrics, jobPriority]);

  // Setup monitoring when training is active
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (trainingStatus?.status === Status.PROCESSING) {
      cleanup = startMonitoring();
    }

    return () => {
      if (cleanup) {
        cleanup();
      }
      dispatch(clearMetricsCache(modelId));
    };
  }, [trainingStatus?.status, startMonitoring, dispatch, modelId]);

  return {
    // Training control functions
    startTraining,
    stopTraining,

    // Training state
    trainingStatus,
    trainingMetrics: trainingStatus?.metrics,
    
    // GPU monitoring
    gpuMetrics,
    gpuUtilization: gpuMetrics?.utilization,
    gpuTemperature: gpuMetrics?.temperature,
    gpuMemoryUsage: gpuMetrics?.memoryUsage,

    // Error handling
    error,

    // Job management
    jobPriority,
    isActive: trainingStatus?.status === Status.PROCESSING
  };
};
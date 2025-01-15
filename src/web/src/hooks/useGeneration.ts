// External imports - React 18.0.0
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Internal imports
import { 
  IGenerationRequest, 
  IGenerationResponse, 
  GenerationError,
  GenerationSafetyConfig,
  ResourceMetrics 
} from '../interfaces/IGeneration';
import { Status } from '../types/common';
import { MetricType } from '../interfaces/IMetrics';

// Constants
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;
const PERFORMANCE_THRESHOLD = 600000; // 10 minutes in ms

/**
 * Custom hook for managing video generation state and operations
 * Implements comprehensive monitoring and safety requirements
 */
export const useGeneration = () => {
  // Local state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<GenerationError | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [currentRequest, setCurrentRequest] = useState<IGenerationRequest | null>(null);
  const [generationStatus, setGenerationStatus] = useState<Status>(Status.PENDING);
  const [performanceMetrics, setPerformanceMetrics] = useState<ResourceMetrics>({
    gpuUtilization: 0,
    memoryUsage: 0,
    processingLatency: 0
  });

  // Redux
  const dispatch = useDispatch();
  const generationState = useSelector((state: any) => state.generation);

  // Polling cleanup reference
  const pollingRef = useRef<NodeJS.Timeout>();

  /**
   * Safety validation for generation requests
   */
  const validateSafetyConfig = useCallback((config: GenerationSafetyConfig): boolean => {
    return (
      config.enableFaceBlur && 
      config.contentFiltering && 
      config.autoRemediate
    );
  }, []);

  /**
   * Performance monitoring setup
   */
  const initializePerformanceMonitoring = useCallback(() => {
    return {
      startTime: Date.now(),
      checkpoints: new Map<string, number>(),
      metrics: {
        gpuUtilization: 0,
        memoryUsage: 0,
        processingLatency: 0
      }
    };
  }, []);

  /**
   * Status polling implementation
   */
  const pollGenerationStatus = useCallback(async (requestId: string) => {
    try {
      const response = await fetch(`/api/generation/${requestId}/status`);
      const data: IGenerationResponse = await response.json();
      
      setGenerationStatus(data.status);
      setProgress(data.progressPercentage);
      setPerformanceMetrics(data.resourceUtilization);

      // Check for completion or failure
      if (data.status === Status.COMPLETED || data.status === Status.FAILED) {
        clearInterval(pollingRef.current);
        setLoading(false);
        
        if (data.status === Status.FAILED) {
          setError({
            code: 'GENERATION_FAILED',
            message: data.error || 'Generation failed',
            timestamp: Date.now(),
            details: data
          });
        }
      }

      // Performance threshold check
      if (Date.now() - performanceMonitoring.startTime > PERFORMANCE_THRESHOLD) {
        clearInterval(pollingRef.current);
        setError({
          code: 'PERFORMANCE_THRESHOLD_EXCEEDED',
          message: 'Generation exceeded maximum allowed time',
          timestamp: Date.now(),
          details: { threshold: PERFORMANCE_THRESHOLD }
        });
      }
    } catch (err) {
      console.error('Error polling generation status:', err);
    }
  }, []);

  /**
   * Submit generation request with safety validation and monitoring
   */
  const submitRequest = useCallback(async (request: IGenerationRequest) => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);
      
      // Validate safety configuration
      if (!validateSafetyConfig(request.safetySettings)) {
        throw new Error('Invalid safety configuration');
      }

      // Initialize performance monitoring
      const performanceMonitoring = initializePerformanceMonitoring();
      
      // Submit request
      const response = await fetch('/api/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Failed to submit generation request');
      }

      const data: IGenerationResponse = await response.json();
      setCurrentRequest(request);
      setGenerationStatus(Status.PROCESSING);

      // Start polling
      pollingRef.current = setInterval(
        () => pollGenerationStatus(data.requestId),
        POLLING_INTERVAL
      );

    } catch (err) {
      setError({
        code: 'SUBMISSION_FAILED',
        message: err.message,
        timestamp: Date.now(),
        details: err
      });
      setLoading(false);
    }
  }, [validateSafetyConfig, pollGenerationStatus]);

  /**
   * Cleanup polling on unmount
   */
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * Memoized generation state
   */
  const generationState = useMemo(() => ({
    loading,
    error,
    progress,
    generationStatus,
    performanceMetrics,
    currentRequest
  }), [
    loading,
    error,
    progress,
    generationStatus,
    performanceMetrics,
    currentRequest
  ]);

  return {
    ...generationState,
    submitRequest
  };
};

export default useGeneration;
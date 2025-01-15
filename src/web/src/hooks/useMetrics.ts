// External imports - versions from package.json
import { useEffect, useCallback } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { debounce } from 'lodash'; // ^4.17.21

// Internal imports
import { 
  ISystemMetrics, 
  IModelMetrics, 
  MetricType 
} from '../interfaces/IMetrics';
import {
  fetchGpuMetrics,
  fetchModelMetrics,
  selectGpuUtilization,
  selectGpuTemperature
} from '../store/metricsSlice';

// Constants for metrics management
const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;
const DEFAULT_TEMPERATURE_THRESHOLD = 80; // Celsius
const TEMPERATURE_HISTORY_SIZE = 100;

/**
 * Interface for useMetrics hook options
 */
interface UseMetricsOptions {
  pollingInterval?: number;
  modelId?: string;
  enabled?: boolean;
  temperatureThreshold?: number;
}

/**
 * Enhanced custom hook for managing system metrics and model performance metrics
 * with temperature monitoring and automatic polling
 */
export function useMetrics({
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  modelId,
  enabled = true,
  temperatureThreshold = DEFAULT_TEMPERATURE_THRESHOLD
}: UseMetricsOptions = {}) {
  const dispatch = useDispatch();
  
  // Select metrics from Redux store
  const gpuUtilization = useSelector(selectGpuUtilization);
  const gpuTemperature = useSelector(selectGpuTemperature);
  
  // Local state for temperature history
  const [temperatureHistory, setTemperatureHistory] = useState<number[]>([]);
  const [isOverheating, setIsOverheating] = useState(false);
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [modelMetrics, setModelMetrics] = useState<IModelMetrics>();

  /**
   * Debounced temperature history update to prevent excessive re-renders
   */
  const updateTemperatureHistory = useCallback(
    debounce((temperature: number) => {
      setTemperatureHistory(prev => {
        const updated = [...prev, temperature];
        return updated.slice(-TEMPERATURE_HISTORY_SIZE);
      });
    }, 1000),
    []
  );

  /**
   * Memoized fetch callback with temperature monitoring
   */
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Fetch GPU metrics
      const gpuMetricsResult = await dispatch(fetchGpuMetrics()).unwrap();
      
      // Update temperature history
      if (gpuMetricsResult.gpuTemperature) {
        updateTemperatureHistory(gpuMetricsResult.gpuTemperature);
        
        // Check temperature threshold
        setIsOverheating(gpuMetricsResult.gpuTemperature > temperatureThreshold);
        
        if (gpuMetricsResult.gpuTemperature > temperatureThreshold) {
          console.warn(`GPU temperature critical: ${gpuMetricsResult.gpuTemperature}°C`);
        }
      }

      // Fetch model metrics if modelId is provided
      if (modelId) {
        const modelMetricsResult = await dispatch(fetchModelMetrics(modelId)).unwrap();
        setModelMetrics(modelMetricsResult);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch metrics';
      setError(errorMessage);
      console.error('Error fetching metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, modelId, temperatureThreshold]);

  /**
   * Set up polling effect with cleanup
   */
  useEffect(() => {
    if (!enabled) return;

    let pollInterval: NodeJS.Timeout;
    let retryCount = 0;

    const poll = async () => {
      try {
        await fetchMetrics();
        retryCount = 0; // Reset retry count on success
      } catch (err) {
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          console.error('Max retry attempts reached for metrics polling');
          setError('Max retry attempts reached');
          return;
        }
      }

      // Schedule next poll
      pollInterval = setTimeout(poll, pollingInterval);
    };

    // Initial fetch
    poll();

    // Cleanup
    return () => {
      if (pollInterval) {
        clearTimeout(pollInterval);
      }
    };
  }, [enabled, pollingInterval, fetchMetrics]);

  return {
    gpuUtilization,
    gpuTemperature,
    isOverheating,
    temperatureHistory,
    modelMetrics,
    isLoading,
    error
  };
}

/**
 * Helper hook for polling a single metric type with caching and retry logic
 */
export function useSingleMetric(
  metricType: string,
  options: {
    pollingInterval?: number;
    enabled?: boolean;
    retryAttempts?: number;
  } = {}
) {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
    retryAttempts = MAX_RETRIES
  } = options;

  const [value, setValue] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Cache for metric values
  const metricCache = useRef(new Map<string, { value: number; timestamp: number }>());

  useEffect(() => {
    if (!enabled) return;

    let pollInterval: NodeJS.Timeout;
    let retryCount = 0;

    const fetchMetric = async () => {
      try {
        setIsLoading(true);
        
        // Check cache first
        const cached = metricCache.current.get(metricType);
        if (cached && Date.now() - cached.timestamp < pollingInterval) {
          setValue(cached.value);
          return;
        }

        const response = await fetch(`/api/v1/metrics/${metricType}`);
        if (!response.ok) throw new Error('Failed to fetch metric');

        const data = await response.json();
        setValue(data.value);
        
        // Update cache
        metricCache.current.set(metricType, {
          value: data.value,
          timestamp: Date.now()
        });

        // Update history
        setHistory(prev => [...prev, data.value].slice(-TEMPERATURE_HISTORY_SIZE));
        
        retryCount = 0; // Reset retry count on success
        setError(undefined);
      } catch (err) {
        retryCount++;
        if (retryCount >= retryAttempts) {
          setError('Max retry attempts reached');
          return;
        }
        console.error(`Error fetching metric ${metricType}:`, err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetric();
    pollInterval = setInterval(fetchMetric, pollingInterval);

    return () => {
      clearInterval(pollInterval);
    };
  }, [metricType, enabled, pollingInterval, retryAttempts]);

  return { value, history, isLoading, error };
}
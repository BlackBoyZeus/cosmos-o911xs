// External imports - with versions
import { useCallback, useEffect, useState } from 'react'; // ^18.0.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.0.0

// Internal imports
import { IModel, ModelType } from '../interfaces/IModel';
import { useAuth } from '../hooks/useAuth';
import { buildApiUrl, ENDPOINTS, TIMEOUTS } from '../constants/apiEndpoints';
import { Status } from '../types/common';
import { ApiError, SystemMetricsResponse } from '../types/api';

// Types for GPU and performance monitoring
interface GPUMetrics {
  utilization: number;
  temperature: number;
  memoryUsed: number;
  memoryTotal: number;
}

interface PerformanceMetrics {
  generationTime: number;
  throughput: number;
  psnr: number;
  fid: number;
}

interface SafetyStatus {
  preCheckPassed: boolean;
  postCheckPassed: boolean;
  warnings: string[];
}

interface UseModelsReturn {
  models: IModel[];
  loading: boolean;
  error: ApiError | null;
  gpuMetrics: GPUMetrics;
  performanceMetrics: PerformanceMetrics;
  safetyStatus: SafetyStatus;
  fetchModels: (modelType?: ModelType) => Promise<void>;
  getModelById: (id: string) => Promise<IModel | null>;
  createModel: (modelData: Partial<IModel>) => Promise<IModel>;
  updateModel: (id: string, updates: Partial<IModel>) => Promise<IModel>;
  deleteModel: (id: string) => Promise<boolean>;
  startTraining: (modelId: string, config: any) => Promise<void>;
}

/**
 * Enhanced custom hook for managing models with GPU monitoring, performance tracking, and safety features
 */
export const useModels = (modelType?: ModelType): UseModelsReturn => {
  // Redux setup
  const dispatch = useDispatch();
  const { validateAccess } = useAuth();

  // Local state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [models, setModels] = useState<IModel[]>([]);
  const [gpuMetrics, setGpuMetrics] = useState<GPUMetrics>({
    utilization: 0,
    temperature: 0,
    memoryUsed: 0,
    memoryTotal: 0
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    generationTime: 0,
    throughput: 0,
    psnr: 0,
    fid: 0
  });
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>({
    preCheckPassed: false,
    postCheckPassed: false,
    warnings: []
  });

  /**
   * Fetch GPU metrics at regular intervals
   */
  const pollGPUMetrics = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl(ENDPOINTS.MONITORING.GPU_METRICS));
      const data: SystemMetricsResponse = await response.json();
      
      setGpuMetrics({
        utilization: data.gpuUtilization,
        temperature: data.gpuTemperature,
        memoryUsed: data.memoryUsage,
        memoryTotal: 100 // Assuming percentage
      });
    } catch (err) {
      console.error('Failed to fetch GPU metrics:', err);
    }
  }, []);

  /**
   * Set up GPU monitoring interval
   */
  useEffect(() => {
    const interval = setInterval(pollGPUMetrics, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [pollGPUMetrics]);

  /**
   * Fetch models with optional type filter and role validation
   */
  const fetchModels = useCallback(async (type?: ModelType) => {
    try {
      setLoading(true);
      setError(null);

      // Validate user access
      const hasAccess = await validateAccess(['models:read']);
      if (!hasAccess) {
        throw new Error('Unauthorized access to models');
      }

      const url = buildApiUrl(ENDPOINTS.MODELS.LIST);
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: TIMEOUTS.DEFAULT
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      let data = await response.json();
      
      // Filter by model type if specified
      if (type) {
        data = data.filter((model: IModel) => model.architecture.type === type);
      }

      setModels(data);
    } catch (err: any) {
      setError({
        code: 'FETCH_ERROR',
        message: err.message,
        details: {},
        requestId: '',
        timestamp: Date.now()
      });
    } finally {
      setLoading(false);
    }
  }, [validateAccess]);

  /**
   * Get model by ID with performance tracking
   */
  const getModelById = useCallback(async (id: string): Promise<IModel | null> => {
    try {
      const url = buildApiUrl(ENDPOINTS.MODELS.GET, { id });
      const startTime = performance.now();
      
      const response = await fetch(url);
      const model = await response.json();

      // Update performance metrics
      const endTime = performance.now();
      setPerformanceMetrics(prev => ({
        ...prev,
        generationTime: endTime - startTime
      }));

      return model;
    } catch (err) {
      console.error('Failed to fetch model:', err);
      return null;
    }
  }, []);

  /**
   * Create new model with safety checks
   */
  const createModel = useCallback(async (modelData: Partial<IModel>): Promise<IModel> => {
    try {
      // Pre-safety check
      const preCheckUrl = buildApiUrl(ENDPOINTS.SAFETY.PRE_CHECK);
      const preCheckResponse = await fetch(preCheckUrl, {
        method: 'POST',
        body: JSON.stringify(modelData)
      });
      
      const preCheckResult = await preCheckResponse.json();
      setSafetyStatus(prev => ({
        ...prev,
        preCheckPassed: preCheckResult.passed,
        warnings: preCheckResult.warnings
      }));

      if (!preCheckResult.passed) {
        throw new Error('Pre-safety check failed');
      }

      // Create model
      const url = buildApiUrl(ENDPOINTS.MODELS.LIST);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelData)
      });

      const newModel = await response.json();
      setModels(prev => [...prev, newModel]);
      return newModel;
    } catch (err: any) {
      throw new Error(`Failed to create model: ${err.message}`);
    }
  }, []);

  /**
   * Update model with GPU metrics
   */
  const updateModel = useCallback(async (id: string, updates: Partial<IModel>): Promise<IModel> => {
    try {
      const url = buildApiUrl(ENDPOINTS.MODELS.GET, { id });
      
      // Include current GPU metrics
      const updatedData = {
        ...updates,
        resourceMetrics: {
          gpuUtilization: gpuMetrics.utilization,
          temperature: gpuMetrics.temperature
        }
      };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      const updatedModel = await response.json();
      setModels(prev => prev.map(model => 
        model.id === id ? updatedModel : model
      ));
      
      return updatedModel;
    } catch (err: any) {
      throw new Error(`Failed to update model: ${err.message}`);
    }
  }, [gpuMetrics]);

  /**
   * Delete model with cleanup
   */
  const deleteModel = useCallback(async (id: string): Promise<boolean> => {
    try {
      const url = buildApiUrl(ENDPOINTS.MODELS.GET, { id });
      await fetch(url, { method: 'DELETE' });
      
      setModels(prev => prev.filter(model => model.id !== id));
      return true;
    } catch (err) {
      return false;
    }
  }, []);

  /**
   * Start model training with resource validation
   */
  const startTraining = useCallback(async (modelId: string, config: any): Promise<void> => {
    try {
      // Check GPU resources
      if (gpuMetrics.utilization > 90) {
        throw new Error('GPU utilization too high to start training');
      }

      const url = buildApiUrl(ENDPOINTS.TRAINING.CREATE_JOB);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId,
          config,
          gpuMetrics
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start training');
      }

      // Update model status
      await updateModel(modelId, { status: Status.PROCESSING });
    } catch (err: any) {
      throw new Error(`Failed to start training: ${err.message}`);
    }
  }, [gpuMetrics, updateModel]);

  return {
    models,
    loading,
    error,
    gpuMetrics,
    performanceMetrics,
    safetyStatus,
    fetchModels,
    getModelById,
    createModel,
    updateModel,
    deleteModel,
    startTraining
  };
};
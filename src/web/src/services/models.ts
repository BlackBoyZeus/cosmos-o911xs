// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { IModel, ModelType } from '../interfaces/IModel';
import { apiService } from './api';
import { ENDPOINTS } from '../config/api';
import { Status } from '../types/common';

/**
 * Interface for GPU monitoring subscription
 */
interface GPUMonitoringSubscription {
  modelId: UUID;
  interval: number;
  callback: (metrics: GPUMetrics) => void;
  stopMonitoring: () => void;
}

/**
 * Interface for GPU metrics
 */
interface GPUMetrics {
  utilization: number;
  temperature: number;
  memoryUsage: number;
  powerUsage: number;
  timestamp: number;
}

/**
 * Service for managing World Foundation Models (WFM) in the Cosmos platform
 */
export const modelsService = {
  /**
   * Retrieves list of all models with optional filtering and GPU status
   * @param filter Optional filter criteria for models
   * @returns Promise resolving to array of models with GPU metrics
   */
  async getModels(filter?: {
    type?: ModelType;
    status?: Status;
    searchTerm?: string;
  }): Promise<IModel[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.type) params.append('type', filter.type);
      if (filter?.status) params.append('status', filter.status);
      if (filter?.searchTerm) params.append('search', filter.searchTerm);

      const response = await apiService.get<IModel[]>(
        `${ENDPOINTS.MODELS.LIST}?${params.toString()}`
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch models');
      }

      // Fetch GPU metrics for each model
      const modelsWithMetrics = await Promise.all(
        response.data.map(async (model) => {
          const gpuMetrics = await this.getGPUMetrics(model.id);
          return {
            ...model,
            gpuMetrics
          };
        })
      );

      return modelsWithMetrics;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  },

  /**
   * Retrieves a specific model by ID with GPU metrics
   * @param id Model UUID
   * @returns Promise resolving to model details with GPU metrics
   */
  async getModelById(id: UUID): Promise<IModel> {
    try {
      const response = await apiService.get<IModel>(
        ENDPOINTS.MODELS.GET.replace(':id', id)
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Model not found');
      }

      // Fetch and merge GPU metrics
      const gpuMetrics = await this.getGPUMetrics(id);
      return {
        ...response.data,
        gpuMetrics
      };
    } catch (error) {
      console.error(`Error fetching model ${id}:`, error);
      throw error;
    }
  },

  /**
   * Creates a new model with specified configuration
   * @param modelData Model configuration data
   * @returns Promise resolving to created model
   */
  async createModel(modelData: Partial<IModel>): Promise<IModel> {
    try {
      const response = await apiService.post<IModel>(
        ENDPOINTS.MODELS.LIST,
        modelData
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create model');
      }

      return response.data;
    } catch (error) {
      console.error('Error creating model:', error);
      throw error;
    }
  },

  /**
   * Updates an existing model's configuration
   * @param id Model UUID
   * @param updateData Updated model data
   * @returns Promise resolving to updated model
   */
  async updateModel(id: UUID, updateData: Partial<IModel>): Promise<IModel> {
    try {
      const response = await apiService.put<IModel>(
        ENDPOINTS.MODELS.GET.replace(':id', id),
        updateData
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update model');
      }

      return response.data;
    } catch (error) {
      console.error(`Error updating model ${id}:`, error);
      throw error;
    }
  },

  /**
   * Deletes a model by ID
   * @param id Model UUID
   * @returns Promise resolving to success status
   */
  async deleteModel(id: UUID): Promise<boolean> {
    try {
      const response = await apiService.delete<{ success: boolean }>(
        ENDPOINTS.MODELS.GET.replace(':id', id)
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete model');
      }

      return true;
    } catch (error) {
      console.error(`Error deleting model ${id}:`, error);
      throw error;
    }
  },

  /**
   * Retrieves model performance metrics
   * @param id Model UUID
   * @returns Promise resolving to performance metrics
   */
  async getModelPerformance(id: UUID): Promise<IModel['performance']> {
    try {
      const response = await apiService.get<IModel['performance']>(
        ENDPOINTS.MODELS.METRICS.replace(':id', id)
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch model metrics');
      }

      return response.data;
    } catch (error) {
      console.error(`Error fetching model performance ${id}:`, error);
      throw error;
    }
  },

  /**
   * Retrieves real-time GPU metrics for a model
   * @param id Model UUID
   * @returns Promise resolving to GPU metrics
   */
  async getGPUMetrics(id: UUID): Promise<GPUMetrics> {
    try {
      const response = await apiService.get<GPUMetrics>(
        `${ENDPOINTS.MONITORING.GPU_METRICS}?modelId=${id}`
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to fetch GPU metrics');
      }

      return response.data;
    } catch (error) {
      console.error(`Error fetching GPU metrics for model ${id}:`, error);
      throw error;
    }
  },

  /**
   * Establishes real-time monitoring of GPU status
   * @param id Model UUID
   * @param interval Polling interval in milliseconds
   * @param callback Callback function for metric updates
   * @returns Promise resolving to monitoring subscription
   */
  async monitorGPUStatus(
    id: UUID,
    interval: number = 5000,
    callback: (metrics: GPUMetrics) => void
  ): Promise<GPUMonitoringSubscription> {
    let isMonitoring = true;
    const intervalId = setInterval(async () => {
      if (!isMonitoring) return;
      try {
        const metrics = await this.getGPUMetrics(id);
        callback(metrics);

        // Check temperature thresholds
        if (metrics.temperature > 85) {
          console.warn(`High GPU temperature detected for model ${id}: ${metrics.temperature}°C`);
        }
      } catch (error) {
        console.error(`Error monitoring GPU metrics for model ${id}:`, error);
      }
    }, interval);

    return {
      modelId: id,
      interval,
      callback,
      stopMonitoring: () => {
        isMonitoring = false;
        clearInterval(intervalId);
      }
    };
  }
};
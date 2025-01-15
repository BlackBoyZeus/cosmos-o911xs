// External imports
import { UUID } from 'uuid'; // v9.0.0

// Internal imports
import { IDataset } from '../interfaces/IDataset';
import { makeRequest } from '../utils/api';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { Status } from '../types/common';
import { ApiResponse } from '../types/api';

/**
 * Constants for dataset operations
 */
const DATASET_UPLOAD_TIMEOUT = 300000; // 5 minutes
const METRICS_CACHE_DURATION = 60000; // 1 minute
const MAX_UPLOAD_RETRIES = 3;
const CHUNK_SIZE = 5242880; // 5MB

/**
 * Cache implementation for dataset metrics
 */
const metricsCache = new Map<UUID, {
  data: IDataset['metrics'];
  timestamp: number;
}>();

/**
 * Validates dataset input before processing
 * @param data FormData containing dataset files and metadata
 * @returns Promise resolving to validation result
 */
export async function validateDataset(data: FormData): Promise<boolean> {
  try {
    const response = await makeRequest<{ valid: boolean; errors?: string[] }>({
      endpoint: ENDPOINTS.DATASETS.VALIDATE,
      method: 'POST',
      params: data,
      timeout: 30000
    });

    if (!response.success || !response.data.valid) {
      console.error('Dataset validation failed:', response.error || response.data.errors);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating dataset:', error);
    return false;
  }
}

/**
 * Retrieves list of all datasets with caching support
 * @returns Promise resolving to array of datasets
 */
export async function getDatasets(): Promise<IDataset[]> {
  try {
    const response = await makeRequest<IDataset[]>({
      endpoint: ENDPOINTS.DATASETS.LIST,
      method: 'GET',
      params: {},
      timeout: 30000
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch datasets');
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching datasets:', error);
    throw error;
  }
}

/**
 * Retrieves a specific dataset by ID with error handling
 * @param id Dataset UUID
 * @returns Promise resolving to dataset object
 */
export async function getDatasetById(id: UUID): Promise<IDataset> {
  try {
    const response = await makeRequest<IDataset>({
      endpoint: ENDPOINTS.DATASETS.GET.replace(':id', id),
      method: 'GET',
      params: {},
      timeout: 30000
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch dataset');
    }

    return response.data;
  } catch (error) {
    console.error(`Error fetching dataset ${id}:`, error);
    throw error;
  }
}

/**
 * Creates a new dataset with progress tracking and chunked upload
 * @param data FormData containing dataset files and metadata
 * @returns Promise resolving to created dataset object
 */
export async function createDataset(data: FormData): Promise<IDataset> {
  try {
    // Validate dataset before upload
    const isValid = await validateDataset(data);
    if (!isValid) {
      throw new Error('Dataset validation failed');
    }

    // Initialize upload with chunked transfer
    const totalSize = Array.from(data.getAll('files')).reduce(
      (size, file) => size + (file as File).size,
      0
    );
    let uploadedSize = 0;
    let retryCount = 0;

    const response = await makeRequest<IDataset>({
      endpoint: ENDPOINTS.DATASETS.CREATE,
      method: 'POST',
      params: data,
      timeout: DATASET_UPLOAD_TIMEOUT,
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Upload-Content-Length': totalSize.toString()
      },
      onUploadProgress: (progressEvent) => {
        uploadedSize = progressEvent.loaded;
        const progress = Math.round((uploadedSize / totalSize) * 100);
        // Emit progress event for UI updates
        window.dispatchEvent(new CustomEvent('datasetUploadProgress', {
          detail: { progress, uploadedSize, totalSize }
        }));
      }
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create dataset');
    }

    return response.data;
  } catch (error) {
    console.error('Error creating dataset:', error);
    throw error;
  }
}

/**
 * Deletes a dataset by ID with cleanup
 * @param id Dataset UUID
 * @returns Promise resolving to void on success
 */
export async function deleteDataset(id: UUID): Promise<void> {
  try {
    const response = await makeRequest<void>({
      endpoint: ENDPOINTS.DATASETS.DELETE.replace(':id', id),
      method: 'DELETE',
      params: {},
      timeout: 30000
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete dataset');
    }

    // Clear cached metrics
    metricsCache.delete(id);
  } catch (error) {
    console.error(`Error deleting dataset ${id}:`, error);
    throw error;
  }
}

/**
 * Retrieves comprehensive quality metrics for a dataset with caching
 * @param id Dataset UUID
 * @returns Promise resolving to dataset metrics object
 */
export async function getDatasetMetrics(id: UUID): Promise<IDataset['metrics']> {
  try {
    // Check cache first
    const cached = metricsCache.get(id);
    if (cached && Date.now() - cached.timestamp < METRICS_CACHE_DURATION) {
      return cached.data;
    }

    const response = await makeRequest<IDataset['metrics']>({
      endpoint: ENDPOINTS.DATASETS.METRICS.replace(':id', id),
      method: 'GET',
      params: {},
      timeout: 30000
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch dataset metrics');
    }

    // Update cache
    metricsCache.set(id, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  } catch (error) {
    console.error(`Error fetching metrics for dataset ${id}:`, error);
    throw error;
  }
}
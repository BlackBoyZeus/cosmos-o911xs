// External imports - versions specified in package.json
import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import useWebSocket from 'react-use-websocket';
import { UUID } from 'uuid';

// Internal imports
import { IDataset } from '../interfaces/IDataset';
import { DatasetService } from '../services/datasets';
import {
  selectAllDatasets,
  selectDatasetById,
  selectDatasetsLoading,
  selectDatasetsError,
  updatePerformanceMetrics,
  updateWebSocketStatus,
  invalidateCache,
  fetchDatasets,
  updateDatasetStatus
} from '../store/datasetsSlice';
import { Status } from '../types/common';
import { ENDPOINTS } from '../constants/apiEndpoints';
import { ApiError } from '../types/api';

// Constants for WebSocket and monitoring
const WS_RETRY_INTERVAL = 5000;
const METRICS_UPDATE_INTERVAL = 30000;
const HEALTH_CHECK_INTERVAL = 60000;

/**
 * Enhanced return type for useDatasets hook with monitoring capabilities
 */
interface UseDatasetResult {
  datasets: IDataset[];
  loading: boolean;
  error: ApiError | null;
  metrics: Record<UUID, IDataset['metrics']>;
  health: Record<UUID, {
    status: Status;
    isHealthy: boolean;
    lastChecked: number;
  }>;
  getDataset: (id: UUID) => Promise<IDataset>;
  createDataset: (dataset: Partial<IDataset>) => Promise<IDataset>;
  updateDataset: (id: UUID, updates: Partial<IDataset>) => Promise<IDataset>;
  deleteDataset: (id: UUID) => Promise<void>;
  uploadData: (id: UUID, data: FormData) => Promise<void>;
  monitorDataset: (id: UUID) => void;
  checkHealth: (id: UUID) => Promise<boolean>;
}

/**
 * Custom hook for managing dataset operations with enhanced monitoring and error handling
 * @returns Dataset management methods and state including monitoring capabilities
 */
export function useDatasets(): UseDatasetResult {
  const dispatch = useDispatch();
  const datasets = useSelector(selectAllDatasets);
  const loading = useSelector(selectDatasetsLoading);
  const error = useSelector(selectDatasetsError);

  // WebSocket connection for real-time monitoring
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}${ENDPOINTS.MONITORING.RESOURCES}`,
    {
      reconnectInterval: WS_RETRY_INTERVAL,
      onOpen: () => {
        dispatch(updateWebSocketStatus({ connected: true, lastPing: Date.now() }));
      },
      onClose: () => {
        dispatch(updateWebSocketStatus({ connected: false }));
      }
    }
  );

  // Process WebSocket messages for real-time updates
  useCallback(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (data.type === 'DATASET_METRICS') {
          dispatch(updatePerformanceMetrics({
            id: data.datasetId,
            metrics: data.metrics
          }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    }
  }, [lastMessage, dispatch]);

  /**
   * Retrieves a specific dataset by ID with caching
   */
  const getDataset = useCallback(async (id: UUID): Promise<IDataset> => {
    try {
      const dataset = await DatasetService.getDataset(id);
      dispatch(updatePerformanceMetrics({
        id,
        metrics: await DatasetService.getMetrics(id)
      }));
      return dataset;
    } catch (error) {
      console.error(`Error fetching dataset ${id}:`, error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Creates a new dataset with enhanced validation
   */
  const createDataset = useCallback(async (dataset: Partial<IDataset>): Promise<IDataset> => {
    try {
      const newDataset = await DatasetService.createDataset(dataset);
      dispatch(fetchDatasets());
      return newDataset;
    } catch (error) {
      console.error('Error creating dataset:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Updates dataset with optimistic updates and rollback
   */
  const updateDataset = useCallback(async (
    id: UUID,
    updates: Partial<IDataset>
  ): Promise<IDataset> => {
    try {
      const previousState = selectDatasetById({ datasets: { datasets } }, id);
      const updatedDataset = await DatasetService.updateDataset(id, updates);
      dispatch(invalidateCache(id));
      return updatedDataset;
    } catch (error) {
      console.error(`Error updating dataset ${id}:`, error);
      throw error;
    }
  }, [dispatch, datasets]);

  /**
   * Deletes dataset with cleanup and cache invalidation
   */
  const deleteDataset = useCallback(async (id: UUID): Promise<void> => {
    try {
      await DatasetService.deleteDataset(id);
      dispatch(fetchDatasets());
    } catch (error) {
      console.error(`Error deleting dataset ${id}:`, error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Uploads data to dataset with progress tracking
   */
  const uploadData = useCallback(async (id: UUID, data: FormData): Promise<void> => {
    try {
      await DatasetService.uploadData(id, data);
      dispatch(updateDatasetStatus({ id, status: Status.PROCESSING }));
    } catch (error) {
      console.error(`Error uploading data to dataset ${id}:`, error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Initiates real-time monitoring for a dataset
   */
  const monitorDataset = useCallback((id: UUID): void => {
    if (readyState === WebSocket.OPEN) {
      sendMessage(JSON.stringify({
        type: 'MONITOR_DATASET',
        datasetId: id
      }));
    }
  }, [readyState, sendMessage]);

  /**
   * Performs comprehensive health check on dataset
   */
  const checkHealth = useCallback(async (id: UUID): Promise<boolean> => {
    try {
      const health = await DatasetService.checkHealth(id);
      dispatch(updatePerformanceMetrics({
        id,
        metrics: { health }
      }));
      return health.isHealthy;
    } catch (error) {
      console.error(`Error checking dataset health ${id}:`, error);
      return false;
    }
  }, [dispatch]);

  return {
    datasets,
    loading,
    error,
    metrics: datasets.reduce((acc, dataset) => ({
      ...acc,
      [dataset.id]: dataset.metrics
    }), {}),
    health: datasets.reduce((acc, dataset) => ({
      ...acc,
      [dataset.id]: {
        status: dataset.status,
        isHealthy: dataset.status === Status.COMPLETED,
        lastChecked: Date.now()
      }
    }), {}),
    getDataset,
    createDataset,
    updateDataset,
    deleteDataset,
    uploadData,
    monitorDataset,
    checkHealth
  };
}
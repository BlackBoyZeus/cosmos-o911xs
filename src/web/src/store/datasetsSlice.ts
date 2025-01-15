// External imports
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UUID } from 'uuid';

// Internal imports
import { IDataset } from '../interfaces/IDataset';
import { Status, ErrorResponse } from '../types/common';

// Types
interface WebSocketStatus {
  connected: boolean;
  lastPing: number;
  reconnectAttempts: number;
}

interface RequestStatus {
  inProgress: boolean;
  retryCount: number;
  lastAttempt: number;
  error?: ErrorResponse;
}

interface CacheStatus {
  lastUpdated: number;
  isValid: boolean;
  version: string;
}

interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  loadTime: number;
  errorRate: number;
}

interface DatasetsState {
  datasets: Record<UUID, IDataset>;
  loading: boolean;
  error: string | null;
  selectedDatasetId: UUID | null;
  requestStatus: Record<UUID, RequestStatus>;
  performanceMetrics: Record<UUID, PerformanceMetrics>;
  cacheStatus: Record<UUID, CacheStatus>;
  websocketStatus: WebSocketStatus;
}

// Constants
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffFactor: 1.5,
  timeout: 5000,
};

const INITIAL_STATE: DatasetsState = {
  datasets: {},
  loading: false,
  error: null,
  selectedDatasetId: null,
  requestStatus: {},
  performanceMetrics: {},
  cacheStatus: {},
  websocketStatus: {
    connected: false,
    lastPing: 0,
    reconnectAttempts: 0
  }
};

// Async Thunks
export const fetchDatasets = createAsyncThunk<IDataset[], void, { rejectValue: ErrorResponse }>(
  'datasets/fetchDatasets',
  async (_, { rejectWithValue, signal }) => {
    try {
      const startTime = performance.now();
      const response = await fetch('/api/datasets', {
        signal,
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error as ErrorResponse);
      }

      const datasets = await response.json();
      const loadTime = performance.now() - startTime;

      return datasets.map((dataset: IDataset) => ({
        ...dataset,
        performanceMetrics: {
          loadTime,
          processingTime: 0,
          memoryUsage: 0,
          errorRate: 0
        }
      }));
    } catch (error) {
      return rejectWithValue({
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch datasets',
        details: {},
        timestamp: Date.now(),
        requestId: crypto.randomUUID()
      });
    }
  }
);

export const updateDatasetStatus = createAsyncThunk<
  { id: UUID; status: Status },
  { id: UUID; status: Status },
  { rejectValue: ErrorResponse }
>(
  'datasets/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/datasets/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error as ErrorResponse);
      }

      return { id, status };
    } catch (error) {
      return rejectWithValue({
        code: 'UPDATE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to update dataset status',
        details: { id, status },
        timestamp: Date.now(),
        requestId: crypto.randomUUID()
      });
    }
  }
);

// Slice
const datasetsSlice = createSlice({
  name: 'datasets',
  initialState: INITIAL_STATE,
  reducers: {
    setSelectedDataset(state, action: PayloadAction<UUID | null>) {
      state.selectedDatasetId = action.payload;
    },
    updatePerformanceMetrics(state, action: PayloadAction<{ id: UUID; metrics: PerformanceMetrics }>) {
      const { id, metrics } = action.payload;
      state.performanceMetrics[id] = {
        ...state.performanceMetrics[id],
        ...metrics
      };
    },
    updateWebSocketStatus(state, action: PayloadAction<Partial<WebSocketStatus>>) {
      state.websocketStatus = {
        ...state.websocketStatus,
        ...action.payload
      };
    },
    invalidateCache(state, action: PayloadAction<UUID>) {
      if (state.cacheStatus[action.payload]) {
        state.cacheStatus[action.payload].isValid = false;
      }
    },
    clearError(state) {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDatasets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDatasets.fulfilled, (state, action) => {
        state.loading = false;
        state.datasets = action.payload.reduce((acc, dataset) => {
          acc[dataset.id] = dataset;
          state.cacheStatus[dataset.id] = {
            lastUpdated: Date.now(),
            isValid: true,
            version: dataset.version
          };
          return acc;
        }, {} as Record<UUID, IDataset>);
      })
      .addCase(fetchDatasets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch datasets';
      })
      .addCase(updateDatasetStatus.fulfilled, (state, action) => {
        const { id, status } = action.payload;
        if (state.datasets[id]) {
          state.datasets[id].status = status;
          state.requestStatus[id] = {
            inProgress: false,
            retryCount: 0,
            lastAttempt: Date.now()
          };
        }
      })
      .addCase(updateDatasetStatus.rejected, (state, action) => {
        const id = action.meta.arg.id;
        state.requestStatus[id] = {
          inProgress: false,
          retryCount: (state.requestStatus[id]?.retryCount || 0) + 1,
          lastAttempt: Date.now(),
          error: action.payload
        };
      });
  }
});

// Selectors
export const selectAllDatasets = (state: { datasets: DatasetsState }) => 
  Object.values(state.datasets.datasets);

export const selectDatasetById = (state: { datasets: DatasetsState }, id: UUID) => 
  state.datasets.datasets[id];

export const selectDatasetPerformance = (state: { datasets: DatasetsState }, id: UUID) => 
  state.datasets.performanceMetrics[id];

export const selectDatasetHealth = (state: { datasets: DatasetsState }, id: UUID) => {
  const dataset = state.datasets.datasets[id];
  const metrics = state.datasets.performanceMetrics[id];
  
  if (!dataset || !metrics) return null;
  
  return {
    status: dataset.status,
    errorRate: metrics.errorRate,
    isHealthy: dataset.status === Status.COMPLETED && metrics.errorRate < 0.05,
    lastUpdated: state.datasets.cacheStatus[id]?.lastUpdated
  };
};

// Exports
export const { 
  setSelectedDataset, 
  updatePerformanceMetrics, 
  updateWebSocketStatus,
  invalidateCache,
  clearError 
} = datasetsSlice.actions;

export default datasetsSlice.reducer;
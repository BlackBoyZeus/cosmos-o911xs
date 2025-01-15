// External imports - @reduxjs/toolkit v1.9.0
import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';

// Internal imports
import { 
  ISystemMetrics, 
  IModelMetrics, 
  IMetricThresholds,
  MetricType 
} from '../interfaces/IMetrics';
import { 
  getSystemMetrics, 
  getModelMetrics, 
  getMetricHistory 
} from '../services/metrics';

// Constants
const METRICS_POLLING_INTERVAL = 30000; // 30 seconds
const METRICS_HISTORY_LIMIT = 1000; // Maximum historical data points
const METRICS_CACHE_TTL = 60000; // 1 minute cache TTL
const DEFAULT_THRESHOLDS = {
  gpuTempMax: 85, // Celsius
  gpuUtilMax: 95, // Percentage
  memoryMax: 95 // Percentage
};

// Interface for metrics state
interface MetricsState {
  systemMetrics: ISystemMetrics | null;
  modelMetrics: Record<string, IModelMetrics>;
  metricHistory: {
    [key in MetricType]?: Array<{
      timestamp: number;
      value: number;
    }>;
  };
  thresholds: IMetricThresholds;
  isPolling: boolean;
  error: string | null;
  lastUpdated: number;
}

// Initial state
const initialState: MetricsState = {
  systemMetrics: null,
  modelMetrics: {},
  metricHistory: {},
  thresholds: DEFAULT_THRESHOLDS,
  isPolling: false,
  error: null,
  lastUpdated: 0
};

// Async thunks
export const fetchSystemMetrics = createAsyncThunk(
  'metrics/fetchSystemMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const metrics = await getSystemMetrics();
      
      // Validate temperature thresholds
      if (metrics.gpuTemperature > DEFAULT_THRESHOLDS.gpuTempMax) {
        console.error(`Critical GPU temperature: ${metrics.gpuTemperature}°C`);
      }

      return metrics;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchModelMetrics = createAsyncThunk(
  'metrics/fetchModelMetrics',
  async (modelId: string, { rejectWithValue }) => {
    try {
      const metrics = await getModelMetrics(modelId);
      return { modelId, metrics };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const fetchMetricHistory = createAsyncThunk(
  'metrics/fetchMetricHistory',
  async ({ 
    metricType, 
    timeRange 
  }: { 
    metricType: MetricType; 
    timeRange: number;
  }, { rejectWithValue }) => {
    try {
      const endTime = Date.now();
      const startTime = endTime - timeRange;
      const history = await getMetricHistory(
        metricType,
        startTime,
        endTime,
        Math.floor(timeRange / METRICS_HISTORY_LIMIT).toString()
      );
      return { metricType, history };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Create metrics slice
const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    setSystemMetrics: (state, action: PayloadAction<ISystemMetrics>) => {
      state.systemMetrics = action.payload;
      state.lastUpdated = Date.now();

      // Update historical data
      if (!state.metricHistory[MetricType.GPU_UTILIZATION]) {
        state.metricHistory[MetricType.GPU_UTILIZATION] = [];
      }
      state.metricHistory[MetricType.GPU_UTILIZATION].push({
        timestamp: action.payload.timestamp,
        value: action.payload.gpuUtilization
      });

      // Prune historical data if needed
      if (state.metricHistory[MetricType.GPU_UTILIZATION].length > METRICS_HISTORY_LIMIT) {
        state.metricHistory[MetricType.GPU_UTILIZATION].shift();
      }
    },

    setModelMetrics: (state, action: PayloadAction<{
      modelId: string;
      metrics: IModelMetrics;
    }>) => {
      const { modelId, metrics } = action.payload;
      state.modelMetrics[modelId] = metrics;
      state.lastUpdated = Date.now();
    },

    setThresholds: (state, action: PayloadAction<IMetricThresholds>) => {
      state.thresholds = action.payload;
    },

    setPolling: (state, action: PayloadAction<boolean>) => {
      state.isPolling = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // System metrics
      .addCase(fetchSystemMetrics.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.systemMetrics = action.payload;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchSystemMetrics.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Model metrics
      .addCase(fetchModelMetrics.fulfilled, (state, action) => {
        const { modelId, metrics } = action.payload;
        state.modelMetrics[modelId] = metrics;
        state.lastUpdated = Date.now();
      })
      .addCase(fetchModelMetrics.rejected, (state, action) => {
        state.error = action.payload as string;
      })

      // Metric history
      .addCase(fetchMetricHistory.fulfilled, (state, action) => {
        const { metricType, history } = action.payload;
        state.metricHistory[metricType] = history.dataPoints;
      })
      .addCase(fetchMetricHistory.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  }
});

// Export actions and reducer
export const { 
  setSystemMetrics, 
  setModelMetrics, 
  setThresholds, 
  setPolling,
  clearError 
} = metricsSlice.actions;

export default metricsSlice.reducer;
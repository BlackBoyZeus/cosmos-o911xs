import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UUID } from 'uuid';
import { ITraining } from '../interfaces/ITraining';
import { Status } from '../types/common';
import { GPUMetrics } from '@nvidia/gpu-metrics';

// Constants for GPU monitoring and metrics
const POLLING_INTERVAL = 5000;
const MAX_GPU_TEMP = 85;
const GPU_THROTTLE_TEMP = 80;
const METRIC_CACHE_TTL = 60000;

// State interface with enhanced GPU monitoring
interface TrainingState {
  trainingJobs: Record<UUID, ITraining>;
  activeJobs: UUID[];
  isLoading: boolean;
  error: string | null;
  gpuMetrics: Record<UUID, GPUMetrics>;
  jobPriorities: Record<UUID, number>;
  lastMetricUpdate: Record<UUID, number>;
}

// Initial state
const initialState: TrainingState = {
  trainingJobs: {},
  activeJobs: [],
  isLoading: false,
  error: null,
  gpuMetrics: {},
  jobPriorities: {},
  lastMetricUpdate: {}
};

// Async thunk for starting a training job with GPU resource check
export const startTrainingJob = createAsyncThunk(
  'training/startJob',
  async (config: ITraining['config'], { rejectWithValue }) => {
    try {
      // Check GPU availability and temperature
      const gpuMetrics = await checkGPUAvailability();
      if (gpuMetrics.temperature > MAX_GPU_TEMP) {
        return rejectWithValue('GPU temperature too high for new training job');
      }

      // Calculate job priority based on GPU metrics
      const priority = calculateJobPriority(gpuMetrics);

      // Start training job
      const response = await fetch('/api/v1/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, priority })
      });

      if (!response.ok) {
        throw new Error('Failed to start training job');
      }

      const trainingJob = await response.json();
      return { ...trainingJob, gpuMetrics };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Async thunk for monitoring GPU metrics during training
export const monitorGPUMetrics = createAsyncThunk(
  'training/monitorGPU',
  async (trainingId: UUID, { getState, dispatch }) => {
    try {
      const metrics = await fetch(`/api/v1/training/${trainingId}/gpu-metrics`).then(res => res.json());
      
      // Check temperature thresholds
      if (metrics.temperature >= GPU_THROTTLE_TEMP) {
        dispatch(updateTrainingStatus({ id: trainingId, status: Status.GPU_THROTTLED }));
      }

      return { trainingId, metrics };
    } catch (error) {
      console.error('Failed to fetch GPU metrics:', error);
      throw error;
    }
  }
);

// Training slice with enhanced GPU monitoring
const trainingSlice = createSlice({
  name: 'training',
  initialState,
  reducers: {
    updateTrainingStatus: (
      state,
      action: PayloadAction<{ id: UUID; status: Status }>
    ) => {
      const { id, status } = action.payload;
      if (state.trainingJobs[id]) {
        state.trainingJobs[id].status = status;
      }
    },
    updateJobPriority: (
      state,
      action: PayloadAction<{ id: UUID; priority: number }>
    ) => {
      const { id, priority } = action.payload;
      state.jobPriorities[id] = priority;
    },
    clearMetricsCache: (state, action: PayloadAction<UUID>) => {
      delete state.gpuMetrics[action.payload];
      delete state.lastMetricUpdate[action.payload];
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle startTrainingJob
      .addCase(startTrainingJob.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(startTrainingJob.fulfilled, (state, action) => {
        const { id, gpuMetrics } = action.payload;
        state.trainingJobs[id] = action.payload;
        state.activeJobs.push(id);
        state.gpuMetrics[id] = gpuMetrics;
        state.lastMetricUpdate[id] = Date.now();
        state.isLoading = false;
      })
      .addCase(startTrainingJob.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Handle monitorGPUMetrics
      .addCase(monitorGPUMetrics.fulfilled, (state, action) => {
        const { trainingId, metrics } = action.payload;
        state.gpuMetrics[trainingId] = metrics;
        state.lastMetricUpdate[trainingId] = Date.now();
      });
  }
});

// Selectors
export const selectGPUMetrics = (state: { training: TrainingState }, trainingId: UUID) => 
  state.training.gpuMetrics[trainingId];

export const selectJobPriority = (state: { training: TrainingState }, trainingId: UUID) =>
  state.training.jobPriorities[trainingId];

// Helper functions
const checkGPUAvailability = async (): Promise<GPUMetrics> => {
  const response = await fetch('/api/v1/gpu/status');
  return response.json();
};

const calculateJobPriority = (gpuMetrics: GPUMetrics): number => {
  const utilizationWeight = 0.4;
  const temperatureWeight = 0.6;
  
  const utilizationScore = (100 - gpuMetrics.utilization) / 100;
  const temperatureScore = (MAX_GPU_TEMP - gpuMetrics.temperature) / MAX_GPU_TEMP;
  
  return (utilizationScore * utilizationWeight + temperatureScore * temperatureWeight);
};

// Export actions and reducer
export const { updateTrainingStatus, updateJobPriority, clearMetricsCache } = trainingSlice.actions;
export default trainingSlice.reducer;
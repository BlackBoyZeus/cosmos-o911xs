// External imports
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UUID } from 'uuid';

// Internal imports
import { 
  IGenerationRequest, 
  IGenerationResponse,
  Status,
  ResourceMetrics 
} from '../interfaces/IGeneration';
import { 
  ISafetyCheckConfig,
  SafetyStatus,
  GuardType 
} from '../interfaces/ISafety';
import { MetricType } from '../interfaces/IMetrics';

// Constants
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_MAX = 1000;
const STATUS_CHECK_INTERVAL = 2000; // 2 seconds

// State interface
interface GenerationState {
  requests: Record<UUID, IGenerationRequest>;
  responses: Record<UUID, IGenerationResponse>;
  loading: boolean;
  error: string | null;
  activeRequests: UUID[];
  metrics: Record<UUID, ResourceMetrics>;
  globalSafetyConfig: {
    contentFiltering: boolean;
    faceBlur: boolean;
    autoRemediate: boolean;
  };
  rateLimitRemaining: number;
  retryAttempts: Record<UUID, number>;
}

// Initial state
const initialState: GenerationState = {
  requests: {},
  responses: {},
  loading: false,
  error: null,
  activeRequests: [],
  metrics: {},
  globalSafetyConfig: {
    contentFiltering: true,
    faceBlur: true,
    autoRemediate: true
  },
  rateLimitRemaining: RATE_LIMIT_MAX,
  retryAttempts: {}
};

// Async thunks
export const submitRequest = createAsyncThunk(
  'generation/submitRequest',
  async (request: IGenerationRequest, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { generation: GenerationState };
      
      // Validate rate limit
      if (state.generation.rateLimitRemaining <= 0) {
        throw new Error('Rate limit exceeded');
      }

      // Apply global safety settings
      const safetySettings = {
        ...request.safetySettings,
        ...state.generation.globalSafetyConfig
      };

      // Submit request to API
      const response = await fetch('/api/v1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, safetySettings })
      });

      if (!response.ok) {
        throw new Error('Generation request failed');
      }

      const data: IGenerationResponse = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const checkStatus = createAsyncThunk(
  'generation/checkStatus',
  async (requestId: UUID, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { generation: GenerationState };
      const retryCount = state.generation.retryAttempts[requestId] || 0;

      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        throw new Error('Max retry attempts exceeded');
      }

      const response = await fetch(`/api/v1/status/${requestId}`);
      if (!response.ok) {
        throw new Error('Status check failed');
      }

      const data: IGenerationResponse = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

export const cancelRequest = createAsyncThunk(
  'generation/cancelRequest',
  async (requestId: UUID, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/v1/cancel/${requestId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Cancel request failed');
      }
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Slice
const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    updateSafetyConfig: (state, action: PayloadAction<Partial<typeof state.globalSafetyConfig>>) => {
      state.globalSafetyConfig = {
        ...state.globalSafetyConfig,
        ...action.payload
      };
    },
    updateMetrics: (state, action: PayloadAction<{ requestId: UUID; metrics: ResourceMetrics }>) => {
      const { requestId, metrics } = action.payload;
      state.metrics[requestId] = metrics;
    },
    clearCompleted: (state) => {
      const activeIds = new Set(state.activeRequests);
      state.requests = Object.fromEntries(
        Object.entries(state.requests).filter(([id]) => activeIds.has(id as UUID))
      );
      state.responses = Object.fromEntries(
        Object.entries(state.responses).filter(([id]) => activeIds.has(id as UUID))
      );
    }
  },
  extraReducers: (builder) => {
    builder
      // Submit request
      .addCase(submitRequest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(submitRequest.fulfilled, (state, action) => {
        const { requestId } = action.payload;
        state.loading = false;
        state.responses[requestId] = action.payload;
        state.activeRequests.push(requestId);
        state.rateLimitRemaining--;
      })
      .addCase(submitRequest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Check status
      .addCase(checkStatus.fulfilled, (state, action) => {
        const { requestId, status } = action.payload;
        state.responses[requestId] = action.payload;
        if (status === Status.COMPLETED || status === Status.FAILED) {
          state.activeRequests = state.activeRequests.filter(id => id !== requestId);
        }
      })
      .addCase(checkStatus.rejected, (state, action) => {
        const requestId = action.meta.arg;
        state.retryAttempts[requestId] = (state.retryAttempts[requestId] || 0) + 1;
      })
      // Cancel request
      .addCase(cancelRequest.fulfilled, (state, action) => {
        const requestId = action.meta.arg;
        state.activeRequests = state.activeRequests.filter(id => id !== requestId);
        if (state.responses[requestId]) {
          state.responses[requestId].status = Status.CANCELLED;
        }
      });
  }
});

// Selectors
export const selectGenerationState = (state: { generation: GenerationState }) => state.generation;
export const selectRequest = (requestId: UUID) => 
  (state: { generation: GenerationState }) => state.generation.requests[requestId];
export const selectResponse = (requestId: UUID) => 
  (state: { generation: GenerationState }) => state.generation.responses[requestId];
export const selectMetrics = (requestId: UUID) => 
  (state: { generation: GenerationState }) => state.generation.metrics[requestId];
export const selectSafetyConfig = 
  (state: { generation: GenerationState }) => state.generation.globalSafetyConfig;

// Exports
export const { updateSafetyConfig, updateMetrics, clearCompleted } = generationSlice.actions;
export default generationSlice.reducer;
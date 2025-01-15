// External imports - @reduxjs/toolkit v1.9.0
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UUID } from 'uuid';

// Internal imports
import { IModel, ModelFilter } from '../interfaces/IModel';
import { modelsService } from '../services/models';
import { Status } from '../types/common';
import { ApiError } from '../types/api';

// Types
interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface GPUMetricsState {
  utilization: number;
  temperature: number;
  memoryUsage: number;
  powerUsage: number;
  lastUpdated: number;
}

interface PerformanceMetricsState {
  generationTime: number;
  gpuMemoryUsage: number;
  throughput: number;
  psnr: number;
  fid: number;
  lastUpdated: number;
}

interface SafetyStatus {
  preGuardEnabled: boolean;
  postGuardEnabled: boolean;
  lastCheck: number;
  violations: string[];
}

interface ModelsState {
  models: IModel[];
  selectedModel: IModel | null;
  loading: boolean;
  error: ApiError | null;
  filter: ModelFilter;
  pagination: PaginationState;
  gpuMetrics: Record<UUID, GPUMetricsState>;
  performanceMetrics: Record<UUID, PerformanceMetricsState>;
  safetyStatus: Record<UUID, SafetyStatus>;
}

// Initial state
const initialState: ModelsState = {
  models: [],
  selectedModel: null,
  loading: false,
  error: null,
  filter: {},
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false
  },
  gpuMetrics: {},
  performanceMetrics: {},
  safetyStatus: {}
};

// Async thunks
export const fetchModels = createAsyncThunk(
  'models/fetchModels',
  async ({ filter, pagination }: { filter?: ModelFilter; pagination?: Partial<PaginationState> }, { rejectWithValue }) => {
    try {
      const models = await modelsService.getModels(filter);
      
      // Fetch GPU and performance metrics for each model
      const modelsWithMetrics = await Promise.all(
        models.map(async (model) => {
          const [gpuMetrics, performanceMetrics] = await Promise.all([
            modelsService.getGPUMetrics(model.id),
            modelsService.getModelPerformance(model.id)
          ]);
          return { ...model, gpuMetrics, performanceMetrics };
        })
      );
      
      return modelsWithMetrics;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const fetchModelById = createAsyncThunk(
  'models/fetchModelById',
  async (id: UUID, { rejectWithValue }) => {
    try {
      const model = await modelsService.getModelById(id);
      const [gpuMetrics, performanceMetrics] = await Promise.all([
        modelsService.getGPUMetrics(id),
        modelsService.getModelPerformance(id)
      ]);
      return { ...model, gpuMetrics, performanceMetrics };
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const createModel = createAsyncThunk(
  'models/createModel',
  async (modelData: Partial<IModel>, { rejectWithValue }) => {
    try {
      return await modelsService.createModel(modelData);
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const updateModel = createAsyncThunk(
  'models/updateModel',
  async ({ id, data }: { id: UUID; data: Partial<IModel> }, { rejectWithValue }) => {
    try {
      return await modelsService.updateModel(id, data);
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

export const deleteModel = createAsyncThunk(
  'models/deleteModel',
  async (id: UUID, { rejectWithValue }) => {
    try {
      await modelsService.deleteModel(id);
      return id;
    } catch (error) {
      return rejectWithValue(error as ApiError);
    }
  }
);

// Slice
const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<ModelFilter>) => {
      state.filter = action.payload;
      state.pagination.page = 1;
    },
    updateGPUMetrics: (state, action: PayloadAction<{ modelId: UUID; metrics: GPUMetricsState }>) => {
      const { modelId, metrics } = action.payload;
      state.gpuMetrics[modelId] = {
        ...metrics,
        lastUpdated: Date.now()
      };
    },
    updatePerformanceMetrics: (state, action: PayloadAction<{ modelId: UUID; metrics: PerformanceMetricsState }>) => {
      const { modelId, metrics } = action.payload;
      state.performanceMetrics[modelId] = {
        ...metrics,
        lastUpdated: Date.now()
      };
    },
    updateSafetyStatus: (state, action: PayloadAction<{ modelId: UUID; status: SafetyStatus }>) => {
      const { modelId, status } = action.payload;
      state.safetyStatus[modelId] = {
        ...status,
        lastCheck: Date.now()
      };
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch models
      .addCase(fetchModels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        state.loading = false;
        state.models = action.payload;
        state.error = null;
      })
      .addCase(fetchModels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ApiError;
      })
      // Fetch model by ID
      .addCase(fetchModelById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchModelById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedModel = action.payload;
        state.error = null;
      })
      .addCase(fetchModelById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ApiError;
      })
      // Create model
      .addCase(createModel.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createModel.fulfilled, (state, action) => {
        state.loading = false;
        state.models.push(action.payload);
        state.error = null;
      })
      .addCase(createModel.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ApiError;
      })
      // Update model
      .addCase(updateModel.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateModel.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.models.findIndex(model => model.id === action.payload.id);
        if (index !== -1) {
          state.models[index] = action.payload;
        }
        if (state.selectedModel?.id === action.payload.id) {
          state.selectedModel = action.payload;
        }
        state.error = null;
      })
      .addCase(updateModel.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ApiError;
      })
      // Delete model
      .addCase(deleteModel.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteModel.fulfilled, (state, action) => {
        state.loading = false;
        state.models = state.models.filter(model => model.id !== action.payload);
        if (state.selectedModel?.id === action.payload) {
          state.selectedModel = null;
        }
        state.error = null;
      })
      .addCase(deleteModel.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as ApiError;
      });
  }
});

export const {
  setFilter,
  updateGPUMetrics,
  updatePerformanceMetrics,
  updateSafetyStatus,
  clearError
} = modelsSlice.actions;

export default modelsSlice.reducer;
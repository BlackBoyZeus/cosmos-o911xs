// External imports
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Internal imports
import { 
  GuardType, 
  ISafetyCheckConfig, 
  IGuardConfig, 
  ISafetyLog 
} from '../interfaces/ISafety';
import { SafetyService } from '../services/safety';

// Interface for safety slice state
interface SafetyState {
  guardConfigs: Record<GuardType, {
    config: IGuardConfig;
    lastUpdated: number;
    updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  }>;
  safetyLogs: Record<string, {
    logs: ISafetyLog[];
    metadata: {
      total: number;
      page: number;
      hasMore: boolean;
    };
  }>;
  safetyMetrics: {
    totalChecks: number;
    passRate: number;
    faceBlurCompliance: number;
    contentBlockRate: number;
    averageLatency: number;
    checksByType: Record<string, number>;
    lastUpdated: number;
  };
  autoRemediation: Record<string, {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    attempts: number;
    lastAttempt: number;
  }>;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
  cache: Record<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }>;
}

// Initial state
const initialState: SafetyState = {
  guardConfigs: {
    [GuardType.PRE_GUARD]: {
      config: null,
      lastUpdated: 0,
      updateStatus: 'idle'
    },
    [GuardType.POST_GUARD]: {
      config: null,
      lastUpdated: 0,
      updateStatus: 'idle'
    }
  },
  safetyLogs: {},
  safetyMetrics: {
    totalChecks: 0,
    passRate: 0,
    faceBlurCompliance: 0,
    contentBlockRate: 0,
    averageLatency: 0,
    checksByType: {},
    lastUpdated: 0
  },
  autoRemediation: {},
  loading: {},
  error: {},
  cache: {}
};

// Async thunks
export const fetchGuardConfig = createAsyncThunk(
  'safety/fetchGuardConfig',
  async ({ guardType, forceRefresh = false }: { guardType: GuardType; forceRefresh?: boolean }, { getState }) => {
    const safetyService = new SafetyService();
    const cacheKey = `guard_config_${guardType}`;
    const state = getState() as { safety: SafetyState };
    const cached = state.safety.cache[cacheKey];

    if (!forceRefresh && cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    const config = await safetyService.getGuardConfig(guardType);
    return { guardType, config };
  }
);

export const updateGuardConfig = createAsyncThunk(
  'safety/updateGuardConfig',
  async ({ 
    guardType, 
    config, 
    immediate = true 
  }: { 
    guardType: GuardType; 
    config: IGuardConfig; 
    immediate?: boolean;
  }) => {
    const safetyService = new SafetyService();
    const updatedConfig = await safetyService.updateGuardConfig(guardType, config);
    return { guardType, config: updatedConfig };
  }
);

export const fetchSafetyLogs = createAsyncThunk(
  'safety/fetchSafetyLogs',
  async ({ 
    generationId, 
    page = 1, 
    limit = 50,
    filters = {} 
  }: { 
    generationId: string; 
    page?: number; 
    limit?: number;
    filters?: Record<string, any>;
  }) => {
    const safetyService = new SafetyService();
    const response = await safetyService.getSafetyLogs({
      page,
      limit,
      ...filters
    });
    return { generationId, ...response };
  }
);

export const fetchSafetyMetrics = createAsyncThunk(
  'safety/fetchSafetyMetrics',
  async () => {
    const safetyService = new SafetyService();
    return await safetyService.getSafetyMetrics();
  }
);

// Create the slice
const safetySlice = createSlice({
  name: 'safety',
  initialState,
  reducers: {
    clearSafetyErrors: (state) => {
      state.error = {};
    },
    updateSafetyMetrics: (state, action: PayloadAction<Partial<typeof initialState.safetyMetrics>>) => {
      state.safetyMetrics = {
        ...state.safetyMetrics,
        ...action.payload,
        lastUpdated: Date.now()
      };
    },
    updateAutoRemediationStatus: (state, action: PayloadAction<{
      id: string;
      status: typeof initialState.autoRemediation[string]['status'];
    }>) => {
      const { id, status } = action.payload;
      state.autoRemediation[id] = {
        ...state.autoRemediation[id],
        status,
        lastAttempt: Date.now()
      };
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchGuardConfig
      .addCase(fetchGuardConfig.pending, (state, action) => {
        const guardType = action.meta.arg.guardType;
        state.guardConfigs[guardType].updateStatus = 'loading';
        state.error[`fetch_${guardType}`] = null;
      })
      .addCase(fetchGuardConfig.fulfilled, (state, action) => {
        const { guardType, config } = action.payload;
        state.guardConfigs[guardType] = {
          config,
          lastUpdated: Date.now(),
          updateStatus: 'succeeded'
        };
        state.cache[`guard_config_${guardType}`] = {
          data: config,
          timestamp: Date.now(),
          ttl: 300000 // 5 minutes
        };
      })
      .addCase(fetchGuardConfig.rejected, (state, action) => {
        const guardType = action.meta.arg.guardType;
        state.guardConfigs[guardType].updateStatus = 'failed';
        state.error[`fetch_${guardType}`] = action.error.message;
      })
      // Handle updateGuardConfig
      .addCase(updateGuardConfig.pending, (state, action) => {
        const guardType = action.meta.arg.guardType;
        state.guardConfigs[guardType].updateStatus = 'loading';
      })
      .addCase(updateGuardConfig.fulfilled, (state, action) => {
        const { guardType, config } = action.payload;
        state.guardConfigs[guardType] = {
          config,
          lastUpdated: Date.now(),
          updateStatus: 'succeeded'
        };
        state.cache[`guard_config_${guardType}`] = {
          data: config,
          timestamp: Date.now(),
          ttl: 300000
        };
      })
      .addCase(updateGuardConfig.rejected, (state, action) => {
        const guardType = action.meta.arg.guardType;
        state.guardConfigs[guardType].updateStatus = 'failed';
        state.error[`update_${guardType}`] = action.error.message;
      })
      // Handle fetchSafetyLogs
      .addCase(fetchSafetyLogs.pending, (state, action) => {
        const generationId = action.meta.arg.generationId;
        state.loading[`logs_${generationId}`] = true;
      })
      .addCase(fetchSafetyLogs.fulfilled, (state, action) => {
        const { generationId, logs, total, page } = action.payload;
        state.safetyLogs[generationId] = {
          logs: page === 1 ? logs : [...(state.safetyLogs[generationId]?.logs || []), ...logs],
          metadata: {
            total,
            page,
            hasMore: logs.length + ((page - 1) * action.meta.arg.limit) < total
          }
        };
        state.loading[`logs_${generationId}`] = false;
      })
      .addCase(fetchSafetyLogs.rejected, (state, action) => {
        const generationId = action.meta.arg.generationId;
        state.loading[`logs_${generationId}`] = false;
        state.error[`logs_${generationId}`] = action.error.message;
      })
      // Handle fetchSafetyMetrics
      .addCase(fetchSafetyMetrics.fulfilled, (state, action) => {
        state.safetyMetrics = {
          ...action.payload,
          lastUpdated: Date.now()
        };
      });
  }
});

// Export actions and reducer
export const { 
  clearSafetyErrors, 
  updateSafetyMetrics, 
  updateAutoRemediationStatus 
} = safetySlice.actions;

export default safetySlice.reducer;

// Selectors
export const selectGuardConfig = (state: { safety: SafetyState }, guardType: GuardType) => 
  state.safety.guardConfigs[guardType];

export const selectSafetyLogs = (state: { safety: SafetyState }, generationId: string) => 
  state.safety.safetyLogs[generationId];

export const selectSafetyMetrics = (state: { safety: SafetyState }) => 
  state.safety.safetyMetrics;

export const selectAutoRemediationStatus = (state: { safety: SafetyState }, id: string) => 
  state.safety.autoRemediation[id];
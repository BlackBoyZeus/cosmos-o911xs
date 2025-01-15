// External imports - versions from package.json
import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0

// Internal imports
import { useMetrics } from '../../src/hooks/useMetrics';
import { ISystemMetrics } from '../../src/interfaces/IMetrics';
import { fetchGpuMetrics, fetchModelMetrics } from '../../src/store/metricsSlice';

// Test constants
const TEST_POLLING_INTERVAL = 1000;
const MOCK_GPU_METRICS: ISystemMetrics = {
  gpuUtilization: 75,
  gpuMemoryUsage: 82,
  gpuTemperature: 68,
  ramUsage: 65,
  storageUsage: 45,
  timestamp: Date.now()
};
const TEMPERATURE_WARNING_THRESHOLD = 75;
const TEMPERATURE_CRITICAL_THRESHOLD = 85;

// Mock store setup
const createTestStore = () => configureStore({
  reducer: {
    metrics: (state = {
      systemMetrics: null,
      modelMetrics: {},
      error: null,
      isPolling: false,
      lastUpdated: 0
    }, action) => {
      switch (action.type) {
        case 'metrics/fetchGpuMetrics/fulfilled':
          return {
            ...state,
            systemMetrics: action.payload,
            lastUpdated: Date.now()
          };
        case 'metrics/fetchModelMetrics/fulfilled':
          return {
            ...state,
            modelMetrics: {
              ...state.modelMetrics,
              [action.payload.modelId]: action.payload.metrics
            }
          };
        default:
          return state;
      }
    }
  }
});

// Test wrapper setup
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={createTestStore()}>{children}</Provider>
);

describe('useMetrics', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should fetch metrics on mount', async () => {
    // Mock GPU metrics fetch
    const mockGpuMetrics = jest.fn().mockResolvedValue(MOCK_GPU_METRICS);
    (fetchGpuMetrics as jest.Mock).mockImplementation(() => ({
      type: 'metrics/fetchGpuMetrics/fulfilled',
      payload: MOCK_GPU_METRICS
    }));

    // Render hook
    const { result, waitForNextUpdate } = renderHook(
      () => useMetrics({ pollingInterval: TEST_POLLING_INTERVAL }),
      { wrapper }
    );

    // Initial state check
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeUndefined();

    // Wait for first update
    await waitForNextUpdate();

    // Verify metrics were fetched
    expect(result.current.gpuUtilization).toBe(MOCK_GPU_METRICS.gpuUtilization);
    expect(result.current.gpuTemperature).toBe(MOCK_GPU_METRICS.gpuTemperature);
    expect(result.current.isLoading).toBe(false);
  });

  it('should poll metrics at specified interval', async () => {
    // Mock GPU metrics fetch
    (fetchGpuMetrics as jest.Mock).mockImplementation(() => ({
      type: 'metrics/fetchGpuMetrics/fulfilled',
      payload: MOCK_GPU_METRICS
    }));

    // Render hook
    const { result, waitForNextUpdate } = renderHook(
      () => useMetrics({ pollingInterval: TEST_POLLING_INTERVAL }),
      { wrapper }
    );

    // Wait for initial fetch
    await waitForNextUpdate();

    // Advance timers and verify multiple fetches
    await act(async () => {
      jest.advanceTimersByTime(TEST_POLLING_INTERVAL * 3);
    });

    // Verify fetch was called multiple times
    expect(fetchGpuMetrics).toHaveBeenCalledTimes(4); // Initial + 3 polls
    expect(result.current.temperatureHistory.length).toBeGreaterThan(0);
  });

  it('should handle temperature threshold alerts', async () => {
    // Mock high temperature metrics
    const highTempMetrics = {
      ...MOCK_GPU_METRICS,
      gpuTemperature: 78 // Above warning threshold
    };

    (fetchGpuMetrics as jest.Mock).mockImplementation(() => ({
      type: 'metrics/fetchGpuMetrics/fulfilled',
      payload: highTempMetrics
    }));

    // Render hook with temperature threshold
    const { result, waitForNextUpdate } = renderHook(
      () => useMetrics({ 
        pollingInterval: TEST_POLLING_INTERVAL,
        temperatureThreshold: TEMPERATURE_WARNING_THRESHOLD 
      }),
      { wrapper }
    );

    // Wait for update
    await waitForNextUpdate();

    // Verify temperature warning
    expect(result.current.isOverheating).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('GPU temperature critical: 78°C')
    );

    // Test critical temperature
    const criticalTempMetrics = {
      ...MOCK_GPU_METRICS,
      gpuTemperature: 87 // Above critical threshold
    };

    act(() => {
      (fetchGpuMetrics as jest.Mock).mockImplementation(() => ({
        type: 'metrics/fetchGpuMetrics/fulfilled',
        payload: criticalTempMetrics
      }));
      jest.advanceTimersByTime(TEST_POLLING_INTERVAL);
    });

    await waitForNextUpdate();

    // Verify critical temperature alert
    expect(result.current.isOverheating).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('GPU temperature critical: 87°C')
    );
  });

  it('should handle errors gracefully', async () => {
    // Mock fetch failure
    const mockError = new Error('Failed to fetch metrics');
    (fetchGpuMetrics as jest.Mock).mockRejectedValueOnce(mockError);

    // Render hook
    const { result, waitForNextUpdate } = renderHook(
      () => useMetrics({ pollingInterval: TEST_POLLING_INTERVAL }),
      { wrapper }
    );

    // Wait for error state
    await waitForNextUpdate();

    // Verify error handling
    expect(result.current.error).toBe('Failed to fetch metrics');
    expect(result.current.isLoading).toBe(false);

    // Mock successful retry
    (fetchGpuMetrics as jest.Mock).mockImplementation(() => ({
      type: 'metrics/fetchGpuMetrics/fulfilled',
      payload: MOCK_GPU_METRICS
    }));

    // Advance timer to trigger retry
    act(() => {
      jest.advanceTimersByTime(TEST_POLLING_INTERVAL);
    });

    await waitForNextUpdate();

    // Verify recovery
    expect(result.current.error).toBeUndefined();
    expect(result.current.gpuTemperature).toBe(MOCK_GPU_METRICS.gpuTemperature);
  });
});
import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';

// Internal imports
import Dashboard from '../../src/pages/Dashboard';
import { useMetrics, DEFAULT_POLLING_INTERVAL } from '../../src/hooks/useMetrics';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock child components
vi.mock('../../src/components/common/Navbar', () => ({
  default: () => <div data-testid="mock-navbar">Navbar</div>
}));

vi.mock('../../src/components/dashboard/Overview', () => ({
  default: ({ onError }: { onError: (error: Error) => void }) => (
    <div data-testid="mock-overview">Overview</div>
  )
}));

vi.mock('../../src/components/dashboard/GPUMetrics', () => ({
  default: ({ pollingInterval, showTemperature }: any) => (
    <div data-testid="mock-gpu-metrics">GPU Metrics</div>
  )
}));

// Mock Redux store
const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      metrics: (state = preloadedState) => state
    },
    preloadedState
  });
};

// Test constants
const TEST_POLLING_INTERVAL = 1000;
const MOCK_GPU_METRICS = {
  gpuUtilization: 75,
  gpuMemoryUsage: 82,
  temperature: 78
};
const MOCK_ERROR_MESSAGE = 'Failed to fetch metrics';
const TEMPERATURE_THRESHOLDS = {
  warning: 75,
  critical: 85
};

// Enhanced render utility with store provider
const renderWithProviders = (
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    // Add accessibility testing utility
    async checkAccessibility() {
      const results = await axe(document.body);
      expect(results).toHaveNoViolations();
    }
  };
};

describe('Dashboard', () => {
  // Mock metrics hook
  const mockMetrics = {
    gpuUtilization: MOCK_GPU_METRICS.gpuUtilization,
    gpuTemperature: MOCK_GPU_METRICS.temperature,
    isOverheating: false,
    error: null,
    isLoading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMetrics).mockReturnValue(mockMetrics);
  });

  it('should render all dashboard components correctly', async () => {
    const { checkAccessibility } = renderWithProviders(<Dashboard />);

    // Verify main components are rendered
    expect(screen.getByTestId('mock-navbar')).toBeInTheDocument();
    expect(screen.getByTestId('mock-overview')).toBeInTheDocument();
    expect(screen.getByTestId('mock-gpu-metrics')).toBeInTheDocument();

    // Verify page title
    expect(screen.getByRole('heading', { name: /system dashboard/i })).toBeInTheDocument();

    // Check accessibility
    await checkAccessibility();
  });

  it('should handle metrics loading state', async () => {
    vi.mocked(useMetrics).mockReturnValue({
      ...mockMetrics,
      isLoading: true
    });

    renderWithProviders(<Dashboard />);

    // Verify loading indicator
    const loadingElement = screen.getByRole('status', { name: /loading dashboard data/i });
    expect(loadingElement).toBeInTheDocument();
  });

  it('should handle metrics error state', async () => {
    vi.mocked(useMetrics).mockReturnValue({
      ...mockMetrics,
      error: MOCK_ERROR_MESSAGE
    });

    renderWithProviders(<Dashboard />);

    // Verify error message
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveTextContent(MOCK_ERROR_MESSAGE);
  });

  it('should handle temperature threshold warnings', async () => {
    vi.mocked(useMetrics).mockReturnValue({
      ...mockMetrics,
      gpuTemperature: TEMPERATURE_THRESHOLDS.critical + 1,
      isOverheating: true
    });

    renderWithProviders(<Dashboard />);

    // Verify temperature warning
    const warningAlert = screen.getByRole('alert');
    expect(warningAlert).toBeInTheDocument();
    expect(warningAlert).toHaveTextContent(/temperature exceeds critical threshold/i);
  });

  it('should update metrics on polling interval', async () => {
    const { rerender } = renderWithProviders(<Dashboard />);

    // Fast-forward timers and trigger polling
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_POLLING_INTERVAL);
    });

    // Verify metrics are updated
    expect(useMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        pollingInterval: DEFAULT_POLLING_INTERVAL,
        enabled: true
      })
    );
  });

  it('should handle component errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('Component error');

    vi.mocked(useMetrics).mockImplementation(() => {
      throw testError;
    });

    renderWithProviders(<Dashboard />);

    // Verify error boundary catches the error
    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveTextContent(/error loading dashboard/i);

    // Verify error is logged
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('should optimize performance with visibility change', async () => {
    renderWithProviders(<Dashboard />);

    // Simulate tab visibility change
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Verify polling rate is adjusted
    await waitFor(() => {
      expect(useMetrics).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true
        })
      );
    });
  });

  it('should be keyboard navigable', async () => {
    const { checkAccessibility } = renderWithProviders(<Dashboard />);
    const user = userEvent.setup();

    // Tab through interactive elements
    await user.tab();
    expect(document.activeElement).toHaveAttribute('role', 'navigation');

    // Verify focus management
    await user.tab();
    expect(document.activeElement).toHaveAttribute('role', 'region');

    // Check accessibility after interaction
    await checkAccessibility();
  });
});
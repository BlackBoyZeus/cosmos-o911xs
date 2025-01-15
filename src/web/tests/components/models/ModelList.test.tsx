import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';

// Internal imports
import ModelList from '../../../src/components/models/ModelList';
import { useModels } from '../../../src/hooks/useModels';
import { useAuth } from '../../../src/hooks/useAuth';
import { ModelType, Status } from '../../../src/types/common';

// Mock hooks
vi.mock('../../../src/hooks/useModels');
vi.mock('../../../src/hooks/useAuth');
vi.mock('@cosmos/gpu-metrics', () => ({
  useGPUMetrics: () => ({
    utilization: 75,
    memoryUsed: 32,
    temperature: 65
  })
}));
vi.mock('@cosmos/safety-guardrails', () => ({
  useSafetyGuardrails: () => ({
    preCheckPassed: true,
    postCheckPassed: true,
    warnings: []
  })
}));

// Test data
const mockModels = [
  {
    id: '1',
    name: 'Diffusion-7B',
    description: 'Base diffusion model',
    architecture: {
      type: ModelType.DIFFUSION,
      parameters: 7,
      version: '1.0.0'
    },
    status: Status.COMPLETED,
    performance: {
      generationTime: 380,
      gpuMemoryUsage: 74.0,
      psnr: 32.80
    }
  },
  {
    id: '2',
    name: 'Autoregressive-4B',
    description: 'Base autoregressive model',
    architecture: {
      type: ModelType.AUTOREGRESSIVE,
      parameters: 4,
      version: '1.0.0'
    },
    status: Status.PROCESSING,
    performance: {
      generationTime: 62,
      gpuMemoryUsage: 31.3,
      psnr: 28.17
    }
  }
];

// Helper function to render component with providers
const renderWithProviders = (
  component: React.ReactElement,
  {
    initialState = {},
    store = configureStore({
      reducer: { auth: (state = {}) => state },
      preloadedState: initialState
    })
  } = {}
) => {
  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
  };
};

describe('ModelList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useModels as jest.Mock).mockReturnValue({
      models: mockModels,
      loading: false,
      error: null,
      gpuMetrics: {
        utilization: 75,
        memoryUsed: 32
      }
    });
    (useAuth as jest.Mock).mockReturnValue({
      hasPermission: () => true,
      user: { role: 'RESEARCHER' }
    });
  });

  it('handles authentication and authorization correctly', async () => {
    // Test unauthorized access
    (useAuth as jest.Mock).mockReturnValue({
      hasPermission: () => false,
      user: null
    });

    renderWithProviders(<ModelList />);
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();

    // Test authorized access
    (useAuth as jest.Mock).mockReturnValue({
      hasPermission: () => true,
      user: { role: 'RESEARCHER' }
    });

    renderWithProviders(<ModelList />);
    expect(screen.getByText('Diffusion-7B')).toBeInTheDocument();
  });

  it('displays GPU metrics correctly', async () => {
    renderWithProviders(<ModelList />);

    await waitFor(() => {
      expect(screen.getByText(/GPU Utilization: 75%/i)).toBeInTheDocument();
      expect(screen.getByText(/Memory Usage: 32GB/i)).toBeInTheDocument();
    });

    // Test warning thresholds
    (useModels as jest.Mock).mockReturnValue({
      ...mockModels,
      gpuMetrics: {
        utilization: 95,
        memoryUsed: 75
      }
    });

    renderWithProviders(<ModelList />);
    expect(screen.getByText(/95%/i)).toHaveStyle({ color: 'error.main' });
  });

  it('integrates with safety guardrails', async () => {
    const mockGuardrails = {
      preCheckPassed: false,
      postCheckPassed: true,
      warnings: ['Resource limit exceeded']
    };

    vi.mock('@cosmos/safety-guardrails', () => ({
      useSafetyGuardrails: () => mockGuardrails
    }));

    renderWithProviders(<ModelList />);

    await waitFor(() => {
      expect(screen.getByText(/Resource limit exceeded/i)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveAttribute('aria-label', 'Safety Warning');
    });
  });

  it('handles model filtering correctly', async () => {
    renderWithProviders(<ModelList />);

    // Test search filtering
    const searchInput = screen.getByLabelText(/Search Models/i);
    fireEvent.change(searchInput, { target: { value: 'Diffusion' } });

    await waitFor(() => {
      expect(screen.getByText('Diffusion-7B')).toBeInTheDocument();
      expect(screen.queryByText('Autoregressive-4B')).not.toBeInTheDocument();
    });

    // Test architecture filtering
    const architectureSelect = screen.getByLabelText(/Architecture/i);
    fireEvent.mouseDown(architectureSelect);
    const diffusionOption = screen.getByText(/DIFFUSION/i);
    fireEvent.click(diffusionOption);

    await waitFor(() => {
      expect(screen.getByText('Diffusion-7B')).toBeInTheDocument();
      expect(screen.queryByText('Autoregressive-4B')).not.toBeInTheDocument();
    });
  });

  it('handles model selection correctly', async () => {
    const onModelSelect = vi.fn();
    renderWithProviders(<ModelList onModelSelect={onModelSelect} />);

    const modelCard = screen.getByText('Diffusion-7B').closest('[role="button"]');
    fireEvent.click(modelCard!);

    expect(onModelSelect).toHaveBeenCalledWith(mockModels[0]);
  });

  it('displays loading and error states correctly', async () => {
    // Test loading state
    (useModels as jest.Mock).mockReturnValue({
      models: [],
      loading: true,
      error: null
    });

    renderWithProviders(<ModelList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Test error state
    (useModels as jest.Mock).mockReturnValue({
      models: [],
      loading: false,
      error: { message: 'Failed to fetch models' }
    });

    renderWithProviders(<ModelList />);
    expect(screen.getByText(/Failed to fetch models/i)).toBeInTheDocument();
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithProviders(<ModelList />);
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Test keyboard navigation
    const firstModelCard = screen.getByText('Diffusion-7B').closest('[role="button"]');
    firstModelCard?.focus();
    expect(document.activeElement).toBe(firstModelCard);

    // Test screen reader content
    expect(screen.getByLabelText(/model list/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search models/i)).toBeInTheDocument();
  });

  it('handles pagination correctly', async () => {
    const manyModels = Array.from({ length: 50 }, (_, i) => ({
      ...mockModels[0],
      id: `model-${i}`,
      name: `Model ${i}`
    }));

    (useModels as jest.Mock).mockReturnValue({
      models: manyModels,
      loading: false,
      error: null
    });

    const { container } = renderWithProviders(<ModelList />);

    // Check virtualization
    const virtualizedGrid = container.querySelector('.react-window-grid');
    expect(virtualizedGrid).toBeInTheDocument();

    // Scroll and check for new items
    const gridContainer = screen.getByTestId('model-grid-container');
    fireEvent.scroll(gridContainer, { target: { scrollY: 500 } });

    await waitFor(() => {
      expect(screen.getByText(/Model 20/i)).toBeInTheDocument();
    });
  });
});
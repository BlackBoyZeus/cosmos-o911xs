import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { axe } from '@axe-core/react';
import { ErrorBoundary } from 'react-error-boundary';

// Component under test
import Overview from '../../src/components/dashboard/Overview';

// Mock child components
jest.mock('../../src/components/dashboard/SystemHealth', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ refreshInterval }) => (
    <div data-testid="system-health">System Health</div>
  ))
}));

jest.mock('../../src/components/dashboard/GPUMetrics', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ refreshInterval }) => (
    <div data-testid="gpu-metrics">GPU Metrics</div>
  ))
}));

jest.mock('../../src/components/dashboard/ResourceUsage', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ refreshInterval }) => (
    <div data-testid="resource-usage">Resource Usage</div>
  ))
}));

jest.mock('../../src/components/dashboard/JobQueue', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => (
    <div data-testid="job-queue">Job Queue</div>
  ))
}));

jest.mock('../../src/components/dashboard/ModelMetrics', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ refreshInterval }) => (
    <div data-testid="model-metrics">Model Metrics</div>
  ))
}));

describe('Overview Dashboard Component', () => {
  const defaultProps = {
    refreshInterval: 30000,
    onError: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should render all dashboard components', async () => {
    const { container } = render(<Overview {...defaultProps} />);

    // Verify all components are rendered
    expect(screen.getByTestId('system-health')).toBeInTheDocument();
    expect(screen.getByTestId('gpu-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('resource-usage')).toBeInTheDocument();
    expect(screen.getByTestId('job-queue')).toBeInTheDocument();
    expect(screen.getByTestId('model-metrics')).toBeInTheDocument();

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle refresh interval prop correctly', () => {
    const customInterval = 60000;
    render(<Overview refreshInterval={customInterval} onError={defaultProps.onError} />);

    // Verify interval is passed to child components
    const SystemHealth = require('../../src/components/dashboard/SystemHealth').default;
    const GPUMetrics = require('../../src/components/dashboard/GPUMetrics').default;
    const ResourceUsage = require('../../src/components/dashboard/ResourceUsage').default;
    const ModelMetrics = require('../../src/components/dashboard/ModelMetrics').default;

    expect(SystemHealth).toHaveBeenCalledWith(
      expect.objectContaining({ pollingInterval: customInterval }),
      expect.any(Object)
    );
    expect(GPUMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ pollingInterval: customInterval }),
      expect.any(Object)
    );
    expect(ResourceUsage).toHaveBeenCalledWith(
      expect.objectContaining({ pollingInterval: customInterval }),
      expect.any(Object)
    );
    expect(ModelMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ pollingInterval: customInterval }),
      expect.any(Object)
    );
  });

  it('should handle component errors gracefully', async () => {
    const errorMessage = 'Test error';
    const SystemHealth = require('../../src/components/dashboard/SystemHealth').default;
    SystemHealth.mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    render(
      <ErrorBoundary fallback={<div>Error Boundary Fallback</div>}>
        <Overview {...defaultProps} />
      </ErrorBoundary>
    );

    // Verify error boundary catches error and displays fallback
    await waitFor(() => {
      expect(screen.getByText('Error Boundary Fallback')).toBeInTheDocument();
    });

    // Verify error callback is called
    expect(defaultProps.onError).toHaveBeenCalledWith(
      expect.any(Error),
      'system-health'
    );
  });

  it('should be responsive', async () => {
    // Mock different viewport sizes
    const { rerender } = render(<Overview {...defaultProps} />);

    // Test mobile viewport
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    rerender(<Overview {...defaultProps} />);

    // Verify mobile layout adjustments
    const mobileContainer = screen.getByRole('main');
    expect(mobileContainer).toHaveStyle({ gridTemplateColumns: '1fr' });

    // Test desktop viewport
    window.innerWidth = 1200;
    window.dispatchEvent(new Event('resize'));
    rerender(<Overview {...defaultProps} />);

    // Verify desktop layout adjustments
    const desktopContainer = screen.getByRole('main');
    expect(desktopContainer).toHaveStyle({ gridTemplateColumns: 'repeat(2, 1fr)' });
  });

  it('should maintain component state during updates', async () => {
    const { rerender } = render(<Overview {...defaultProps} />);

    // Simulate metric update
    const newProps = {
      ...defaultProps,
      refreshInterval: 45000
    };

    rerender(<Overview {...newProps} />);

    // Verify components maintain their state
    expect(screen.getByTestId('system-health')).toBeInTheDocument();
    expect(screen.getByTestId('gpu-metrics')).toBeInTheDocument();
    expect(screen.getByTestId('resource-usage')).toBeInTheDocument();
    expect(screen.getByTestId('job-queue')).toBeInTheDocument();
    expect(screen.getByTestId('model-metrics')).toBeInTheDocument();
  });

  it('should handle multiple error boundaries independently', async () => {
    const GPUMetrics = require('../../src/components/dashboard/GPUMetrics').default;
    const ResourceUsage = require('../../src/components/dashboard/ResourceUsage').default;

    GPUMetrics.mockImplementationOnce(() => {
      throw new Error('GPU Metrics Error');
    });

    ResourceUsage.mockImplementationOnce(() => {
      throw new Error('Resource Usage Error');
    });

    render(<Overview {...defaultProps} />);

    // Verify each error boundary handles its error independently
    await waitFor(() => {
      expect(screen.getByText(/GPU Metrics Error/)).toBeInTheDocument();
      expect(screen.getByText(/Resource Usage Error/)).toBeInTheDocument();
      expect(screen.getByTestId('job-queue')).toBeInTheDocument();
      expect(screen.getByTestId('model-metrics')).toBeInTheDocument();
    });

    // Verify error callbacks are called for each error
    expect(defaultProps.onError).toHaveBeenCalledTimes(2);
  });
});
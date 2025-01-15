import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Provider } from 'react-redux';
import { axe, toHaveNoViolations } from 'jest-axe';
import { renderHook } from '@testing-library/react-hooks';

// Internal imports
import GenerationForm from '../../../src/components/generation/GenerationForm';
import { useGeneration } from '../../../src/hooks/useGeneration';
import { Status } from '../../../src/types/common';
import { createMockStore } from '../../utils/testUtils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock the generation hook
jest.mock('../../../src/hooks/useGeneration');

describe('GenerationForm', () => {
  // Mock handlers
  const mockOnSuccess = jest.fn();
  const mockOnError = jest.fn();
  
  // Mock store
  const mockStore = createMockStore({
    generation: {
      safetySettings: {
        enableFaceBlur: true,
        contentFiltering: true,
        autoRemediate: true
      }
    }
  });

  // Mock performance metrics
  const mockPerformanceMetrics = {
    gpuUtilization: 75,
    memoryUsage: 32.5,
    processingLatency: 450
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock generation hook implementation
    (useGeneration as jest.Mock).mockImplementation(() => ({
      submitRequest: jest.fn(),
      loading: false,
      progress: 0,
      generationStatus: Status.PENDING,
      performanceMetrics: mockPerformanceMetrics
    }));
  });

  it('renders form elements with correct accessibility attributes', async () => {
    const { container } = render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify form elements
    expect(screen.getByLabelText(/model type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/generation prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resolution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/frame count/i)).toBeInTheDocument();
    expect(screen.getByText(/safety settings/i)).toBeInTheDocument();
  });

  it('validates required fields and safety settings', async () => {
    const { submitRequest } = renderHook(() => useGeneration()).result.current;

    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Submit empty form
    fireEvent.click(screen.getByText(/generate video/i));

    // Check validation errors
    expect(screen.getByText(/prompt is required/i)).toBeInTheDocument();
    expect(submitRequest).not.toHaveBeenCalled();

    // Disable face blur and submit
    const faceBlurSwitch = screen.getByLabelText(/enable face blur/i);
    fireEvent.click(faceBlurSwitch);
    fireEvent.click(screen.getByText(/generate video/i));

    expect(screen.getByText(/face blur must be enabled/i)).toBeInTheDocument();
  });

  it('handles form submission with valid data', async () => {
    const { submitRequest } = renderHook(() => useGeneration()).result.current;

    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Fill form with valid data
    fireEvent.change(screen.getByLabelText(/generation prompt/i), {
      target: { value: 'Test generation prompt' }
    });

    fireEvent.change(screen.getByLabelText(/frame count/i), {
      target: { value: '57' }
    });

    // Submit form
    fireEvent.click(screen.getByText(/generate video/i));

    await waitFor(() => {
      expect(submitRequest).toHaveBeenCalledWith(expect.objectContaining({
        prompt: 'Test generation prompt',
        frameCount: 57,
        safetySettings: {
          enableFaceBlur: true,
          contentFiltering: true,
          autoRemediate: true
        }
      }));
    });
  });

  it('displays generation progress and performance metrics', async () => {
    // Mock loading state
    (useGeneration as jest.Mock).mockImplementation(() => ({
      submitRequest: jest.fn(),
      loading: true,
      progress: 45,
      generationStatus: Status.PROCESSING,
      performanceMetrics: mockPerformanceMetrics
    }));

    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
          telemetryEnabled={true}
        />
      </Provider>
    );

    // Check progress display
    expect(screen.getByText(/generation progress: 45%/i)).toBeInTheDocument();

    // Verify performance metrics
    expect(screen.getByText(/gpu utilization: 75%/i)).toBeInTheDocument();
    expect(screen.getByText(/memory usage: 32.5gb/i)).toBeInTheDocument();
  });

  it('handles generation errors correctly', async () => {
    const mockError = new Error('Generation failed');
    const { submitRequest } = renderHook(() => useGeneration()).result.current;
    (submitRequest as jest.Mock).mockRejectedValue(mockError);

    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Fill and submit form
    fireEvent.change(screen.getByLabelText(/generation prompt/i), {
      target: { value: 'Test prompt' }
    });
    fireEvent.click(screen.getByText(/generate video/i));

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Generation failed');
    });
  });

  it('supports keyboard navigation and focus management', () => {
    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Tab through form elements
    const form = screen.getByRole('form');
    const elements = within(form).getAllByRole('textbox, combobox, spinbutton, switch, button');

    elements.forEach((element) => {
      element.focus();
      expect(element).toHaveFocus();
    });
  });

  it('preserves form state during model type changes', () => {
    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    // Fill form
    const promptInput = screen.getByLabelText(/generation prompt/i);
    fireEvent.change(promptInput, {
      target: { value: 'Test prompt' }
    });

    // Change model type
    const modelSelect = screen.getByLabelText(/model type/i);
    fireEvent.change(modelSelect, {
      target: { value: 'autoregressive' }
    });

    // Verify form state preserved
    expect(promptInput).toHaveValue('Test prompt');
  });

  it('validates frame count within allowed range', () => {
    render(
      <Provider store={mockStore}>
        <GenerationForm 
          onSuccess={mockOnSuccess}
          onError={mockOnError}
        />
      </Provider>
    );

    const frameInput = screen.getByLabelText(/frame count/i);

    // Test invalid values
    fireEvent.change(frameInput, { target: { value: '0' } });
    fireEvent.click(screen.getByText(/generate video/i));
    expect(screen.getByText(/frame count must be between 1 and 1000/i)).toBeInTheDocument();

    fireEvent.change(frameInput, { target: { value: '1001' } });
    fireEvent.click(screen.getByText(/generate video/i));
    expect(screen.getByText(/frame count must be between 1 and 1000/i)).toBeInTheDocument();

    // Test valid value
    fireEvent.change(frameInput, { target: { value: '57' } });
    expect(screen.queryByText(/frame count must be between 1 and 1000/i)).not.toBeInTheDocument();
  });
});
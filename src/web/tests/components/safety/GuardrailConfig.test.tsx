import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Component imports
import { GuardrailConfig } from '../../../src/components/safety/GuardrailConfig';

// Type imports
import {
  GuardType,
  SafetyCheckType,
  IGuardConfig,
  IMonitoringStatus,
  IAutoRemediation
} from '../../../src/interfaces/ISafety';

// Mock the useSafety hook
vi.mock('../../../src/hooks/useSafety', () => ({
  useSafety: vi.fn()
}));

// Mock the auth utility
vi.mock('../../../src/utils/auth', () => ({
  hasPermission: vi.fn()
}));

describe('GuardrailConfig', () => {
  // Default test props
  const defaultProps = {
    guardType: GuardType.PRE_GUARD,
    title: 'Pre-Guard Configuration',
    description: 'Configure input filtering safety checks',
    role: 'ADMIN',
    onConfigChange: vi.fn()
  };

  // Default guard configuration
  const defaultGuardConfig: IGuardConfig = {
    guardType: GuardType.PRE_GUARD,
    enabled: true,
    checks: [
      {
        checkType: SafetyCheckType.CONTENT_SAFETY,
        enabled: true,
        threshold: 0.8,
        autoRemediate: true
      },
      {
        checkType: SafetyCheckType.FACE_DETECTION,
        enabled: true,
        threshold: 0.9,
        autoRemediate: true
      },
      {
        checkType: SafetyCheckType.PHYSICAL_CONSISTENCY,
        enabled: true,
        threshold: 0.75,
        autoRemediate: false
      }
    ]
  };

  // Mock monitoring status
  const mockMonitoringStatus: IMonitoringStatus = {
    connected: true,
    lastUpdate: Date.now(),
    metrics: {
      totalChecks: 1000,
      passRate: 0.95,
      faceBlurCompliance: 1.0,
      contentBlockRate: 0.05,
      averageLatency: 150,
      checksByType: {
        [SafetyCheckType.CONTENT_SAFETY]: 400,
        [SafetyCheckType.FACE_DETECTION]: 400,
        [SafetyCheckType.PHYSICAL_CONSISTENCY]: 200
      }
    }
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup enhanced useSafety mock with monitoring
    const useSafetyMock = vi.requireMock('../../../src/hooks/useSafety').useSafety;
    useSafetyMock.mockReturnValue({
      guardConfig: defaultGuardConfig,
      updateConfig: vi.fn(),
      loading: false,
      monitoringStatus: mockMonitoringStatus,
      error: null,
      initiateRemediation: vi.fn()
    });

    // Setup auth mock
    const hasPermissionMock = vi.requireMock('../../../src/utils/auth').hasPermission;
    hasPermissionMock.mockReturnValue(true);
  });

  it('renders guard configuration with monitoring status', () => {
    render(<GuardrailConfig {...defaultProps} />);

    // Verify title and description
    expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.description)).toBeInTheDocument();

    // Verify monitoring status indicator
    expect(screen.getByText('Monitoring Active')).toBeInTheDocument();
    const statusIndicator = screen.getByTestId('monitoring-status-indicator');
    expect(statusIndicator).toHaveStyle({ backgroundColor: '#4caf50' });
  });

  it('handles safety check toggles correctly', async () => {
    const { useSafety } = vi.requireMock('../../../src/hooks/useSafety');
    const updateConfigMock = vi.fn();
    useSafety.mockReturnValue({
      ...useSafety(),
      updateConfig: updateConfigMock
    });

    render(<GuardrailConfig {...defaultProps} />);

    // Toggle content safety check
    const contentSafetyToggle = screen.getByLabelText(SafetyCheckType.CONTENT_SAFETY);
    fireEvent.click(contentSafetyToggle);

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledWith({
        ...defaultGuardConfig,
        checks: defaultGuardConfig.checks.map(check => 
          check.checkType === SafetyCheckType.CONTENT_SAFETY
            ? { ...check, enabled: !check.enabled }
            : check
        )
      });
    });
  });

  it('handles threshold adjustments with validation', async () => {
    const { useSafety } = vi.requireMock('../../../src/hooks/useSafety');
    const updateConfigMock = vi.fn();
    useSafety.mockReturnValue({
      ...useSafety(),
      updateConfig: updateConfigMock
    });

    render(<GuardrailConfig {...defaultProps} />);

    // Adjust face detection threshold
    const faceDetectionSlider = screen.getByLabelText(/Confidence threshold/i);
    fireEvent.change(faceDetectionSlider, { target: { value: '0.95' } });

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledWith({
        ...defaultGuardConfig,
        checks: defaultGuardConfig.checks.map(check =>
          check.checkType === SafetyCheckType.FACE_DETECTION
            ? { ...check, threshold: 0.95 }
            : check
        )
      });
    });
  });

  it('handles auto-remediation toggles with proper permissions', async () => {
    const { useSafety } = vi.requireMock('../../../src/hooks/useSafety');
    const updateConfigMock = vi.fn();
    useSafety.mockReturnValue({
      ...useSafety(),
      updateConfig: updateConfigMock
    });

    render(<GuardrailConfig {...defaultProps} />);

    // Toggle auto-remediation for physical consistency
    const remediationToggle = screen.getByLabelText('Auto-remediate');
    fireEvent.click(remediationToggle);

    await waitFor(() => {
      expect(updateConfigMock).toHaveBeenCalledWith({
        ...defaultGuardConfig,
        checks: defaultGuardConfig.checks.map(check =>
          check.checkType === SafetyCheckType.PHYSICAL_CONSISTENCY
            ? { ...check, autoRemediate: !check.autoRemediate }
            : check
        )
      });
    });
  });

  it('displays real-time monitoring metrics', async () => {
    render(<GuardrailConfig {...defaultProps} />);

    // Verify metrics display
    const metrics = mockMonitoringStatus.metrics!;
    expect(screen.getByText(`Pass Rate: ${metrics.passRate * 100}%`)).toBeInTheDocument();
    expect(screen.getByText(`Face Blur Compliance: ${metrics.faceBlurCompliance * 100}%`)).toBeInTheDocument();
    expect(screen.getByText(`Avg. Latency: ${metrics.averageLatency}ms`)).toBeInTheDocument();
  });

  it('handles error states gracefully', () => {
    const errorMessage = 'Failed to update configuration';
    const { useSafety } = vi.requireMock('../../../src/hooks/useSafety');
    useSafety.mockReturnValue({
      ...useSafety(),
      error: errorMessage
    });

    render(<GuardrailConfig {...defaultProps} />);

    // Verify error display
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('config-alert');
  });

  it('disables controls during loading state', () => {
    const { useSafety } = vi.requireMock('../../../src/hooks/useSafety');
    useSafety.mockReturnValue({
      ...useSafety(),
      loading: true
    });

    render(<GuardrailConfig {...defaultProps} />);

    // Verify disabled controls
    const toggles = screen.getAllByRole('switch');
    toggles.forEach(toggle => {
      expect(toggle).toBeDisabled();
    });

    const sliders = screen.getAllByRole('slider');
    sliders.forEach(slider => {
      expect(slider).toBeDisabled();
    });

    // Verify loading indicator
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
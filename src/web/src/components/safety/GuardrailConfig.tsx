import React, { useCallback, useMemo, useEffect, memo } from 'react';
import {
  Switch,
  FormControlLabel,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Slider,
  Tooltip,
  Dialog
} from '@mui/material'; // ^5.0.0

// Internal imports
import Card from '../common/Card';
import {
  GuardType,
  SafetyCheckType,
  ISafetyCheckConfig,
  IGuardConfig,
  SafetyStatus
} from '../../interfaces/ISafety';
import { useSafety } from '../../hooks/useSafety';
import { hasPermission } from '../../utils/auth';

// Props interface for the GuardrailConfig component
interface GuardrailConfigProps {
  guardType: GuardType;
  title: string;
  description: string;
  role: string;
  onConfigChange: (config: IGuardConfig) => void;
}

// Default safety check configurations
const DEFAULT_SAFETY_CHECKS: ISafetyCheckConfig[] = [
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
];

// Enhanced GuardrailConfig component with monitoring and audit capabilities
export const GuardrailConfig = memo(({
  guardType,
  title,
  description,
  role,
  onConfigChange
}: GuardrailConfigProps) => {
  // Custom hook for safety management
  const {
    guardConfig,
    updateConfig,
    loading,
    monitoringStatus,
    error,
    initiateRemediation
  } = useSafety({
    enableRealTime: true,
    updateInterval: 5000,
    metricsEnabled: true
  });

  // Memoized configuration state
  const currentConfig = useMemo(() => guardConfig || {
    guardType,
    enabled: true,
    checks: DEFAULT_SAFETY_CHECKS
  }, [guardConfig, guardType]);

  // Handle configuration updates with validation
  const handleConfigUpdate = useCallback(async (updates: Partial<IGuardConfig>) => {
    try {
      if (!hasPermission('safety:update', { role })) {
        throw new Error('Insufficient permissions to update safety configuration');
      }

      const newConfig: IGuardConfig = {
        ...currentConfig,
        ...updates,
        guardType
      };

      // Validate thresholds
      newConfig.checks = newConfig.checks.map(check => ({
        ...check,
        threshold: Math.max(0, Math.min(1, check.threshold))
      }));

      await updateConfig(newConfig);
      onConfigChange(newConfig);
    } catch (err) {
      console.error('Failed to update guardrail config:', err);
    }
  }, [currentConfig, guardType, onConfigChange, role, updateConfig]);

  // Handle safety check toggle
  const handleCheckToggle = useCallback((checkType: SafetyCheckType) => {
    const updatedChecks = currentConfig.checks.map(check =>
      check.checkType === checkType ? { ...check, enabled: !check.enabled } : check
    );
    handleConfigUpdate({ checks: updatedChecks });
  }, [currentConfig.checks, handleConfigUpdate]);

  // Handle threshold change
  const handleThresholdChange = useCallback((checkType: SafetyCheckType, value: number) => {
    const updatedChecks = currentConfig.checks.map(check =>
      check.checkType === checkType ? { ...check, threshold: value } : check
    );
    handleConfigUpdate({ checks: updatedChecks });
  }, [currentConfig.checks, handleConfigUpdate]);

  // Handle auto-remediation toggle
  const handleAutoRemediateToggle = useCallback((checkType: SafetyCheckType) => {
    const updatedChecks = currentConfig.checks.map(check =>
      check.checkType === checkType ? { ...check, autoRemediate: !check.autoRemediate } : check
    );
    handleConfigUpdate({ checks: updatedChecks });
  }, [currentConfig.checks, handleConfigUpdate]);

  // Monitor status changes
  useEffect(() => {
    if (monitoringStatus?.metrics) {
      console.debug('Safety metrics updated:', monitoringStatus.metrics);
    }
  }, [monitoringStatus]);

  return (
    <Card>
      <div className="guardrail-config">
        <div className="guardrail-header">
          <h2>{title}</h2>
          <p>{description}</p>
          {error && (
            <Alert severity="error" className="config-alert">
              {error}
            </Alert>
          )}
        </div>

        <div className="guardrail-status">
          <FormControlLabel
            control={
              <Switch
                checked={currentConfig.enabled}
                onChange={() => handleConfigUpdate({ enabled: !currentConfig.enabled })}
                disabled={loading}
                color="primary"
                data-testid="guard-enable-switch"
              />
            }
            label={`Enable ${guardType === GuardType.PRE_GUARD ? 'Pre-Guard' : 'Post-Guard'}`}
          />

          {monitoringStatus?.connected && (
            <Tooltip title="Real-time monitoring active">
              <div className="monitoring-status">
                <span className="status-indicator" />
                Monitoring Active
              </div>
            </Tooltip>
          )}
        </div>

        <div className="safety-checks">
          {currentConfig.checks.map((check) => (
            <div key={check.checkType} className="safety-check-item">
              <div className="check-header">
                <FormControlLabel
                  control={
                    <Switch
                      checked={check.enabled}
                      onChange={() => handleCheckToggle(check.checkType)}
                      disabled={loading || !currentConfig.enabled}
                      color="primary"
                    />
                  }
                  label={check.checkType}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={check.autoRemediate}
                      onChange={() => handleAutoRemediateToggle(check.checkType)}
                      disabled={loading || !check.enabled}
                      color="secondary"
                    />
                  }
                  label="Auto-remediate"
                />
              </div>

              <div className="threshold-slider">
                <Tooltip title={`Confidence threshold: ${check.threshold}`}>
                  <Slider
                    value={check.threshold}
                    onChange={(_, value) => handleThresholdChange(check.checkType, value as number)}
                    disabled={loading || !check.enabled}
                    min={0}
                    max={1}
                    step={0.05}
                    marks
                    valueLabelDisplay="auto"
                  />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="loading-overlay">
            <CircularProgress />
          </div>
        )}
      </div>

      <style jsx>{`
        .guardrail-config {
          position: relative;
          padding: 20px;
        }

        .guardrail-header {
          margin-bottom: 24px;
        }

        .guardrail-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .monitoring-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #4caf50;
        }

        .safety-checks {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .safety-check-item {
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
        }

        .check-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .threshold-slider {
          padding: 0 12px;
        }

        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: rgba(255, 255, 255, 0.7);
        }

        .config-alert {
          margin-top: 16px;
        }
      `}</style>
    </Card>
  );
});

GuardrailConfig.displayName = 'GuardrailConfig';

export default GuardrailConfig;
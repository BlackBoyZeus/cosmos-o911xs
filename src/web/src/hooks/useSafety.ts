// External imports
import { useDispatch, useSelector } from 'react-redux';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { debounce } from 'lodash';
import io, { Socket } from 'socket.io-client';

// Internal imports
import {
  GuardType,
  SafetyStatus,
  SafetyCheckType,
  ISafetyCheckConfig,
  ISafetyLog,
  IGuardConfig,
  ISafetyMetrics
} from '../interfaces/ISafety';
import { SafetyService } from '../services/safety';
import { Status } from '../types/common';

// Types for monitoring and remediation
interface IMonitoringStatus {
  connected: boolean;
  lastUpdate: number;
  metrics: ISafetyMetrics | null;
}

interface IRemediationStatus {
  inProgress: boolean;
  issueId: string | null;
  status: Status;
  error: string | null;
}

interface IMonitoringConfig {
  enableRealTime: boolean;
  updateInterval: number;
  metricsEnabled: boolean;
}

/**
 * Enhanced custom hook for comprehensive safety management including real-time monitoring
 * and auto-remediation capabilities
 */
export const useSafety = (monitoringConfig: IMonitoringConfig = {
  enableRealTime: true,
  updateInterval: 5000,
  metricsEnabled: true
}) => {
  // Local state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [guardConfig, setGuardConfig] = useState<IGuardConfig | null>(null);
  const [safetyLogs, setSafetyLogs] = useState<ISafetyLog[]>([]);
  const [metrics, setMetrics] = useState<ISafetyMetrics | null>(null);
  const [monitoringStatus, setMonitoringStatus] = useState<IMonitoringStatus>({
    connected: false,
    lastUpdate: 0,
    metrics: null
  });
  const [remediationStatus, setRemediationStatus] = useState<IRemediationStatus>({
    inProgress: false,
    issueId: null,
    status: Status.PENDING,
    error: null
  });

  // WebSocket reference
  const socketRef = useRef<Socket | null>(null);
  const dispatch = useDispatch();

  /**
   * Fetches and updates guard configuration
   */
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const config = await SafetyService.getGuardConfig(GuardType.PRE_GUARD);
      setGuardConfig(config);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch guard configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Updates guard configuration with validation
   */
  const updateConfig = useCallback(async (config: IGuardConfig) => {
    try {
      setLoading(true);
      const updatedConfig = await SafetyService.updateGuardConfig(config);
      setGuardConfig(updatedConfig);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update guard configuration');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches safety logs with filtering
   */
  const fetchLogs = useCallback(async (filters?: Record<string, unknown>) => {
    try {
      setLoading(true);
      const { logs } = await SafetyService.getSafetyLogs({
        page: 1,
        limit: 100,
        ...filters
      });
      setSafetyLogs(logs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch safety logs');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Runs pre-guard safety check
   */
  const runPreCheck = useCallback(async (content: any) => {
    try {
      setLoading(true);
      const result = await SafetyService.runPreGuardCheck(content);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pre-guard check failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Runs post-guard safety check
   */
  const runPostCheck = useCallback(async (content: any) => {
    try {
      setLoading(true);
      const result = await SafetyService.runPostGuardCheck(content);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Post-guard check failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches safety metrics with caching
   */
  const getMetrics = useCallback(async (timeRange: string) => {
    if (!monitoringConfig.metricsEnabled) return;
    
    try {
      const metrics = await SafetyService.getMetrics(timeRange);
      setMetrics(metrics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    }
  }, [monitoringConfig.metricsEnabled]);

  /**
   * Initiates auto-remediation for safety issues
   */
  const initiateRemediation = useCallback(async (issueId: string) => {
    try {
      setRemediationStatus({
        inProgress: true,
        issueId,
        status: Status.PROCESSING,
        error: null
      });

      const success = await SafetyService.initiateRemediation(issueId);
      
      setRemediationStatus({
        inProgress: false,
        issueId,
        status: success ? Status.COMPLETED : Status.FAILED,
        error: null
      });
    } catch (err) {
      setRemediationStatus({
        inProgress: false,
        issueId,
        status: Status.FAILED,
        error: err instanceof Error ? err.message : 'Remediation failed'
      });
      throw err;
    }
  }, []);

  /**
   * Debounced handler for real-time metric updates
   */
  const handleMetricsUpdate = useMemo(() => 
    debounce((metrics: ISafetyMetrics) => {
      setMonitoringStatus(prev => ({
        ...prev,
        lastUpdate: Date.now(),
        metrics
      }));
    }, 1000),
    []
  );

  /**
   * Connects to real-time monitoring WebSocket
   */
  const connectMonitoring = useCallback(() => {
    if (!monitoringConfig.enableRealTime || socketRef.current?.connected) return;

    const socket = io(process.env.REACT_APP_WS_URL || '', {
      path: '/safety-monitoring',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      setMonitoringStatus(prev => ({
        ...prev,
        connected: true
      }));
    });

    socket.on('metrics', handleMetricsUpdate);

    socket.on('disconnect', () => {
      setMonitoringStatus(prev => ({
        ...prev,
        connected: false
      }));
    });

    socketRef.current = socket;
  }, [monitoringConfig.enableRealTime, handleMetricsUpdate]);

  /**
   * Disconnects from monitoring WebSocket
   */
  const disconnectMonitoring = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setMonitoringStatus({
        connected: false,
        lastUpdate: 0,
        metrics: null
      });
    }
  }, []);

  // Initialize monitoring on mount if enabled
  useEffect(() => {
    if (monitoringConfig.enableRealTime) {
      connectMonitoring();
    }
    return () => {
      disconnectMonitoring();
    };
  }, [monitoringConfig.enableRealTime, connectMonitoring, disconnectMonitoring]);

  // Fetch initial data
  useEffect(() => {
    fetchConfig();
    if (monitoringConfig.metricsEnabled) {
      getMetrics('1h');
    }
  }, [fetchConfig, getMetrics, monitoringConfig.metricsEnabled]);

  return {
    // State
    guardConfig,
    safetyLogs,
    metrics,
    monitoringStatus,
    remediationStatus,
    loading,
    error,

    // Actions
    fetchConfig,
    updateConfig,
    fetchLogs,
    runPreCheck,
    runPostCheck,
    getMetrics,
    initiateRemediation,
    connectMonitoring,
    disconnectMonitoring
  };
};
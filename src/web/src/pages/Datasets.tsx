import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import useWebSocket from 'react-use-websocket';
import { usePermissions } from '@cosmos/permissions';

// Internal imports
import { IDataset } from '../../interfaces/IDataset';
import { Status, ResourceType, SortOrder, PaginationParams } from '../types/common';

// Constants
const WEBSOCKET_URL = process.env.REACT_APP_WS_URL || 'wss://api.cosmos.ai/datasets/monitor';
const RETRY_INTERVAL = 5000;
const HEARTBEAT_INTERVAL = 30000;

interface DatasetMonitoringMessage {
  datasetId: string;
  metrics: {
    psnr: number;
    ssim: number;
    fid: number;
    fvd: number;
    processingProgress: number;
  };
  resourceMetrics: {
    gpuUtilization: number;
    memoryUsage: number;
    temperature: number;
  };
  status: Status;
  timestamp: number;
}

const Datasets: React.FC = () => {
  // State management
  const [datasets, setDatasets] = useState<IDataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: SortOrder.DESC,
    search: '',
    filters: {}
  });

  // Permissions hook
  const { hasPermission, checkPermission } = usePermissions();

  // WebSocket setup for real-time monitoring
  const { sendMessage, lastMessage, readyState } = useWebSocket(WEBSOCKET_URL, {
    heartbeat: {
      message: JSON.stringify({ type: 'ping' }),
      interval: HEARTBEAT_INTERVAL,
    },
    retryOnError: true,
    reconnectInterval: RETRY_INTERVAL,
    shouldReconnect: () => true,
  });

  // Memoized security headers
  const securityHeaders = useMemo(() => ({
    'X-CSRF-Token': localStorage.getItem('csrfToken'),
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
  }), []);

  // Dataset fetching with security and error handling
  const fetchDatasets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/datasets', {
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch datasets: ${response.statusText}`);
      }

      const data = await response.json();
      setDatasets(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch datasets'));
      console.error('Dataset fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [securityHeaders]);

  // Enhanced dataset creation with security checks
  const handleCreateDataset = useCallback(async (dataset: Partial<IDataset>) => {
    try {
      if (!hasPermission('CREATE_DATASET')) {
        throw new Error('Insufficient permissions to create dataset');
      }

      const response = await fetch('/api/datasets', {
        method: 'POST',
        headers: {
          ...securityHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataset),
      });

      if (!response.ok) {
        throw new Error(`Failed to create dataset: ${response.statusText}`);
      }

      await fetchDatasets();
      
      // Initialize monitoring for new dataset
      sendMessage(JSON.stringify({
        type: 'subscribe',
        datasetId: (await response.json()).id,
      }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create dataset'));
      console.error('Dataset creation error:', err);
    }
  }, [hasPermission, securityHeaders, fetchDatasets, sendMessage]);

  // Real-time monitoring handler
  const handleMonitoringUpdate = useCallback((message: DatasetMonitoringMessage) => {
    setDatasets(prevDatasets => prevDatasets.map(dataset => {
      if (dataset.id === message.datasetId) {
        return {
          ...dataset,
          metrics: {
            ...dataset.metrics,
            psnr: message.metrics.psnr,
            ssim: message.metrics.ssim,
            fid: message.metrics.fid,
            fvd: message.metrics.fvd,
          },
          processingProgress: message.metrics.processingProgress,
          status: message.status,
        };
      }
      return dataset;
    }));
  }, []);

  // WebSocket message handler
  useEffect(() => {
    if (lastMessage) {
      try {
        const message = JSON.parse(lastMessage.data);
        handleMonitoringUpdate(message);
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    }
  }, [lastMessage, handleMonitoringUpdate]);

  // Initial data fetch
  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  // Error boundary fallback component
  const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
    <div className="error-container">
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="datasets-container">
        <header className="datasets-header">
          <h1>Datasets Management</h1>
          {hasPermission('CREATE_DATASET') && (
            <button 
              className="create-dataset-btn"
              onClick={() => handleCreateDataset({})}
            >
              Create New Dataset
            </button>
          )}
        </header>

        {loading ? (
          <div className="loading-spinner">Loading datasets...</div>
        ) : error ? (
          <div className="error-message">{error.message}</div>
        ) : (
          <div className="datasets-grid">
            {datasets.map(dataset => (
              <div key={dataset.id} className="dataset-card">
                <h3>{dataset.name}</h3>
                <div className="dataset-metrics">
                  <div>PSNR: {dataset.metrics.psnr.toFixed(2)}</div>
                  <div>SSIM: {dataset.metrics.ssim.toFixed(2)}</div>
                  <div>FID: {dataset.metrics.fid.toFixed(2)}</div>
                  <div>FVD: {dataset.metrics.fvd.toFixed(2)}</div>
                </div>
                <div className="processing-status">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${dataset.processingProgress}%` }}
                    />
                  </div>
                  <span>{dataset.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default Datasets;
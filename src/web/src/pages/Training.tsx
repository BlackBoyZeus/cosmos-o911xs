import React, { useCallback, useEffect, useState } from 'react';
import { Grid, Box, Typography } from '@mui/material';

// Internal imports
import TrainingConfig from '../components/training/TrainingConfig';
import TrainingMetrics from '../components/training/TrainingMetrics';
import TrainingLogs from '../components/training/TrainingLogs';
import { useTraining } from '../hooks/useTraining';
import { ITraining } from '../interfaces/ITraining';
import { Status } from '../types/common';

// Constants for GPU monitoring
const GPU_TEMP_THRESHOLD = 80;
const GPU_MEMORY_THRESHOLD = 0.9;
const METRICS_POLLING_INTERVAL = 5000;

const Training: React.FC = () => {
  // State management
  const [modelId, setModelId] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);

  // Initialize training hook with auto-retry
  const {
    startTraining,
    stopTraining,
    trainingStatus,
    gpuMetrics,
    error: trainingError
  } = useTraining(modelId);

  // WebSocket setup for real-time updates
  useEffect(() => {
    if (modelId && !wsConnection) {
      const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/training/${modelId}`);
      
      ws.onopen = () => {
        console.debug('Training WebSocket connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.gpuTemperature > GPU_TEMP_THRESHOLD) {
          handleTrainingError(new Error(`GPU temperature critical: ${data.gpuTemperature}°C`));
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        handleTrainingError(new Error('WebSocket connection failed'));
      };

      setWsConnection(ws);

      return () => {
        ws.close();
        setWsConnection(null);
      };
    }
  }, [modelId]);

  // Memory cleanup interval
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (trainingStatus?.status === Status.COMPLETED || 
          trainingStatus?.status === Status.FAILED) {
        wsConnection?.close();
        setWsConnection(null);
      }
    }, 60000);

    return () => clearInterval(cleanup);
  }, [trainingStatus, wsConnection]);

  // Handle successful training completion
  const handleTrainingComplete = useCallback((training: ITraining) => {
    try {
      // Update status and cleanup
      if (wsConnection) {
        wsConnection.close();
        setWsConnection(null);
      }

      // Reset retry count
      setRetryCount(0);

      // Announce completion for screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'alert');
      announcement.textContent = 'Training completed successfully';
      document.body.appendChild(announcement);
      setTimeout(() => announcement.remove(), 1000);

    } catch (error) {
      console.error('Error in training completion handler:', error);
    }
  }, [wsConnection]);

  // Enhanced error handling with retry logic
  const handleTrainingError = useCallback((error: Error) => {
    console.error('Training error:', error);

    // Check if retry is possible
    if (retryCount < 3 && trainingStatus?.status === Status.PROCESSING) {
      setRetryCount(prev => prev + 1);
      console.log(`Retrying training... Attempt ${retryCount + 1}/3`);
      
      // Attempt recovery
      if (gpuMetrics?.temperature > GPU_TEMP_THRESHOLD) {
        stopTraining();
      }
    } else {
      // Create error announcement for screen readers
      const errorAnnouncement = document.createElement('div');
      errorAnnouncement.setAttribute('role', 'alert');
      errorAnnouncement.setAttribute('aria-live', 'assertive');
      errorAnnouncement.textContent = `Training error: ${error.message}`;
      document.body.appendChild(errorAnnouncement);
      setTimeout(() => errorAnnouncement.remove(), 1000);
    }
  }, [retryCount, trainingStatus, gpuMetrics, stopTraining]);

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom component="h1">
        Model Training
      </Typography>

      <Grid container spacing={3}>
        {/* Training Configuration */}
        <Grid item xs={12} md={6}>
          <TrainingConfig
            modelId={modelId}
            onComplete={handleTrainingComplete}
            onError={handleTrainingError}
            gpuConfig={{
              maxTemp: GPU_TEMP_THRESHOLD,
              maxMemory: GPU_MEMORY_THRESHOLD,
              throttleTemp: GPU_TEMP_THRESHOLD - 5
            }}
            safetyConfig={{
              enableGuardrails: true,
              autoRemediate: true
            }}
          />
        </Grid>

        {/* Training Metrics */}
        <Grid item xs={12} md={6}>
          <TrainingMetrics
            modelId={modelId}
            pollingInterval={METRICS_POLLING_INTERVAL}
            showGpuMetrics={true}
          />
        </Grid>

        {/* Training Logs */}
        <Grid item xs={12}>
          <TrainingLogs
            modelId={modelId}
            className="training-logs"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Training;
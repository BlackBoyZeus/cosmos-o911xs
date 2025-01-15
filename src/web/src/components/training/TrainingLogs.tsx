import React, { useCallback, useEffect, useRef } from 'react';
import { styled } from '@mui/material/styles';
import { Typography, LinearProgress } from '@mui/material';
import Card from '../common/Card';
import { useTraining } from '../../hooks/useTraining';
import { theme } from '../../assets/styles/theme';

// Styled components
const LogContainer = styled('div')({
  maxHeight: '400px',
  overflowY: 'auto',
  padding: theme.spacing(2),
  scrollBehavior: 'smooth',
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[1],
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.divider,
    borderRadius: '4px',
  },
});

const MetricRow = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
});

const ProgressContainer = styled('div')({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
});

// Props interface
interface TrainingLogsProps {
  modelId: string;
  className?: string;
  onError?: (error: Error) => void;
}

// Helper functions
const formatTime = (seconds: number): string => {
  if (!seconds || seconds < 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);

  return parts.join(' ');
};

const formatMetric = (value: number, unit: string): string => {
  if (isNaN(value)) return 'N/A';
  return `${value.toFixed(2)}${unit}`;
};

// Main component
export const TrainingLogs = React.memo<TrainingLogsProps>(({ 
  modelId, 
  className,
  onError 
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const { 
    trainingStatus, 
    trainingMetrics, 
    gpuMetrics, 
    error 
  } = useTraining(modelId);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [trainingMetrics]);

  // Error handling
  useEffect(() => {
    if (error && onError) {
      onError(new Error(error));
    }
  }, [error, onError]);

  // Calculate progress percentage
  const progress = trainingMetrics ? 
    (trainingMetrics.currentEpoch / trainingMetrics.maxEpochs) * 100 : 0;

  // Format GPU metrics for display
  const gpuUtilization = gpuMetrics?.utilization || 0;
  const gpuTemperature = gpuMetrics?.temperature || 0;
  const gpuMemoryUsage = gpuMetrics?.memoryUsage || 0;

  return (
    <Card className={className} elevation={2}>
      <Typography variant="h6" gutterBottom>
        Training Progress
      </Typography>

      <ProgressContainer>
        <LinearProgress
          variant="determinate"
          value={progress}
          aria-label="Training progress"
          aria-valuenow={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.palette.action.hover,
          }}
        />
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
          {`${Math.round(progress)}% Complete`}
        </Typography>
      </ProgressContainer>

      <LogContainer ref={logContainerRef} role="log">
        {trainingMetrics && (
          <>
            <MetricRow>
              <Typography variant="body2">Current Epoch:</Typography>
              <Typography variant="body2" color="primary">
                {`${trainingMetrics.currentEpoch}/${trainingMetrics.maxEpochs}`}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">Loss:</Typography>
              <Typography variant="body2">
                {formatMetric(trainingMetrics.loss, '')}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">Accuracy:</Typography>
              <Typography variant="body2">
                {formatMetric(trainingMetrics.accuracy * 100, '%')}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">GPU Utilization:</Typography>
              <Typography variant="body2" 
                color={gpuUtilization > 90 ? 'error' : 'textPrimary'}>
                {formatMetric(gpuUtilization, '%')}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">GPU Temperature:</Typography>
              <Typography variant="body2" 
                color={gpuTemperature > 80 ? 'error' : 'textPrimary'}>
                {formatMetric(gpuTemperature, '°C')}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">GPU Memory Usage:</Typography>
              <Typography variant="body2" 
                color={gpuMemoryUsage > 0.9 ? 'error' : 'textPrimary'}>
                {formatMetric(gpuMemoryUsage * 100, '%')}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">Samples/second:</Typography>
              <Typography variant="body2">
                {formatMetric(trainingMetrics.samplesPerSecond || 0, '/s')}
              </Typography>
            </MetricRow>

            <MetricRow>
              <Typography variant="body2">Time Remaining:</Typography>
              <Typography variant="body2">
                {formatTime(trainingMetrics.estimatedTimeRemaining)}
              </Typography>
            </MetricRow>
          </>
        )}

        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
      </LogContainer>
    </Card>
  );
});

TrainingLogs.displayName = 'TrainingLogs';

export default TrainingLogs;
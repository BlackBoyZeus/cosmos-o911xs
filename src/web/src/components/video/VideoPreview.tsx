import React, { useState, useCallback } from 'react';
import { Box, Typography, Chip, LinearProgress, IconButton } from '@mui/material';
import { withErrorBoundary } from 'react-error-boundary';
import RefreshIcon from '@mui/icons-material/Refresh';

// Internal imports
import VideoPlayer from './VideoPlayer';
import Card from '../common/Card';
import { Status } from '../../types/common';
import { formatMetricValue, formatResourceMetrics } from '../../utils/formatters';

// Interfaces
interface VideoPreviewProps {
  generationData: {
    id: string;
    status: Status;
    videoUrl: string;
    progress: number;
    estimatedTimeRemaining: number;
    metrics?: {
      psnr: number;
      fid: number;
      fvd: number;
      generationTime: number;
      resourceUtilization: {
        gpu: {
          utilization: number;
          used: number;
          total: number;
          temperature: number;
        };
      };
    };
  };
  className?: string;
  onError?: (error: Error) => void;
  onRetry?: () => void;
}

interface StatusConfig {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  label: string;
  ariaLabel: string;
}

// Helper function to get status configuration
const getStatusConfig = (status: Status): StatusConfig => {
  const configs: Record<Status, StatusConfig> = {
    [Status.PENDING]: {
      color: 'default',
      label: 'Pending',
      ariaLabel: 'Generation pending'
    },
    [Status.PROCESSING]: {
      color: 'primary',
      label: 'Processing',
      ariaLabel: 'Video generation in progress'
    },
    [Status.COMPLETED]: {
      color: 'success',
      label: 'Completed',
      ariaLabel: 'Generation completed successfully'
    },
    [Status.FAILED]: {
      color: 'error',
      label: 'Failed',
      ariaLabel: 'Generation failed'
    },
    [Status.CANCELLED]: {
      color: 'warning',
      label: 'Cancelled',
      ariaLabel: 'Generation cancelled by user'
    }
  };
  return configs[status];
};

const VideoPreview: React.FC<VideoPreviewProps> = ({
  generationData,
  className,
  onError,
  onRetry
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleVideoError = useCallback((error: Error) => {
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  const statusConfig = getStatusConfig(generationData.status);
  const isGenerating = generationData.status === Status.PROCESSING;
  const showVideo = generationData.status === Status.COMPLETED;

  return (
    <Card 
      className={className}
      elevation={2}
      role="region"
      aria-label="Video preview"
    >
      <Box sx={{ position: 'relative' }}>
        {showVideo && (
          <VideoPlayer
            src={generationData.videoUrl}
            autoPlay={false}
            controls={true}
            onError={handleVideoError}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            ariaLabel="Generated video preview"
          />
        )}

        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip
            label={statusConfig.label}
            color={statusConfig.color}
            aria-label={statusConfig.ariaLabel}
          />
          {generationData.status === Status.FAILED && onRetry && (
            <IconButton
              onClick={onRetry}
              aria-label="Retry generation"
              size="small"
            >
              <RefreshIcon />
            </IconButton>
          )}
        </Box>

        {isGenerating && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={generationData.progress}
              aria-label="Generation progress"
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
              Estimated time remaining: {Math.ceil(generationData.estimatedTimeRemaining)}s
            </Typography>
          </Box>
        )}

        {generationData.metrics && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quality Metrics
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  PSNR Score
                </Typography>
                <Typography>
                  {formatMetricValue(generationData.metrics.psnr, 'psnr')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  FID Score
                </Typography>
                <Typography>
                  {formatMetricValue(generationData.metrics.fid, 'fid')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  FVD Score
                </Typography>
                <Typography>
                  {formatMetricValue(generationData.metrics.fvd, 'fvd')}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Generation Time
                </Typography>
                <Typography>
                  {formatMetricValue(generationData.metrics.generationTime, 'generationtime')}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Resource Utilization
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  GPU: {formatResourceMetrics(generationData.metrics.resourceUtilization.gpu).utilization}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Temperature: {formatResourceMetrics(generationData.metrics.resourceUtilization.gpu).temperature}
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
};

// Export wrapped component with error boundary
export default withErrorBoundary(VideoPreview, {
  fallback: (props) => (
    <Card elevation={2}>
      <Typography color="error">
        Error loading video preview. Please try again.
      </Typography>
      {props.resetErrorBoundary && (
        <IconButton
          onClick={props.resetErrorBoundary}
          aria-label="Retry loading video"
          size="small"
          sx={{ mt: 1 }}
        >
          <RefreshIcon />
        </IconButton>
      )}
    </Card>
  )
});
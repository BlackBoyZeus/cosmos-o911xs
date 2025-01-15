import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Chip, IconButton, Skeleton } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ErrorBoundary } from 'react-error-boundary';
import RefreshIcon from '@mui/icons-material/Refresh';

// Internal imports
import Table, { SortDirection } from '../common/Table';
import VideoPreview from '../video/VideoPreview';
import { Status } from '../../types/common';
import { formatTimestamp, formatMetricValue } from '../../utils/formatters';

// Types and interfaces
interface IGenerationResponse {
  id: string;
  status: Status;
  createdAt: number;
  completedAt?: number;
  progress: number;
  estimatedTimeRemaining: number;
  videoUrl?: string;
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
  error?: string;
}

interface GenerationListProps {
  generations: IGenerationResponse[];
  loading: boolean;
  onSort: (column: string, direction: SortDirection) => void;
  onPageChange: (page: number) => void;
  onError: (error: Error) => void;
  virtualizationEnabled?: boolean;
  accessibilityLabels?: Record<string, string>;
}

// Status configuration for visual representation
const statusConfig: Record<Status, { color: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success', label: string }> = {
  [Status.PENDING]: { color: 'default', label: 'Pending' },
  [Status.PROCESSING]: { color: 'primary', label: 'Processing' },
  [Status.COMPLETED]: { color: 'success', label: 'Completed' },
  [Status.FAILED]: { color: 'error', label: 'Failed' },
  [Status.CANCELLED]: { color: 'warning', label: 'Cancelled' }
};

// Custom hook for polling generation status updates
const useGenerationPolling = (generations: IGenerationResponse[]) => {
  const [updatedGenerations, setUpdatedGenerations] = useState(generations);

  useEffect(() => {
    const processingGenerations = generations.filter(
      gen => gen.status === Status.PROCESSING || gen.status === Status.PENDING
    );

    if (processingGenerations.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        // In a real implementation, this would make an API call to get updates
        // For now, we just update the progress
        setUpdatedGenerations(prevGens => 
          prevGens.map(gen => {
            if (gen.status !== Status.PROCESSING) return gen;
            const newProgress = Math.min(gen.progress + 5, 100);
            return {
              ...gen,
              progress: newProgress,
              status: newProgress === 100 ? Status.COMPLETED : Status.PROCESSING
            };
          })
        );
      } catch (error) {
        console.error('Error polling generation status:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [generations]);

  return updatedGenerations;
};

const GenerationList: React.FC<GenerationListProps> = React.memo(({
  generations,
  loading,
  onSort,
  onPageChange,
  onError,
  virtualizationEnabled = true,
  accessibilityLabels = {}
}) => {
  const updatedGenerations = useGenerationPolling(generations);

  const columns = useMemo(() => [
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sortable: true,
      render: (status: Status) => (
        <Chip
          label={statusConfig[status].label}
          color={statusConfig[status].color}
          size="small"
          aria-label={accessibilityLabels[status] || statusConfig[status].label}
        />
      )
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      sortable: true,
      render: (timestamp: number) => formatTimestamp(timestamp)
    },
    {
      key: 'progress',
      title: 'Progress',
      dataIndex: 'progress',
      render: (progress: number, record: IGenerationResponse) => (
        record.status === Status.PROCESSING ? (
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            {`${progress.toFixed(1)}%`}
          </div>
        ) : '-'
      )
    },
    {
      key: 'metrics',
      title: 'Quality Metrics',
      dataIndex: 'metrics',
      render: (metrics: IGenerationResponse['metrics']) => (
        metrics ? (
          <div>
            <div>PSNR: {formatMetricValue(metrics.psnr, 'psnr')}</div>
            <div>FID: {formatMetricValue(metrics.fid, 'fid')}</div>
            <div>FVD: {formatMetricValue(metrics.fvd, 'fvd')}</div>
          </div>
        ) : '-'
      )
    },
    {
      key: 'preview',
      title: 'Preview',
      dataIndex: 'videoUrl',
      render: (videoUrl: string | undefined, record: IGenerationResponse) => (
        record.status === Status.COMPLETED && videoUrl ? (
          <VideoPreview
            generationData={{
              id: record.id,
              status: record.status,
              videoUrl,
              progress: record.progress,
              estimatedTimeRemaining: record.estimatedTimeRemaining,
              metrics: record.metrics
            }}
            onError={(error) => onError(error)}
          />
        ) : null
      )
    }
  ], [accessibilityLabels, onError]);

  const handleError = useCallback((error: Error) => {
    console.error('Generation list error:', error);
    onError(error);
  }, [onError]);

  if (loading) {
    return (
      <div role="status" aria-label="Loading generations">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={60}
            sx={{ my: 1 }}
            animation="wave"
          />
        ))}
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={({ error, resetErrorBoundary }) => (
        <div role="alert">
          <p>Error loading generations: {error.message}</p>
          <IconButton
            onClick={resetErrorBoundary}
            aria-label="Retry loading generations"
          >
            <RefreshIcon />
          </IconButton>
        </div>
      )}
      onError={handleError}
    >
      <Table
        columns={columns}
        data={updatedGenerations}
        onSort={onSort}
        onPageChange={onPageChange}
        virtualize={virtualizationEnabled}
        stickyHeader
        ariaLabel="Video generation requests"
      />
    </ErrorBoundary>
  );
});

GenerationList.displayName = 'GenerationList';

export default GenerationList;
export type { GenerationListProps, IGenerationResponse };
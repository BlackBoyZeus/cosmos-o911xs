import React, { useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import { Typography, Chip, Skeleton } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { useAnalytics } from '@cosmos/analytics';

// Internal imports
import { IDataset } from '../../interfaces/IDataset';
import Card from '../common/Card';
import theme from '../../assets/styles/theme';

// Styled components
const StyledContent = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  transition: 'all 0.3s ease-in-out',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '@media (max-width: 600px)': {
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  },
}));

const MetricsContainer = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: theme.spacing(2),
});

const MetricItem = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
});

const HeaderContainer = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
});

// Props interface
interface IDatasetCardProps {
  dataset: IDataset;
  onClick?: (id: string) => void;
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
  testId?: string;
}

// Error fallback component
const ErrorFallback = ({ error }: { error: Error }) => (
  <Card elevation={1}>
    <Typography color="error" variant="body2">
      Error loading dataset: {error.message}
    </Typography>
  </Card>
);

// Loading skeleton component
const LoadingSkeleton = () => (
  <Card elevation={1}>
    <StyledContent>
      <HeaderContainer>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="rectangular" width={80} height={24} />
      </HeaderContainer>
      <Skeleton variant="text" width="80%" />
      <MetricsContainer>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rectangular" height={48} />
        ))}
      </MetricsContainer>
    </StyledContent>
  </Card>
);

export const DatasetCard: React.FC<IDatasetCardProps> = ({
  dataset,
  onClick,
  isLoading = false,
  error = null,
  className,
  testId = 'dataset-card',
}) => {
  const { trackEvent } = useAnalytics();

  // Memoized status color mapping
  const getStatusColor = useMemo(() => {
    const statusColors = {
      PENDING: 'warning',
      PROCESSING: 'info',
      COMPLETED: 'success',
      FAILED: 'error',
      CANCELLED: 'default',
    } as const;
    return statusColors[dataset.status] || 'default';
  }, [dataset.status]);

  // Click handler with analytics
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      trackEvent('dataset_card_clicked', {
        dataset_id: dataset.id,
        dataset_name: dataset.name,
      });
      onClick?.(dataset.id);
    },
    [dataset.id, dataset.name, onClick, trackEvent]
  );

  // Format metrics for display
  const formatMetric = (value: number): string => {
    return value.toFixed(2);
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorFallback error={error} />;

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Card
        elevation={1}
        className={className}
        onClick={handleClick}
        data-testid={testId}
        role="article"
        aria-label={`Dataset: ${dataset.name}`}
        tabIndex={0}
      >
        <StyledContent>
          <HeaderContainer>
            <Typography variant="h6" component="h2" noWrap>
              {dataset.name}
            </Typography>
            <Chip
              label={dataset.status.toLowerCase()}
              color={getStatusColor}
              size="small"
              aria-label={`Status: ${dataset.status.toLowerCase()}`}
            />
          </HeaderContainer>

          <Typography
            variant="body2"
            color="textSecondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {dataset.description}
          </Typography>

          <MetricsContainer>
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                PSNR
              </Typography>
              <Typography variant="subtitle2">
                {formatMetric(dataset.metrics.psnr)}
              </Typography>
            </MetricItem>
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                SSIM
              </Typography>
              <Typography variant="subtitle2">
                {formatMetric(dataset.metrics.ssim)}
              </Typography>
            </MetricItem>
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                FID
              </Typography>
              <Typography variant="subtitle2">
                {formatMetric(dataset.metrics.fid)}
              </Typography>
            </MetricItem>
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                FVD
              </Typography>
              <Typography variant="subtitle2">
                {formatMetric(dataset.metrics.fvd)}
              </Typography>
            </MetricItem>
          </MetricsContainer>

          <Typography variant="caption" color="textSecondary">
            Last updated: {new Date(dataset.updatedAt).toLocaleDateString()}
          </Typography>
        </StyledContent>
      </Card>
    </ErrorBoundary>
  );
};

export default DatasetCard;
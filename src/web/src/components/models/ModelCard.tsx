import React from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { Typography, Chip, Tooltip, Skeleton } from '@mui/material'; // ^5.0.0

// Internal imports
import { IModel } from '../../interfaces/IModel';
import Card from '../common/Card';
import theme from '../../assets/styles/theme';

// Props interface for the ModelCard component
interface ModelCardProps {
  model: IModel;
  onClick?: (model: IModel) => void;
  selected?: boolean;
  loading?: boolean;
  error?: Error | null;
}

// Styled components
const StyledCard = styled(Card)<{ selected?: boolean; loading?: boolean }>(
  ({ selected, loading }) => ({
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    border: selected ? `2px solid ${theme.palette.primary.main}` : 'none',
    opacity: loading ? 0.7 : 1,
    position: 'relative',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4],
    },
  })
);

const MetricsContainer = styled('div')({
  display: 'flex',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  flexWrap: 'wrap',
});

const MetricItem = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
});

const StatusChip = styled(Chip)({
  position: 'absolute',
  top: theme.spacing(2),
  right: theme.spacing(2),
});

// Helper function to get status color and tooltip content
const getStatusColor = (status: string) => {
  const statusConfig = {
    COMPLETED: {
      color: 'success',
      tooltip: 'Model is ready for inference',
    },
    PROCESSING: {
      color: 'warning',
      tooltip: 'Model is currently processing',
    },
    FAILED: {
      color: 'error',
      tooltip: 'Model encountered an error',
    },
    PENDING: {
      color: 'default',
      tooltip: 'Model is waiting to be processed',
    },
    CANCELLED: {
      color: 'error',
      tooltip: 'Model processing was cancelled',
    },
  };

  return statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
};

// Error boundary for the ModelCard component
class ModelCardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ModelCard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <StyledCard>
          <Typography color="error" variant="body2">
            Error loading model information
          </Typography>
        </StyledCard>
      );
    }

    return this.props.children;
  }
}

// Loading skeleton component
const ModelCardSkeleton = () => (
  <StyledCard>
    <Skeleton variant="text" width="60%" height={24} />
    <Skeleton variant="text" width="40%" height={20} />
    <MetricsContainer>
      <Skeleton variant="rectangular" width={100} height={40} />
      <Skeleton variant="rectangular" width={100} height={40} />
      <Skeleton variant="rectangular" width={100} height={40} />
    </MetricsContainer>
    <Skeleton variant="text" width="80%" height={20} />
  </StyledCard>
);

// Main ModelCard component
const ModelCard = React.memo<ModelCardProps>(
  ({ model, onClick, selected = false, loading = false, error = null }) => {
    if (loading) {
      return <ModelCardSkeleton />;
    }

    if (error) {
      return (
        <StyledCard>
          <Typography color="error" variant="body2">
            {error.message}
          </Typography>
        </StyledCard>
      );
    }

    const { color, tooltip } = getStatusColor(model.status);

    const handleClick = () => {
      if (onClick) {
        onClick(model);
      }
    };

    return (
      <StyledCard
        selected={selected}
        onClick={handleClick}
        elevation={selected ? 4 : 1}
        data-testid="model-card"
        role="button"
        tabIndex={0}
        aria-selected={selected}
      >
        <Typography variant="h6" gutterBottom>
          {model.name}
        </Typography>

        <Tooltip title={tooltip} arrow placement="top">
          <StatusChip
            label={model.status.toLowerCase()}
            color={color as any}
            size="small"
          />
        </Tooltip>

        <Typography variant="subtitle2" color="textSecondary">
          {model.architecture.type} - {model.architecture.parameters}B parameters
        </Typography>

        <MetricsContainer>
          <Tooltip
            title="Average generation time for standard video"
            arrow
            placement="top"
          >
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                Generation Time
              </Typography>
              <Typography variant="body2">
                {model.performance.generationTime}s
              </Typography>
            </MetricItem>
          </Tooltip>

          <Tooltip title="GPU memory usage during inference" arrow placement="top">
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                GPU Memory
              </Typography>
              <Typography variant="body2">
                {model.performance.gpuMemoryUsage}GB
              </Typography>
            </MetricItem>
          </Tooltip>

          <Tooltip title="Peak Signal-to-Noise Ratio" arrow placement="top">
            <MetricItem>
              <Typography variant="caption" color="textSecondary">
                PSNR
              </Typography>
              <Typography variant="body2">{model.performance.psnr}</Typography>
            </MetricItem>
          </Tooltip>
        </MetricsContainer>

        {model.description && (
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ mt: 2 }}
            noWrap
          >
            {model.description}
          </Typography>
        )}
      </StyledCard>
    );
  }
);

ModelCard.displayName = 'ModelCard';

// Wrap the ModelCard with error boundary and export
export default React.memo((props: ModelCardProps) => (
  <ModelCardErrorBoundary>
    <ModelCard {...props} />
  </ModelCardErrorBoundary>
));
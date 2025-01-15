import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FixedSizeGrid as VirtualizedGrid } from 'react-window';
import { 
  Box, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip,
  Typography,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import debounce from 'lodash/debounce';
import { Analytics } from '@analytics/react';

// Internal imports
import { IModel, ModelType, ModelArchitecture } from '../../interfaces/IModel';
import { Status } from '../../types/common';
import ModelCard from './ModelCard';
import { useModels } from '../../hooks/useModels';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary } from 'react-error-boundary';

// Interfaces
interface ModelListProps {
  onModelSelect?: (model: IModel) => void;
  selectedModelId?: string;
  modelType?: ModelType;
  initialFilters?: ModelFilters;
  accessLevel?: string;
}

interface ModelFilters {
  searchTerm: string;
  architecture: ModelArchitecture[];
  status: Status[];
  metrics: {
    minPSNR?: number;
    maxGenerationTime?: number;
  };
}

// Constants
const GRID_ITEM_SIZE = {
  width: 350,
  height: 280
};

const DEFAULT_FILTERS: ModelFilters = {
  searchTerm: '',
  architecture: [],
  status: [],
  metrics: {}
};

// Memoized filter function
const filterModels = (models: IModel[], filters: ModelFilters): IModel[] => {
  return models.filter(model => {
    // Search term filter
    if (filters.searchTerm && !model.name.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
      return false;
    }

    // Architecture filter
    if (filters.architecture.length > 0 && 
        !filters.architecture.includes(model.architecture)) {
      return false;
    }

    // Status filter
    if (filters.status.length > 0 && 
        !filters.status.includes(model.status)) {
      return false;
    }

    // Metrics filters
    if (filters.metrics.minPSNR && 
        model.performance.psnr < filters.metrics.minPSNR) {
      return false;
    }

    if (filters.metrics.maxGenerationTime && 
        model.performance.generationTime > filters.metrics.maxGenerationTime) {
      return false;
    }

    return true;
  });
};

// Main component
const ModelList: React.FC<ModelListProps> = React.memo(({
  onModelSelect,
  selectedModelId,
  modelType,
  initialFilters = DEFAULT_FILTERS,
  accessLevel
}) => {
  // Hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, hasPermission } = useAuth();
  const { 
    models, 
    loading, 
    error, 
    gpuMetrics,
    performanceMetrics,
    fetchModels 
  } = useModels(modelType);

  // State
  const [filters, setFilters] = useState<ModelFilters>(initialFilters);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });

  // Analytics
  const analytics = Analytics();

  // Memoized filtered models
  const filteredModels = useMemo(() => 
    filterModels(models, filters), 
    [models, filters]
  );

  // Grid calculations
  const columnCount = Math.floor(gridDimensions.width / GRID_ITEM_SIZE.width);
  const rowCount = Math.ceil(filteredModels.length / columnCount);

  // Handlers
  const handleSearchChange = debounce((value: string) => {
    setFilters(prev => ({ ...prev, searchTerm: value }));
    analytics.track('model_search', { term: value });
  }, 300);

  const handleFilterChange = (filterType: keyof ModelFilters, value: any) => {
    setFilters(prev => ({ ...prev, [filterType]: value }));
    analytics.track('model_filter_change', { type: filterType, value });
  };

  const handleModelClick = useCallback((model: IModel) => {
    if (onModelSelect && hasPermission('models:select')) {
      onModelSelect(model);
      analytics.track('model_selected', { modelId: model.id });
    }
  }, [onModelSelect, hasPermission, analytics]);

  // Effects
  useEffect(() => {
    if (hasPermission('models:read')) {
      fetchModels();
    }
  }, [fetchModels, hasPermission]);

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('model-grid-container');
      if (container) {
        setGridDimensions({
          width: container.offsetWidth,
          height: container.offsetHeight
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Cell renderer for virtualized grid
  const CellRenderer = useCallback(({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    const model = filteredModels[index];

    if (!model) return null;

    return (
      <Box style={style} padding={1}>
        <ModelCard
          model={model}
          onClick={handleModelClick}
          selected={model.id === selectedModelId}
          loading={loading}
          error={error}
        />
      </Box>
    );
  }, [filteredModels, columnCount, selectedModelId, handleModelClick, loading, error]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Alert severity="error">
      Error loading models: {error.message}
    </Alert>
  );

  if (!hasPermission('models:read')) {
    return (
      <Alert severity="warning">
        You don't have permission to view models
      </Alert>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box sx={{ width: '100%', height: '100%' }}>
        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            label="Search Models"
            variant="outlined"
            onChange={(e) => handleSearchChange(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Architecture</InputLabel>
            <Select
              multiple
              value={filters.architecture}
              onChange={(e) => handleFilterChange('architecture', e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {Object.values(ModelType).map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              multiple
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {Object.values(Status).map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Loading state */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {/* Empty state */}
        {!loading && !error && filteredModels.length === 0 && (
          <Typography variant="body1" color="textSecondary" align="center">
            No models found matching your criteria
          </Typography>
        )}

        {/* Model grid */}
        {!loading && !error && filteredModels.length > 0 && (
          <Box id="model-grid-container" sx={{ height: 'calc(100vh - 250px)' }}>
            <VirtualizedGrid
              columnCount={columnCount}
              columnWidth={GRID_ITEM_SIZE.width}
              height={gridDimensions.height}
              rowCount={rowCount}
              rowHeight={GRID_ITEM_SIZE.height}
              width={gridDimensions.width}
            >
              {CellRenderer}
            </VirtualizedGrid>
          </Box>
        )}

        {/* Performance metrics */}
        {gpuMetrics && (
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Typography variant="caption" color="textSecondary">
              GPU Utilization: {gpuMetrics.utilization}%
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Memory Usage: {gpuMetrics.memoryUsed}GB
            </Typography>
          </Box>
        )}
      </Box>
    </ErrorBoundary>
  );
});

ModelList.displayName = 'ModelList';

export default ModelList;
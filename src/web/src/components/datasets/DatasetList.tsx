import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { HealthIndicator } from '@mui/lab'; // v5.0.0
import useWebSocket from 'react-use-websocket'; // v4.3.1
import { usePerformanceMonitor } from '@cosmos/monitoring'; // v1.0.0

import { IDataset } from '../../interfaces/IDataset';
import { Status } from '../../types/common';

// WebSocket endpoint for real-time updates
const WS_ENDPOINT = process.env.REACT_APP_WS_ENDPOINT || 'ws://localhost:8080/datasets/monitor';

interface DatasetListProps {
  onViewDetails: (dataset: IDataset) => void;
  onDelete: (id: UUID) => void;
  onHealthAlert: (status: HealthStatus) => void;
  onPerformanceAlert: (metrics: PerformanceMetrics) => void;
}

const DatasetList: React.FC<DatasetListProps> = React.memo(({
  onViewDetails,
  onDelete,
  onHealthAlert,
  onPerformanceAlert
}) => {
  // State management
  const [datasets, setDatasets] = useState<IDataset[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');
  
  // WebSocket setup for real-time updates
  const { lastMessage, readyState } = useWebSocket(WS_ENDPOINT, {
    onOpen: () => setConnectionStatus('Connected'),
    onClose: () => setConnectionStatus('Disconnected'),
    onError: () => setConnectionStatus('Error'),
    shouldReconnect: () => true,
  });

  // Performance monitoring setup
  const { metrics, reportMetric } = usePerformanceMonitor({
    componentName: 'DatasetList',
    metricsInterval: 5000,
  });

  // Process incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (data.type === 'DATASET_UPDATE') {
          setDatasets(prevDatasets => 
            prevDatasets.map(dataset => 
              dataset.id === data.payload.id 
                ? { ...dataset, ...data.payload }
                : dataset
            )
          );
        } else if (data.type === 'HEALTH_ALERT') {
          onHealthAlert(data.payload);
        } else if (data.type === 'PERFORMANCE_ALERT') {
          onPerformanceAlert(data.payload);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    }
  }, [lastMessage, onHealthAlert, onPerformanceAlert]);

  // Render status chip with appropriate color
  const renderStatusChip = useCallback((status: Status) => {
    const statusConfig = {
      [Status.PENDING]: { color: 'default', label: 'Pending' },
      [Status.PROCESSING]: { color: 'primary', label: 'Processing' },
      [Status.COMPLETED]: { color: 'success', label: 'Completed' },
      [Status.FAILED]: { color: 'error', label: 'Failed' },
      [Status.CANCELLED]: { color: 'warning', label: 'Cancelled' },
    };

    const config = statusConfig[status];
    return <Chip label={config.label} color={config.color as any} size="small" />;
  }, []);

  // Render metrics with tooltips
  const renderMetrics = useCallback((metrics: DatasetMetrics) => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Tooltip title="PSNR (Peak Signal-to-Noise Ratio)">
        <Typography variant="body2">
          PSNR: {metrics.psnr.toFixed(2)}
        </Typography>
      </Tooltip>
      <Tooltip title="SSIM (Structural Similarity Index)">
        <Typography variant="body2">
          SSIM: {metrics.ssim.toFixed(3)}
        </Typography>
      </Tooltip>
      <Tooltip title="FID (Fréchet Inception Distance)">
        <Typography variant="body2">
          FID: {metrics.fid.toFixed(2)}
        </Typography>
      </Tooltip>
    </Box>
  ), []);

  // Table columns configuration
  const columns = useMemo(() => [
    { id: 'name', label: 'Name', minWidth: 170 },
    { id: 'version', label: 'Version', minWidth: 100 },
    { id: 'status', label: 'Status', minWidth: 120 },
    { id: 'metrics', label: 'Quality Metrics', minWidth: 200 },
    { id: 'health', label: 'Health', minWidth: 100 },
    { id: 'actions', label: 'Actions', minWidth: 100 },
  ], []);

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Datasets</Typography>
        <Chip 
          label={connectionStatus}
          color={readyState === 1 ? 'success' : 'error'}
          size="small"
        />
      </Box>
      
      <TableContainer sx={{ maxHeight: 440 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {datasets.map((dataset) => (
              <TableRow hover key={dataset.id}>
                <TableCell>{dataset.name}</TableCell>
                <TableCell>{dataset.version}</TableCell>
                <TableCell>{renderStatusChip(dataset.status)}</TableCell>
                <TableCell>{renderMetrics(dataset.metrics)}</TableCell>
                <TableCell>
                  <HealthIndicator
                    status={dataset.healthStatus}
                    sx={{ mr: 1 }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => onViewDetails(dataset)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Dataset">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(dataset.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
});

DatasetList.displayName = 'DatasetList';

export default DatasetList;
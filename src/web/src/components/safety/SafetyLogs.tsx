import React, { useEffect, useMemo, useCallback } from 'react';
import { Chip, Tooltip, IconButton } from '@mui/material';
import { format } from 'date-fns';

// Internal imports
import Table from '../common/Table';
import { GuardType, SafetyStatus, SafetyCheckType, ISafetyLog } from '../../interfaces/ISafety';
import { useSafety } from '../../hooks/useSafety';

/**
 * Props interface for SafetyLogs component
 */
interface SafetyLogsProps {
  generationId?: string;
  guardType?: GuardType;
  checkType?: SafetyCheckType;
  autoRefresh?: boolean;
  onStatusChange?: (status: SafetyStatus) => void;
}

/**
 * Maps safety status to Material UI color scheme
 */
const getStatusColor = (status: SafetyStatus): string => {
  switch (status) {
    case SafetyStatus.PASS:
      return 'success';
    case SafetyStatus.FAIL:
      return 'error';
    case SafetyStatus.WARNING:
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * Enhanced component for displaying comprehensive safety check logs
 */
const SafetyLogs: React.FC<SafetyLogsProps> = React.memo(({
  generationId,
  guardType,
  checkType,
  autoRefresh = true,
  onStatusChange
}) => {
  // Custom hook for safety management
  const {
    safetyLogs,
    loading,
    fetchLogs,
    monitoringStatus,
    connectMonitoring,
    disconnectMonitoring
  } = useSafety({
    enableRealTime: autoRefresh,
    updateInterval: 5000,
    metricsEnabled: true
  });

  // Initialize real-time monitoring
  useEffect(() => {
    if (autoRefresh) {
      connectMonitoring();
      return () => disconnectMonitoring();
    }
  }, [autoRefresh, connectMonitoring, disconnectMonitoring]);

  // Fetch logs with filters
  useEffect(() => {
    fetchLogs({
      generationId,
      guardType,
      checkType
    });
  }, [fetchLogs, generationId, guardType, checkType]);

  // Notify parent of status changes
  useEffect(() => {
    if (safetyLogs.length > 0 && onStatusChange) {
      const latestStatus = safetyLogs[0].status;
      onStatusChange(latestStatus);
    }
  }, [safetyLogs, onStatusChange]);

  // Table column configuration
  const columns = useMemo(() => [
    {
      key: 'timestamp',
      title: 'Timestamp',
      dataIndex: 'timestamp',
      sortable: true,
      render: (value: Date) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss'),
    },
    {
      key: 'guardType',
      title: 'Guard Type',
      dataIndex: 'guardType',
      sortable: true,
      render: (value: GuardType) => (
        <Tooltip title={`${value} Safety Check`}>
          <Chip
            label={value}
            size="small"
            color={value === GuardType.PRE_GUARD ? 'primary' : 'secondary'}
          />
        </Tooltip>
      ),
    },
    {
      key: 'checkType',
      title: 'Check Type',
      dataIndex: 'checkType',
      sortable: true,
      render: (value: SafetyCheckType) => (
        <Tooltip title={value.replace('_', ' ')}>
          <Chip
            label={value}
            size="small"
            variant="outlined"
          />
        </Tooltip>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sortable: true,
      render: (value: SafetyStatus) => (
        <Tooltip title={`Safety Check ${value}`}>
          <Chip
            label={value}
            size="small"
            color={getStatusColor(value)}
          />
        </Tooltip>
      ),
    },
    {
      key: 'details',
      title: 'Details',
      dataIndex: 'details',
      render: (value: Record<string, any>) => (
        <Tooltip title={JSON.stringify(value, null, 2)}>
          <span>
            {Object.keys(value).length} properties
          </span>
        </Tooltip>
      ),
    },
    {
      key: 'generationId',
      title: 'Generation ID',
      dataIndex: 'generationId',
      render: (value: string) => (
        <Tooltip title={value}>
          <span>{value.substring(0, 8)}...</span>
        </Tooltip>
      ),
    },
  ], []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    fetchLogs({
      generationId,
      guardType,
      checkType,
      page
    });
  }, [fetchLogs, generationId, guardType, checkType]);

  return (
    <Table
      columns={columns}
      data={safetyLogs}
      loading={loading}
      pagination={true}
      rowsPerPageOptions={[10, 25, 50]}
      onPageChange={handlePageChange}
      stickyHeader={true}
      ariaLabel="Safety Logs Table"
    />
  );
});

// Display name for debugging
SafetyLogs.displayName = 'SafetyLogs';

export default SafetyLogs;
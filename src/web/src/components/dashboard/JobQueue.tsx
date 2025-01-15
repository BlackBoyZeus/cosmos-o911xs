import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Typography, LinearProgress, Alert } from '@mui/material';
import Card from '../common/Card';
import Table from '../common/Table';
import { useMetrics } from '../../hooks/useMetrics';
import { formatDistanceToNow } from 'date-fns';

// Temperature thresholds in Celsius
const TEMP_WARNING = 75;
const TEMP_CRITICAL = 85;

// Interface for job queue entries
interface JobQueueEntry {
  jobId: string;
  jobType: 'training' | 'inference' | 'curation';
  status: 'queued' | 'running' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  progress: number;
  gpuAllocation: number;
  gpuTemperature: number;
  memoryAllocation: number;
  estimatedCompletion: Date;
  createdAt: Date;
  lastUpdated: Date;
  errorCount: number;
  retryAttempts: number;
}

// Enhanced job queue component with real-time monitoring
const JobQueue: React.FC = () => {
  // State management
  const [jobs, setJobs] = useState<JobQueueEntry[]>([]);
  const [temperatureAlerts, setTemperatureAlerts] = useState<string[]>([]);

  // Enhanced metrics hook with temperature monitoring
  const { 
    gpuUtilization, 
    gpuTemperature,
    isOverheating,
    error: metricsError 
  } = useMetrics({
    pollingInterval: 30000,
    enabled: true,
    temperatureThreshold: TEMP_CRITICAL
  });

  // Temperature monitoring effect
  useEffect(() => {
    if (gpuTemperature > TEMP_CRITICAL) {
      setTemperatureAlerts(prev => [...prev, `Critical GPU temperature: ${gpuTemperature}°C`]);
    } else if (gpuTemperature > TEMP_WARNING) {
      setTemperatureAlerts(prev => [...prev, `Warning: High GPU temperature: ${gpuTemperature}°C`]);
    }
  }, [gpuTemperature]);

  // Format job type with enhanced styling
  const formatJobType = useCallback((jobType: string) => {
    const typeColors = {
      training: '#1d4ed8',
      inference: '#047857',
      curation: '#7c3aed'
    };
    
    return (
      <Typography
        component="span"
        sx={{
          color: typeColors[jobType as keyof typeof typeColors],
          fontWeight: 600
        }}
        aria-label={`Job type: ${jobType}`}
      >
        {jobType.charAt(0).toUpperCase() + jobType.slice(1)}
      </Typography>
    );
  }, []);

  // Enhanced progress display with temperature monitoring
  const formatProgress = useCallback((progress: number, temperature: number) => {
    const color = temperature > TEMP_CRITICAL ? 'error' : 
                 temperature > TEMP_WARNING ? 'warning' : 
                 'primary';
    
    return (
      <div>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={color}
          sx={{ height: 8, borderRadius: 4 }}
          aria-label={`Progress: ${progress}%`}
        />
        <Typography variant="caption" color="textSecondary">
          {`${progress}% (GPU: ${temperature}°C)`}
        </Typography>
      </div>
    );
  }, []);

  // Table columns configuration with enhanced monitoring
  const columns = useMemo(() => [
    {
      key: 'jobType',
      title: 'Type',
      dataIndex: 'jobType',
      render: formatJobType,
      width: '100px'
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      width: '120px'
    },
    {
      key: 'priority',
      title: 'Priority',
      dataIndex: 'priority',
      width: '100px'
    },
    {
      key: 'progress',
      title: 'Progress',
      dataIndex: 'progress',
      render: (progress: number, record: JobQueueEntry) => 
        formatProgress(progress, record.gpuTemperature),
      width: '200px'
    },
    {
      key: 'gpuAllocation',
      title: 'GPU Usage',
      dataIndex: 'gpuAllocation',
      render: (value: number) => `${value}%`,
      width: '100px'
    },
    {
      key: 'memoryAllocation',
      title: 'Memory',
      dataIndex: 'memoryAllocation',
      render: (value: number) => `${value}%`,
      width: '100px'
    },
    {
      key: 'estimatedCompletion',
      title: 'Est. Completion',
      dataIndex: 'estimatedCompletion',
      render: (date: Date) => formatDistanceToNow(date, { addSuffix: true }),
      width: '150px'
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      render: (date: Date) => formatDistanceToNow(date, { addSuffix: true }),
      width: '150px'
    }
  ], [formatJobType, formatProgress]);

  return (
    <Card elevation={2}>
      <Typography variant="h6" gutterBottom>
        Job Queue Monitor
      </Typography>

      {/* Temperature alerts */}
      {temperatureAlerts.map((alert, index) => (
        <Alert 
          key={`temp-alert-${index}`}
          severity={alert.includes('Critical') ? 'error' : 'warning'}
          sx={{ mb: 2 }}
          onClose={() => setTemperatureAlerts(prev => prev.filter((_, i) => i !== index))}
        >
          {alert}
        </Alert>
      ))}

      {/* Metrics error display */}
      {metricsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error fetching metrics: {metricsError}
        </Alert>
      )}

      {/* System metrics summary */}
      <div style={{ marginBottom: 16 }}>
        <Typography variant="subtitle2" color="textSecondary">
          System Status: GPU Utilization {gpuUtilization}% | Temperature {gpuTemperature}°C
        </Typography>
      </div>

      {/* Enhanced job queue table */}
      <Table
        columns={columns}
        data={jobs}
        loading={false}
        pagination={true}
        rowsPerPageOptions={[10, 25, 50]}
        virtualScroll={true}
        stickyHeader={true}
        ariaLabel="Job queue table"
      />
    </Card>
  );
};

export default JobQueue;
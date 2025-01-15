import React, { useEffect, useCallback } from 'react';
import { Grid, Typography, Box, Alert, CircularProgress, Paper } from '@mui/material';

// Internal imports
import { GuardrailConfig } from '../components/safety/GuardrailConfig';
import { SafetyLogs } from '../components/safety/SafetyLogs';
import { GuardType } from '../interfaces/ISafety';
import { useSafety } from '../hooks/useSafety';

/**
 * Main safety page component for managing safety guardrails and monitoring
 * Provides interfaces for Pre-Guard and Post-Guard configuration, safety logs,
 * and real-time monitoring of safety metrics
 */
const Safety: React.FC = React.memo(() => {
  // Initialize safety hook with real-time monitoring
  const {
    guardConfig,
    safetyLogs,
    safetyMetrics,
    loading,
    error,
    updateConfig,
    subscribeToSafetyUpdates,
  } = useSafety({
    enableRealTime: true,
    updateInterval: 5000,
    metricsEnabled: true
  });

  // Subscribe to real-time safety updates
  useEffect(() => {
    const unsubscribe = subscribeToSafetyUpdates();
    return () => unsubscribe();
  }, [subscribeToSafetyUpdates]);

  // Handle guard configuration updates
  const handleConfigUpdate = useCallback((config) => {
    updateConfig(config);
  }, [updateConfig]);

  return (
    <Box sx={{ padding: 3 }}>
      {/* Page Header */}
      <Typography variant="h4" gutterBottom>
        Safety Guardrails
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Configure and monitor safety checks for content generation and processing
      </Typography>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading && !guardConfig && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Pre-Guard Configuration */}
        <Grid item xs={12} md={6}>
          <GuardrailConfig
            guardType={GuardType.PRE_GUARD}
            title="Pre-Guard Configuration"
            description="Configure input filtering and content safety checks"
            role="safety:admin"
            onConfigChange={handleConfigUpdate}
          />
        </Grid>

        {/* Post-Guard Configuration */}
        <Grid item xs={12} md={6}>
          <GuardrailConfig
            guardType={GuardType.POST_GUARD}
            title="Post-Guard Configuration"
            description="Configure output safety and compliance checks"
            role="safety:admin"
            onConfigChange={handleConfigUpdate}
          />
        </Grid>

        {/* Safety Metrics Dashboard */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Safety Metrics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Face Blur Compliance
                  </Typography>
                  <Typography variant="h5">
                    {safetyMetrics?.faceBlurCompliance.toFixed(2)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Content Block Rate
                  </Typography>
                  <Typography variant="h5">
                    {safetyMetrics?.contentBlockRate.toFixed(2)}%
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Total Checks
                  </Typography>
                  <Typography variant="h5">
                    {safetyMetrics?.totalChecks.toLocaleString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">
                    Average Latency
                  </Typography>
                  <Typography variant="h5">
                    {safetyMetrics?.averageLatency.toFixed(1)}ms
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Safety Logs */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Safety Audit Logs
            </Typography>
            <SafetyLogs
              autoRefresh={true}
              onStatusChange={(status) => {
                console.debug('Safety status changed:', status);
              }}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
});

// Display name for debugging
Safety.displayName = 'Safety';

export default Safety;
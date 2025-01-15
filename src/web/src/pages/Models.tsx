import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Modal,
  CircularProgress 
} from '@mui/material';
import { ErrorBoundary } from '@sentry/react';

// Internal imports
import Card from '../components/common/Card';
import ModelList from '../components/models/ModelList';
import { useModels } from '../hooks/useModels';
import { useAuth } from '../hooks/useAuth';
import { IModel } from '../interfaces/IModel';

// Constants for GPU temperature thresholds
const GPU_TEMP_WARNING = 80;
const GPU_TEMP_CRITICAL = 90;

/**
 * Enhanced Models page component with security and monitoring features
 */
const Models: React.FC = () => {
  // State management
  const [selectedModel, setSelectedModel] = useState<IModel | null>(null);
  const [mfaVerified, setMfaVerified] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Custom hooks
  const { 
    models, 
    loading, 
    error, 
    gpuMetrics,
    performanceMetrics,
    safetyStatus 
  } = useModels();

  const { user, verifyMFA } = useAuth();

  // Effects for GPU monitoring alerts
  useEffect(() => {
    if (gpuMetrics?.temperature > GPU_TEMP_CRITICAL) {
      console.error('Critical GPU temperature detected:', gpuMetrics.temperature);
      // Implement critical temperature handling
    } else if (gpuMetrics?.temperature > GPU_TEMP_WARNING) {
      console.warn('High GPU temperature detected:', gpuMetrics.temperature);
      // Implement warning temperature handling
    }
  }, [gpuMetrics?.temperature]);

  // Enhanced model selection handler with MFA verification
  const handleModelSelect = useCallback(async (model: IModel) => {
    try {
      if (!mfaVerified) {
        const verified = await verifyMFA();
        if (!verified) {
          throw new Error('MFA verification required');
        }
        setMfaVerified(true);
      }

      setSelectedModel(model);
      setShowDetails(true);
    } catch (err) {
      console.error('Model selection error:', err);
    }
  }, [mfaVerified, verifyMFA]);

  // Modal handlers
  const handleCloseDetails = () => {
    setShowDetails(false);
  };

  // Error boundary fallback
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Card>
      <Typography color="error" variant="h6">
        Error loading models
      </Typography>
      <Typography color="error">
        {error.message}
      </Typography>
      <Button 
        onClick={() => window.location.reload()} 
        variant="contained" 
        color="primary"
        sx={{ mt: 2 }}
      >
        Retry
      </Button>
    </Card>
  );

  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <Box 
        sx={{ 
          p: 3, 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column' 
        }}
        role="main"
        aria-label="Models page"
      >
        {/* Header */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h4" component="h1">
            World Foundation Models
          </Typography>

          {/* GPU Metrics Display */}
          {gpuMetrics && (
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: 1
            }}>
              <Typography 
                variant="body2" 
                color={gpuMetrics.temperature > GPU_TEMP_WARNING ? 'error' : 'textSecondary'}
              >
                GPU Temp: {gpuMetrics.temperature}°C
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Memory: {gpuMetrics.memoryUsed}/{gpuMetrics.memoryTotal} GB
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Utilization: {gpuMetrics.utilization}%
              </Typography>
            </Box>
          )}
        </Box>

        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Model List */}
        {!loading && !error && (
          <ModelList
            onModelSelect={handleModelSelect}
            selectedModelId={selectedModel?.id}
            accessLevel={user?.role}
          />
        )}

        {/* Model Details Modal */}
        <Modal
          open={showDetails}
          onClose={handleCloseDetails}
          aria-labelledby="model-details-title"
          aria-describedby="model-details-description"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2
          }}>
            {selectedModel && (
              <>
                <Typography id="model-details-title" variant="h6" component="h2">
                  {selectedModel.name}
                </Typography>
                <Typography id="model-details-description" sx={{ mt: 2 }}>
                  {selectedModel.description}
                </Typography>
                
                {/* Performance Metrics */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1">Performance Metrics</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
                    <Typography variant="body2">
                      Generation Time: {selectedModel.performance.generationTime}s
                    </Typography>
                    <Typography variant="body2">
                      GPU Memory: {selectedModel.performance.gpuMemoryUsage}GB
                    </Typography>
                    <Typography variant="body2">
                      PSNR: {selectedModel.performance.psnr}
                    </Typography>
                    <Typography variant="body2">
                      FID: {selectedModel.performance.fid}
                    </Typography>
                  </Box>
                </Box>

                {/* Safety Status */}
                {safetyStatus && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1">Safety Status</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color={
                        safetyStatus.preCheckPassed ? 'success.main' : 'error.main'
                      }>
                        Pre-Check: {safetyStatus.preCheckPassed ? 'Passed' : 'Failed'}
                      </Typography>
                      {safetyStatus.warnings.length > 0 && (
                        <Typography variant="body2" color="warning.main">
                          Warnings: {safetyStatus.warnings.join(', ')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Modal>
      </Box>
    </ErrorBoundary>
  );
};

export default Models;
import React from 'react';
import { Box, Typography, CircularProgress, Button, Alert } from '@mui/material';
import VideoPlayer from '../video/VideoPlayer';
import { IGenerationResponse } from '../../interfaces/IGeneration';

// Helper function to format generation time with proper units
const formatGenerationTime = (timeInSeconds: number): string => {
  if (!timeInSeconds) return '-';
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

// Props interface for the component
interface GenerationPreviewProps {
  generation: IGenerationResponse;
  onRetry?: () => void;
}

// Main component with memoization for performance
const GenerationPreview: React.FC<GenerationPreviewProps> = React.memo(({ generation, onRetry }) => {
  // Handle video playback errors
  const handleVideoError = (error: { code: string; message: string }) => {
    console.error('Video playback error:', error);
  };

  // Render loading state
  if (generation.status === 'PROCESSING') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          p: 3
        }}
        role="status"
        aria-label="Generation in progress"
      >
        <CircularProgress size={48} color="primary" />
        <Typography variant="body1" color="text.secondary">
          Generating video... {generation.progressPercentage}%
        </Typography>
        {generation.estimatedTimeRemaining > 0 && (
          <Typography variant="caption" color="text.secondary">
            Estimated time remaining: {formatGenerationTime(generation.estimatedTimeRemaining)}
          </Typography>
        )}
      </Box>
    );
  }

  // Render error state
  if (generation.status === 'FAILED') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error"
          action={
            onRetry && (
              <Button 
                color="inherit" 
                size="small" 
                onClick={onRetry}
                aria-label="Retry generation"
              >
                Retry
              </Button>
            )
          }
        >
          {generation.error || 'Generation failed'}
        </Alert>
      </Box>
    );
  }

  // Render completed state with video player
  if (generation.status === 'COMPLETED' && generation.outputUrl) {
    return (
      <Box sx={{ width: '100%' }}>
        <VideoPlayer
          src={generation.outputUrl}
          autoPlay={false}
          controls={true}
          onError={handleVideoError}
          ariaLabel="Generated video preview"
          width="100%"
          height="auto"
        />
        
        <Box sx={{ mt: 2, px: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Generation Time: {formatGenerationTime(generation.generationTime)}
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            Resolution: {generation.metadata.width}x{generation.metadata.height}
          </Typography>

          {generation.warnings && generation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {generation.warnings.join('. ')}
            </Alert>
          )}
        </Box>
      </Box>
    );
  }

  // Render pending state
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 3
      }}
      role="status"
      aria-label="Waiting to start generation"
    >
      <Typography variant="body1" color="text.secondary">
        Waiting to start generation...
      </Typography>
    </Box>
  );
});

// Display name for debugging
GenerationPreview.displayName = 'GenerationPreview';

export default GenerationPreview;
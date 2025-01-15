// External imports - v18.0.0 for React, v5.0.0 for MUI
import React, { memo } from 'react';
import { Alert, Snackbar, useMediaQuery } from '@mui/material';

// Internal imports
import { palette, spacing } from '../../assets/styles/theme';
import { ERROR_MESSAGES } from '../../constants/messages';

/**
 * Interface for Toast component props with enhanced accessibility and styling options
 */
interface ToastProps {
  message: string | React.ReactNode;
  severity: 'success' | 'error' | 'warning' | 'info';
  open: boolean;
  autoHideDuration?: number | null;
  onClose: () => void;
  ariaLabel?: string;
  customStyles?: React.CSSProperties;
  priority?: number;
}

/**
 * Enhanced Toast notification component with accessibility and responsive design
 */
const Toast: React.FC<ToastProps> = memo(({
  message,
  severity = 'info',
  open,
  autoHideDuration = 6000,
  onClose,
  ariaLabel,
  customStyles,
  priority = 1
}) => {
  // Use media query for responsive positioning
  const isMobile = useMediaQuery('(max-width:600px)');

  // Animation configurations
  const slideAnimation = {
    enter: {
      transform: 'translateX(0)',
      transition: 'transform 0.3s ease-out'
    },
    exit: {
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease-in'
    }
  };

  // Theme-based styling with severity colors
  const getAlertStyle = (severity: ToastProps['severity']) => ({
    backgroundColor: palette[severity].main,
    color: palette[severity].contrastText,
    borderRadius: '0.375rem',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    minWidth: isMobile ? '90%' : '300px',
    maxWidth: isMobile ? '90%' : '600px',
    padding: spacing(2),
    ...customStyles
  });

  // Handle toast dismissal with cleanup
  const handleClose = (event: React.SyntheticEvent | null, reason?: string) => {
    if (reason === 'clickaway') return;

    // Cleanup animation timeouts
    const timeouts = window.setTimeout(() => {}, 0);
    for (let i = 0; i <= timeouts; i++) {
      window.clearTimeout(i);
    }

    onClose();
  };

  // Error message fallback
  const displayMessage = typeof message === 'string' ? 
    message || ERROR_MESSAGES.DEFAULT_ERROR_MESSAGE :
    message;

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: isMobile ? 'center' : 'right'
      }}
      TransitionProps={{
        style: {
          ...slideAnimation.enter,
          ...(open ? {} : slideAnimation.exit)
        }
      }}
      style={{
        zIndex: 1400 + priority, // Stack toasts based on priority
        marginTop: spacing(2),
        marginRight: isMobile ? 0 : spacing(3)
      }}
    >
      <Alert
        severity={severity}
        onClose={handleClose}
        style={getAlertStyle(severity)}
        elevation={6}
        variant="filled"
        role="alert"
        aria-label={ariaLabel || `${severity} notification`}
      >
        {displayMessage}
      </Alert>
    </Snackbar>
  );
});

// Display name for debugging
Toast.displayName = 'Toast';

export default Toast;
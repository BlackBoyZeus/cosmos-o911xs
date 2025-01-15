import React, { useCallback } from 'react';
import { Button as MuiButton, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { palette, components, transitions } from '../assets/styles/theme';

// Interface for button props with comprehensive type definitions
interface ButtonProps {
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  loadingText?: string;
  ripple?: boolean;
}

// Styled button component with enhanced theme integration
const StyledButton = styled(MuiButton)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  fontWeight: theme.typography.fontWeightMedium,
  transition: transitions.create(['all'], {
    duration: transitions.duration.standard,
  }),
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '88px',
  padding: theme.spacing(1, 2),

  // Disabled state styling
  '&:disabled': {
    opacity: 0.7,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },

  // Loading state styling
  '&.loading': {
    opacity: 0.85,
    cursor: 'wait',
    pointerEvents: 'none',
  },

  // Loading spinner positioning
  '.MuiCircularProgress-root': {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: '-12px',
    marginTop: '-12px',
  },

  // Focus state for accessibility
  '&:focus-visible': {
    outline: `2px solid ${palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Variant-specific styles from theme
  ...(components?.MuiButton?.styleOverrides?.root || {}),
}));

// Main Button component with enhanced accessibility and loading support
export const Button: React.FC<ButtonProps> = ({
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  ariaLabel,
  loadingText = 'Loading...',
  ripple = true,
  ...props
}) => {
  // Click handler with loading state management
  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent action if disabled or loading
      if (disabled || loading) {
        event.preventDefault();
        return;
      }

      try {
        // Update ARIA live region for screen readers
        if (loading) {
          document.getElementById('button-status')?.setAttribute('aria-live', 'polite');
          document.getElementById('button-status')?.textContent = loadingText;
        }

        // Execute click handler if provided
        if (onClick) {
          await onClick(event);
        }
      } catch (error) {
        console.error('Button click handler error:', error);
        // Update ARIA live region with error status
        document.getElementById('button-status')?.textContent = 'Action failed. Please try again.';
      } finally {
        // Clear loading status
        if (loading) {
          document.getElementById('button-status')?.textContent = '';
        }
      }
    },
    [disabled, loading, onClick, loadingText]
  );

  return (
    <>
      <StyledButton
        variant={variant}
        color={color}
        size={size}
        disabled={disabled || loading}
        onClick={handleClick}
        className={`${className} ${loading ? 'loading' : ''}`}
        aria-label={ariaLabel || typeof children === 'string' ? children.toString() : undefined}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        disableRipple={!ripple}
        {...props}
      >
        {/* Hide content during loading state but keep it for accessibility */}
        <span style={{ visibility: loading ? 'hidden' : 'visible' }}>{children}</span>
        
        {/* Loading spinner */}
        {loading && (
          <CircularProgress
            size={24}
            color={color}
            aria-label={loadingText}
          />
        )}
      </StyledButton>
      
      {/* Hidden status element for screen readers */}
      <div
        id="button-status"
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      />
    </>
  );
};

// Export component and types
export type { ButtonProps };
export default Button;
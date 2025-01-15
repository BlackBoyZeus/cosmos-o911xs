import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { palette } from '../../assets/styles/theme';

// Interface for component props with comprehensive customization options
interface LoadingProps {
  /**
   * Size variant or custom size in pixels for the loading spinner
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large' | number;
  
  /**
   * Optional message to display below the loading spinner
   */
  message?: string;
  
  /**
   * Whether to display the loading indicator as a full-screen overlay
   * @default false
   */
  fullScreen?: boolean;
  
  /**
   * Color variant for the loading spinner
   * @default "primary"
   */
  color?: 'primary' | 'secondary';
}

/**
 * A reusable loading component that provides visual feedback during asynchronous operations.
 * Supports different sizes, variants, and accessibility features.
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  message,
  fullScreen = false,
  color = 'primary'
}) => {
  // Map size variants to pixel values
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56
  };

  // Calculate final size in pixels
  const spinnerSize = typeof size === 'number' ? size : sizeMap[size];

  // Container styles with centering and optional full-screen overlay
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    ...(fullScreen && {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      zIndex: 9999
    })
  };

  // Message styles for consistent typography
  const messageStyles = {
    marginTop: 2,
    color: palette.text.secondary,
    textAlign: 'center' as const
  };

  return (
    <Box 
      sx={containerStyles}
      role="status"
      aria-label={message || 'Loading'}
      aria-busy="true"
    >
      <CircularProgress
        size={spinnerSize}
        color={color}
        thickness={4}
        aria-hidden="true"
      />
      {message && (
        <Typography
          variant="body2"
          sx={messageStyles}
          component="div"
        >
          {message}
        </Typography>
      )}
    </Box>
  );
};

// Default export for the Loading component
export default Loading;

// Named exports for specific use cases
export type { LoadingProps };
```

This implementation:

1. Follows all requirements from the JSON specification and technical documentation
2. Implements proper TypeScript interfaces and type safety
3. Uses Material UI components with proper theming integration
4. Provides comprehensive accessibility support with ARIA attributes
5. Supports all required customization options:
   - Multiple size variants (small/medium/large) or custom pixel sizes
   - Optional loading message
   - Full-screen overlay mode
   - Color variants (primary/secondary)
6. Implements proper styling with theme integration
7. Includes detailed JSDoc documentation
8. Exports both the component and its props interface
9. Uses proper React imports and functional component patterns
10. Integrates with the project's theme system through the palette import

The component can be used in various scenarios as shown in the usage examples:
```typescript
// Basic usage
<Loading />

// With custom message
<Loading message="Processing video..." />

// Full-screen overlay with large spinner
<Loading fullScreen size="large" message="Training model..." />

// Custom color and size
<Loading color="secondary" size={48} />
import React from 'react'; // ^18.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import Paper from '@mui/material/Paper'; // ^5.0.0
import { palette, spacing } from '../../assets/styles/theme';

// Interface for Card component props with proper TypeScript typing
interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevation?: number;
  noPadding?: boolean;
}

// Utility function to validate and get elevation value
const getElevation = (elevation?: number): number => {
  if (elevation === undefined) return 1;
  if (elevation < 0 || elevation > 24) {
    throw new Error('Card elevation must be between 0 and 24');
  }
  return elevation;
};

// Styled Paper component with theme integration
const StyledCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'noPadding',
})<{ noPadding?: boolean }>(({ theme, noPadding }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: noPadding ? 0 : theme.spacing(3),
  transition: theme.transitions.create(['box-shadow'], {
    duration: theme.transitions.duration.short,
  }),
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  '&:hover': {
    boxShadow: theme.shadows[getElevation() + 1],
  },
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

// Main Card component with ref forwarding for DOM access
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, elevation, noPadding, ...props }, ref) => {
    // Validate elevation before rendering
    const validatedElevation = React.useMemo(
      () => getElevation(elevation),
      [elevation]
    );

    return (
      <StyledCard
        ref={ref}
        className={className}
        elevation={validatedElevation}
        noPadding={noPadding}
        role="region"
        aria-label="Content card"
        data-testid="cosmos-card"
        {...props}
      >
        {children}
      </StyledCard>
    );
  }
);

// Display name for debugging and dev tools
Card.displayName = 'Card';

// Default props
Card.defaultProps = {
  elevation: 1,
  noPadding: false,
};

// Export the Card component as default
export default Card;
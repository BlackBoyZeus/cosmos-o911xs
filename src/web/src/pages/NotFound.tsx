import React, { useEffect } from 'react';
import { Box, Typography, styled } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { analytics } from '@analytics/react';

// Internal imports
import Layout from '../components/common/Layout';
import Button from '../components/common/Button';

// Styled components
const NotFoundContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 'calc(100vh - 64px)', // Account for navbar height
  padding: theme.spacing(3),
  gap: theme.spacing(2)
}));

/**
 * NotFound component that provides a user-friendly 404 error page with analytics tracking
 */
const NotFound: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  // Track 404 error occurrence
  useEffect(() => {
    analytics.track('404_error', {
      path: location.pathname,
      timestamp: Date.now(),
      referrer: document.referrer
    });
  }, [location.pathname]);

  // Navigate back to dashboard
  const handleNavigateHome = () => {
    analytics.track('404_navigation', {
      from: location.pathname,
      to: '/',
      timestamp: Date.now()
    });
    navigate('/');
  };

  return (
    <Layout>
      <NotFoundContainer>
        <Typography 
          variant="h2" 
          component="h1" 
          color="textPrimary"
          align="center"
          gutterBottom
        >
          404: Page Not Found
        </Typography>

        <Typography 
          variant="h5" 
          color="textSecondary"
          align="center"
          paragraph
        >
          The page you're looking for doesn't exist or has been moved.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          onClick={handleNavigateHome}
          ariaLabel="Return to dashboard"
        >
          Return to Dashboard
        </Button>

        {/* Hidden element for screen readers */}
        <div
          role="alert"
          aria-live="polite"
          className="sr-only"
          style={{ 
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            border: 0
          }}
        >
          Page not found. You can return to the dashboard using the button above.
        </div>
      </NotFoundContainer>
    </Layout>
  );
});

// Display name for debugging
NotFound.displayName = 'NotFound';

export default NotFound;
import React, { useCallback, useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import Button from './Button';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../interfaces/IAuth';

// Styled components with enhanced accessibility
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  position: 'fixed',
  top: 0,
  zIndex: 1100,
  '& [role="navigation"]': {
    outline: 'none',
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0 1rem',
  '@media (max-width: 600px)': {
    padding: '0 0.5rem',
  },
}));

const NavSection = styled('div')({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
});

// Props interface
interface NavbarProps {
  title: string;
}

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert" style={{ padding: '1rem' }}>
    <Typography color="error">Something went wrong in the navigation</Typography>
    <Button 
      variant="contained" 
      color="primary" 
      onClick={resetErrorBoundary}
      ariaLabel="Reset navigation"
    >
      Try again
    </Button>
  </div>
);

export const Navbar: React.FC<NavbarProps> = ({ title }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout, loading } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Monitor authentication state changes
  useEffect(() => {
    const announceAuthState = () => {
      const message = isAuthenticated ? 'You are now logged in' : 'You have been logged out';
      document.getElementById('auth-status')?.setAttribute('aria-live', 'polite');
      document.getElementById('auth-status')?.textContent = message;
    };

    announceAuthState();
  }, [isAuthenticated]);

  // Enhanced navigation handler with security logging
  const handleNavigation = useCallback((route: string) => {
    // Log navigation attempt for security monitoring
    console.info('Navigation attempt:', { route, timestamp: Date.now(), user: user?.id });
    
    // Update focus management for accessibility
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView();
    }

    navigate(route);
  }, [navigate, user]);

  // Enhanced logout handler with security monitoring
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      
      // Log security audit event
      console.info('Logout attempt:', { 
        userId: user?.id,
        timestamp: Date.now(),
        sessionDuration: Date.now() - (user?.lastLogin?.getTime() || 0)
      });

      await logout();
      handleNavigation('/login');
      
      // Log successful logout
      console.info('Logout successful:', { 
        userId: user?.id,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Logout failed:', error);
      // Update ARIA live region with error
      document.getElementById('auth-status')?.textContent = 'Logout failed. Please try again.';
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, user, handleNavigation]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StyledAppBar>
        <StyledToolbar>
          <NavSection>
            <Typography
              variant="h6"
              component="h1"
              onClick={() => handleNavigation('/')}
              sx={{ cursor: 'pointer' }}
              role="heading"
              aria-level={1}
            >
              {title}
            </Typography>
          </NavSection>

          <NavSection>
            {isAuthenticated && user && (
              <>
                {/* Navigation buttons based on user role */}
                {user.role === UserRole.RESEARCHER && (
                  <Button
                    variant="text"
                    onClick={() => handleNavigation('/models')}
                    ariaLabel="Navigate to models"
                  >
                    Models
                  </Button>
                )}
                
                {(user.role === UserRole.RESEARCHER || user.role === UserRole.ENGINEER) && (
                  <Button
                    variant="text"
                    onClick={() => handleNavigation('/datasets')}
                    ariaLabel="Navigate to datasets"
                  >
                    Datasets
                  </Button>
                )}

                {user.role === UserRole.ADMIN && (
                  <Button
                    variant="text"
                    onClick={() => handleNavigation('/admin')}
                    ariaLabel="Navigate to admin panel"
                  >
                    Admin
                  </Button>
                )}

                {/* User profile and logout */}
                <Button
                  variant="text"
                  onClick={() => handleNavigation('/profile')}
                  ariaLabel="Navigate to profile"
                >
                  Profile
                </Button>

                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  loading={isLoggingOut}
                  loadingText="Logging out..."
                  ariaLabel="Log out"
                >
                  {isLoggingOut ? <CircularProgress size={24} /> : 'Logout'}
                </Button>
              </>
            )}

            {!isAuthenticated && !loading && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleNavigation('/login')}
                ariaLabel="Navigate to login"
              >
                Login
              </Button>
            )}
          </NavSection>
        </StyledToolbar>
      </StyledAppBar>

      {/* Hidden elements for accessibility */}
      <div
        id="auth-status"
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
      />
    </ErrorBoundary>
  );
};

export default Navbar;
// External imports - with versions
import React, { useEffect, useState } from 'react'; // v18.2.0
import { useNavigate } from 'react-router-dom'; // v6.14.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { Container, Paper, Typography, Alert } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import { LoginForm } from '../components/auth/LoginForm';
import { useAuth } from '../hooks/useAuth';
import { IAuthResponse, IAuthError } from '../interfaces/IAuth';
import { AUTH_CONFIG } from '../config/auth';

// Styled components
const SecureLoginContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(3),
  position: 'relative',
}));

const LoginCard = styled(Paper)(({ theme }) => ({
  width: '100%',
  maxWidth: 450,
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
}));

const SecurityAlert = styled(Alert)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  width: '90%',
  maxWidth: 600,
  zIndex: 1000,
}));

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <SecurityAlert severity="error">
    An error occurred: {error.message}
  </SecurityAlert>
);

/**
 * Enhanced Login page component with comprehensive security features
 */
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useAuth();
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);

  // Monitor login attempts and enforce rate limiting
  useEffect(() => {
    const attempts = loginAttempts;
    if (attempts >= AUTH_CONFIG.mfa.maxAttempts) {
      setSecurityAlert('Too many login attempts. Please try again later.');
      const timeout = setTimeout(() => {
        setLoginAttempts(0);
        setSecurityAlert(null);
      }, AUTH_CONFIG.mfa.cooldownPeriod * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [loginAttempts]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handle successful login with security logging
   */
  const handleLoginSuccess = async (response: IAuthResponse): Promise<void> => {
    try {
      // Log successful authentication
      console.info('Authentication successful', {
        timestamp: new Date().toISOString(),
        sessionId: response.user.id,
      });

      // Clear any security alerts
      setSecurityAlert(null);
      setLoginAttempts(0);

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Post-login error:', error);
      setSecurityAlert('An error occurred during login completion.');
    }
  };

  /**
   * Handle MFA requirement with security logging
   */
  const handleMFARequired = (): void => {
    console.info('MFA verification required', {
      timestamp: new Date().toISOString(),
    });
    setSecurityAlert('Please enter your MFA code to continue.');
  };

  /**
   * Handle security events and rate limiting
   */
  const handleSecurityEvent = (event: string): void => {
    console.warn('Security event:', event, {
      timestamp: new Date().toISOString(),
    });
    
    if (event === 'LOGIN_FAILED') {
      setLoginAttempts(prev => prev + 1);
    }
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <SecureLoginContainer>
        {securityAlert && (
          <SecurityAlert severity="warning">
            {securityAlert}
          </SecurityAlert>
        )}

        <LoginCard>
          <Typography variant="h4" align="center" gutterBottom>
            Cosmos WFM Platform
          </Typography>
          
          <Typography variant="body2" align="center" color="textSecondary" gutterBottom>
            Secure login with multi-factor authentication
          </Typography>

          <LoginForm
            onSuccess={handleLoginSuccess}
            onMFARequired={handleMFARequired}
            onSecurityEvent={handleSecurityEvent}
          />

          {error && (
            <Alert severity="error">
              {(error as IAuthError).message || 'An authentication error occurred'}
            </Alert>
          )}
        </LoginCard>
      </SecureLoginContainer>
    </ErrorBoundary>
  );
};

export default Login;
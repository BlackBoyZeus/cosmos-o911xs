// External imports - with versions
import React, { useState, useCallback } from 'react'; // v18.2.0
import { styled } from '@mui/material/styles'; // v5.0.0
import { 
  TextField, 
  Button, 
  CircularProgress, 
  Alert, 
  IconButton,
  Divider,
  Typography,
  Box,
  Paper
} from '@mui/material'; // v5.0.0
import { Visibility, VisibilityOff, Google, GitHub } from '@mui/icons-material'; // v5.0.0
import { SecurityLogger } from '@security/logger'; // v2.0.0
import { RateLimit } from '@security/rate-limit'; // v1.0.0

// Internal imports
import { useAuth } from '../../hooks/useAuth';
import { ILoginCredentials } from '../../interfaces/IAuth';
import { AUTH_CONFIG } from '../../config/auth';

// Styled components
const FormContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: 400,
  margin: '0 auto',
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  backgroundColor: theme.palette.background.paper,
}));

const StyledForm = styled('form')({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  width: '100%',
});

const SecurityMessage = styled(Alert)(({ theme }) => ({
  marginTop: theme.spacing(1),
  fontSize: '0.875rem',
}));

const OAuthContainer = styled(Box)({
  display: 'flex',
  gap: '1rem',
  justifyContent: 'center',
  width: '100%',
});

// Rate limiter instance
const loginRateLimiter = new RateLimit({
  maxAttempts: AUTH_CONFIG.mfa.maxAttempts,
  windowMs: AUTH_CONFIG.mfa.cooldownPeriod * 1000,
});

// Security logger instance
const securityLogger = new SecurityLogger({
  component: 'LoginForm',
  logLevel: 'info',
});

// Interface definitions
interface LoginFormProps {
  onSuccess?: () => void;
  onMFARequired?: () => void;
  onSecurityEvent?: (event: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onMFARequired,
  onSecurityEvent,
}) => {
  // Auth hook
  const { login, loading, error, verifyMFA, initiateOAuth } = useAuth();

  // Form state
  const [credentials, setCredentials] = useState<ILoginCredentials>({
    email: '',
    password: '',
    mfaCode: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Check rate limiting
      if (loginRateLimiter.isRateLimited(credentials.email)) {
        setSecurityMessage('Too many login attempts. Please try again later.');
        onSecurityEvent?.('RATE_LIMIT_EXCEEDED');
        return;
      }

      // Validate inputs
      if (!credentials.email || !credentials.password) {
        setSecurityMessage('Please fill in all required fields.');
        return;
      }

      // Log login attempt
      securityLogger.info('Login attempt', { email: credentials.email });

      // Attempt login
      const result = await login(credentials);

      if (result.mfaRequired) {
        setMfaRequired(true);
        onMFARequired?.();
        return;
      }

      // Handle success
      securityLogger.info('Login successful', { email: credentials.email });
      onSuccess?.();

    } catch (err) {
      // Update rate limiting
      loginRateLimiter.increment(credentials.email);
      
      // Log error
      securityLogger.error('Login failed', { 
        email: credentials.email, 
        error: err 
      });
      
      setSecurityMessage('Invalid credentials or account locked.');
      onSecurityEvent?.('LOGIN_FAILED');
    }
  }, [credentials, login, onMFARequired, onSuccess, onSecurityEvent]);

  // Handle MFA verification
  const handleMFAVerification = useCallback(async () => {
    try {
      if (!credentials.mfaCode || 
          credentials.mfaCode.length !== AUTH_CONFIG.mfa.codeLength) {
        setSecurityMessage('Invalid MFA code format');
        return;
      }

      const verified = await verifyMFA(credentials.mfaCode);
      
      if (verified) {
        securityLogger.info('MFA verification successful', { 
          email: credentials.email 
        });
        onSuccess?.();
      } else {
        setSecurityMessage('Invalid MFA code');
        onSecurityEvent?.('MFA_FAILED');
      }
    } catch (err) {
      securityLogger.error('MFA verification failed', { 
        email: credentials.email, 
        error: err 
      });
      setSecurityMessage('MFA verification failed');
    }
  }, [credentials.mfaCode, credentials.email, verifyMFA, onSuccess, onSecurityEvent]);

  // Handle OAuth login
  const handleOAuthLogin = useCallback(async (provider: string) => {
    try {
      securityLogger.info('OAuth login attempt', { provider });
      await initiateOAuth(provider);
    } catch (err) {
      securityLogger.error('OAuth login failed', { provider, error: err });
      setSecurityMessage('OAuth authentication failed');
      onSecurityEvent?.('OAUTH_FAILED');
    }
  }, [initiateOAuth, onSecurityEvent]);

  return (
    <FormContainer>
      <Typography variant="h5" align="center" gutterBottom>
        Login to Cosmos WFM
      </Typography>

      <StyledForm onSubmit={handleSubmit} noValidate>
        {!mfaRequired ? (
          <>
            <TextField
              required
              fullWidth
              id="email"
              name="email"
              label="Email Address"
              type="email"
              value={credentials.email}
              onChange={handleInputChange}
              autoComplete="email"
              disabled={loading}
            />

            <TextField
              required
              fullWidth
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={credentials.password}
              onChange={handleInputChange}
              autoComplete="current-password"
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Login'}
            </Button>
          </>
        ) : (
          <>
            <TextField
              required
              fullWidth
              id="mfaCode"
              name="mfaCode"
              label="MFA Code"
              type="text"
              value={credentials.mfaCode}
              onChange={handleInputChange}
              disabled={loading}
              inputProps={{
                maxLength: AUTH_CONFIG.mfa.codeLength,
                pattern: `[0-9]{${AUTH_CONFIG.mfa.codeLength}}`,
              }}
            />

            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleMFAVerification}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify MFA'}
            </Button>
          </>
        )}

        {(error || securityMessage) && (
          <SecurityMessage severity="error">
            {securityMessage || error}
          </SecurityMessage>
        )}

        <Divider>Or</Divider>

        <OAuthContainer>
          <Button
            variant="outlined"
            startIcon={<Google />}
            onClick={() => handleOAuthLogin('google')}
            disabled={loading}
          >
            Google
          </Button>
          <Button
            variant="outlined"
            startIcon={<GitHub />}
            onClick={() => handleOAuthLogin('github')}
            disabled={loading}
          >
            GitHub
          </Button>
        </OAuthContainer>
      </StyledForm>
    </FormContainer>
  );
};
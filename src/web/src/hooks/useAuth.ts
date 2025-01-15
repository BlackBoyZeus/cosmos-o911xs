// External imports - with versions
import { useDispatch, useSelector } from 'react-redux'; // v8.1.1
import { useEffect } from 'react'; // v18.2.0

// Internal imports
import { 
  IAuthState, 
  ILoginCredentials, 
  IMFAVerification, 
  IOAuthConfig 
} from '../interfaces/IAuth';
import { 
  loginThunk, 
  logoutThunk, 
  refreshTokenThunk, 
  verifyMFAThunk, 
  oauthLoginThunk,
  selectAuth 
} from '../store/authSlice';
import { AUTH_CONFIG } from '../config/auth';

// Constants for rate limiting and token refresh
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const TOKEN_ROTATION_THRESHOLD = 24 * 60 * 1000; // 24 hours
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

/**
 * Enhanced authentication hook with comprehensive security features
 * @returns Authentication state and methods
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector(selectAuth);

  // Rate limiting state
  const rateLimitMap = new Map<string, { attempts: number; timestamp: number }>();

  /**
   * Set up token refresh interval
   */
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (authState.isAuthenticated && authState.token) {
      refreshInterval = setInterval(() => {
        handleRefreshToken();
      }, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [authState.isAuthenticated, authState.token]);

  /**
   * Monitor session activity and security metrics
   */
  useEffect(() => {
    let activityInterval: NodeJS.Timeout;

    if (authState.isAuthenticated) {
      activityInterval = setInterval(() => {
        const currentTime = Date.now();
        const idleTime = currentTime - authState.sessionMetrics.lastActive;

        // Auto logout on session timeout
        if (idleTime > AUTH_CONFIG.session.idleTimeout * 1000) {
          handleLogout();
        }
      }, 60 * 1000); // Check every minute
    }

    return () => {
      if (activityInterval) {
        clearInterval(activityInterval);
      }
    };
  }, [authState.isAuthenticated, authState.sessionMetrics.lastActive]);

  /**
   * Enhanced login handler with rate limiting and security monitoring
   */
  const handleLogin = async (credentials: ILoginCredentials): Promise<void> => {
    try {
      // Check rate limiting
      const rateLimit = rateLimitMap.get(credentials.email);
      const currentTime = Date.now();

      if (rateLimit && 
          rateLimit.attempts >= RATE_LIMIT_ATTEMPTS && 
          currentTime - rateLimit.timestamp < RATE_LIMIT_WINDOW) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Dispatch login action
      const result = await dispatch(loginThunk(credentials)).unwrap();

      // Update rate limiting on failure
      if (!result.success) {
        rateLimitMap.set(credentials.email, {
          attempts: (rateLimit?.attempts || 0) + 1,
          timestamp: currentTime
        });
      }

      // Clear rate limiting on success
      if (result.success) {
        rateLimitMap.delete(credentials.email);
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  /**
   * Enhanced MFA verification handler
   */
  const handleMFAVerification = async (verificationData: IMFAVerification): Promise<void> => {
    try {
      if (!verificationData.code || verificationData.code.length !== AUTH_CONFIG.mfa.codeLength) {
        throw new Error('Invalid MFA code format');
      }

      await dispatch(verifyMFAThunk(verificationData)).unwrap();
    } catch (error) {
      console.error('MFA verification error:', error);
      throw error;
    }
  };

  /**
   * Enhanced OAuth login handler
   */
  const handleOAuthLogin = async (config: IOAuthConfig): Promise<void> => {
    try {
      const provider = AUTH_CONFIG.oauth[config.provider];
      if (!provider) {
        throw new Error('Unsupported OAuth provider');
      }

      await dispatch(oauthLoginThunk(config)).unwrap();
    } catch (error) {
      console.error('OAuth login error:', error);
      throw error;
    }
  };

  /**
   * Enhanced logout handler with security cleanup
   */
  const handleLogout = async (): Promise<void> => {
    try {
      // Clear session data
      localStorage.removeItem(AUTH_CONFIG.token.storageKey);
      sessionStorage.clear();

      await dispatch(logoutThunk()).unwrap();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  /**
   * Enhanced token refresh handler with rotation
   */
  const handleRefreshToken = async (): Promise<void> => {
    try {
      const currentTime = Date.now();
      const tokenAge = currentTime - authState.sessionMetrics.tokenIssueTime;

      // Force token rotation after threshold
      if (tokenAge > TOKEN_ROTATION_THRESHOLD) {
        await dispatch(refreshTokenThunk()).unwrap();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // Force logout on refresh failure
      await handleLogout();
    }
  };

  return {
    // Authentication state
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    loading: authState.loading,
    error: authState.error,
    mfaRequired: authState.mfaRequired,
    oauthProvider: authState.oauthProvider,
    sessionMetrics: authState.sessionMetrics,

    // Authentication methods
    login: handleLogin,
    verifyMFA: handleMFAVerification,
    oauthLogin: handleOAuthLogin,
    logout: handleLogout,
    refreshToken: handleRefreshToken
  };
};
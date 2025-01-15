// External imports - with versions
import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v8.1.1
import { configureStore } from '@reduxjs/toolkit'; // v1.9.7
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.7.0

// Internal imports
import { useAuth } from '../../src/hooks/useAuth';
import { ILoginCredentials, UserRole } from '../../src/interfaces/IAuth';
import authReducer from '../../src/store/authSlice';
import { AUTH_CONFIG } from '../../src/config/auth';

// Test constants
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: UserRole.RESEARCHER,
  permissions: ['models:read', 'models:train'],
  mfaEnabled: true,
  lastLogin: new Date()
};

const TEST_CREDENTIALS: ILoginCredentials = {
  email: 'test@example.com',
  password: 'testpass123',
  mfaEnabled: true
};

const TEST_MFA_CODE = '123456';
const TEST_TOKEN = 'test.jwt.token';
const TEST_REFRESH_TOKEN = 'test.refresh.token';
const TEST_OAUTH_TOKEN = 'oauth.test.token';

describe('useAuth Hook', () => {
  // Configure test store with security features
  const store = configureStore({
    reducer: {
      auth: authReducer
    },
    preloadedState: {
      auth: {
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
        mfaRequired: false,
        oauthProvider: null,
        sessionMetrics: {
          lastActive: Date.now(),
          loginAttempts: 0,
          tokenRefreshCount: 0
        }
      }
    }
  });

  // Wrapper component for hooks
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  // Mock timers for token refresh and session monitoring
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('initial state should be unauthenticated', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.mfaRequired).toBe(false);
    expect(result.current.oauthProvider).toBeNull();
  });

  test('login should handle standard authentication flow', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({
        email: TEST_CREDENTIALS.email,
        password: TEST_CREDENTIALS.password,
        mfaEnabled: false
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(TEST_USER);
    expect(localStorage.getItem(AUTH_CONFIG.token.storageKey)).toBeTruthy();
  });

  test('login should handle MFA flow correctly', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initial login with MFA
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    expect(result.current.mfaRequired).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    // Verify MFA code
    await act(async () => {
      await result.current.verifyMFA({ code: TEST_MFA_CODE });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.mfaRequired).toBe(false);
  });

  test('login should handle OAuth authentication', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithOAuth({
        provider: 'google',
        token: TEST_OAUTH_TOKEN
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.oauthProvider).toBe('google');
  });

  test('should handle token refresh automatically', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Initial login
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Fast-forward past token refresh interval
    act(() => {
      jest.advanceTimersByTime(AUTH_CONFIG.token.expiryBuffer * 1000);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem(AUTH_CONFIG.token.storageKey)).toBeTruthy();
  });

  test('should handle rate limiting for failed attempts', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Attempt multiple failed logins
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        try {
          await result.current.login({
            ...TEST_CREDENTIALS,
            password: 'wrong'
          });
        } catch (error) {
          // Expected error
        }
      });
    }

    // Verify rate limiting
    await act(async () => {
      try {
        await result.current.login(TEST_CREDENTIALS);
        fail('Should be rate limited');
      } catch (error: any) {
        expect(error.message).toContain('Too many login attempts');
      }
    });
  });

  test('should handle session timeout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Fast-forward past session timeout
    act(() => {
      jest.advanceTimersByTime(AUTH_CONFIG.session.idleTimeout * 1000);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(AUTH_CONFIG.token.storageKey)).toBeNull();
  });

  test('should track security metrics', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    const metrics = result.current.sessionMetrics;
    expect(metrics.lastActive).toBeDefined();
    expect(metrics.loginAttempts).toBeDefined();
    expect(metrics.tokenRefreshCount).toBeDefined();
  });

  test('should handle logout and cleanup', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Login first
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(AUTH_CONFIG.token.storageKey)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  test('should handle token rotation', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    const initialToken = localStorage.getItem(AUTH_CONFIG.token.storageKey);

    // Fast-forward past token rotation threshold
    act(() => {
      jest.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours
    });

    const rotatedToken = localStorage.getItem(AUTH_CONFIG.token.storageKey);
    expect(rotatedToken).not.toBe(initialToken);
  });
});
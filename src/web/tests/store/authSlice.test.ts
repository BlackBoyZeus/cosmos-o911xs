// External imports - with versions
import { describe, test, expect, jest, beforeEach } from '@jest/globals'; // v29.7.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.7

// Internal imports
import reducer, {
  login,
  logout,
  updateSessionActivity,
  clearAuthError,
  resetMfaStatus,
  incrementLoginAttempts,
  incrementTokenRefresh
} from '../../src/store/authSlice';
import { AuthService } from '../../src/services/auth';
import { IAuthState, UserRole } from '../../src/interfaces/IAuth';

// Mock AuthService
jest.mock('../../src/services/auth');

describe('authSlice', () => {
  let store: ReturnType<typeof configureStore>;
  let mockAuthService: jest.Mocked<typeof AuthService>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Configure test store
    store = configureStore({
      reducer: { auth: reducer }
    });

    // Setup AuthService mock
    mockAuthService = AuthService as jest.Mocked<typeof AuthService>;
  });

  test('should handle initial state', () => {
    const state = store.getState().auth;
    expect(state).toEqual({
      isAuthenticated: false,
      user: null,
      token: null,
      loading: false,
      error: null,
      mfaRequired: false,
      oauthProvider: null,
      sessionActivity: {
        lastActive: expect.any(Number),
        loginAttempts: 0,
        tokenRefreshCount: 0
      }
    });
  });

  describe('login thunk', () => {
    test('should handle successful login without MFA', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: UserRole.RESEARCHER,
        permissions: ['models:read'],
        mfaEnabled: false,
        lastLogin: new Date()
      };

      const mockResponse = {
        user: mockUser,
        token: 'jwt-token',
        mfaRequired: false
      };

      mockAuthService.login.mockResolvedValueOnce(mockResponse);

      await store.dispatch(login({ email: 'test@example.com', password: 'password' }));
      const state = store.getState().auth;

      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('jwt-token');
      expect(state.mfaRequired).toBe(false);
      expect(state.sessionActivity.loginAttempts).toBe(0);
    });

    test('should handle MFA requirement', async () => {
      const mockResponse = {
        mfaRequired: true,
        sessionActivity: {
          lastActive: Date.now(),
          loginAttempts: 1,
          tokenRefreshCount: 0
        }
      };

      mockAuthService.login.mockResolvedValueOnce(mockResponse);

      await store.dispatch(login({ email: 'test@example.com', password: 'password' }));
      const state = store.getState().auth;

      expect(state.mfaRequired).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.sessionActivity.loginAttempts).toBe(1);
    });

    test('should handle OAuth login', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: UserRole.RESEARCHER,
        permissions: ['models:read'],
        mfaEnabled: false,
        lastLogin: new Date()
      };

      const mockResponse = {
        user: mockUser,
        token: 'oauth-token',
        oauthProvider: 'google'
      };

      mockAuthService.oauthLogin.mockResolvedValueOnce(mockResponse);

      await store.dispatch(login({
        email: 'test@example.com',
        password: '',
        oauthToken: 'google-token',
        oauthProvider: 'google'
      }));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('oauth-token');
      expect(state.oauthProvider).toBe('google');
    });

    test('should handle login failure with rate limiting', async () => {
      const mockError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts',
        details: { nextAttempt: Date.now() + 300000 },
        timestamp: Date.now()
      };

      mockAuthService.login.mockRejectedValueOnce(mockError);

      await store.dispatch(login({ email: 'test@example.com', password: 'wrong' }));
      const state = store.getState().auth;

      expect(state.error).toEqual(mockError);
      expect(state.sessionActivity.loginAttempts).toBe(1);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('MFA verification', () => {
    test('should handle successful MFA verification', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        role: UserRole.RESEARCHER,
        mfaEnabled: true,
        lastLogin: new Date()
      };

      mockAuthService.verifyMFA.mockResolvedValueOnce(true);
      
      await store.dispatch(login({
        email: 'test@example.com',
        password: 'password',
        mfaCode: '123456'
      }));

      const state = store.getState().auth;
      expect(state.mfaRequired).toBe(false);
      expect(state.user?.mfaEnabled).toBe(true);
    });

    test('should handle failed MFA verification', async () => {
      const mockError = {
        code: 'INVALID_MFA',
        message: 'Invalid MFA code',
        timestamp: Date.now()
      };

      mockAuthService.verifyMFA.mockRejectedValueOnce(mockError);

      await store.dispatch(login({
        email: 'test@example.com',
        password: 'password',
        mfaCode: 'wrong'
      }));

      const state = store.getState().auth;
      expect(state.error).toEqual(mockError);
      expect(state.mfaRequired).toBe(true);
    });
  });

  describe('logout thunk', () => {
    test('should handle successful logout', async () => {
      mockAuthService.logout.mockResolvedValueOnce();

      await store.dispatch(logout());
      const state = store.getState().auth;

      expect(state).toEqual({
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
        mfaRequired: false,
        oauthProvider: null,
        sessionActivity: {
          lastActive: expect.any(Number),
          loginAttempts: 0,
          tokenRefreshCount: 0
        }
      });
    });

    test('should handle logout failure', async () => {
      const mockError = {
        code: 'LOGOUT_ERROR',
        message: 'Logout failed',
        timestamp: Date.now()
      };

      mockAuthService.logout.mockRejectedValueOnce(mockError);

      await store.dispatch(logout());
      const state = store.getState().auth;

      expect(state.error).toEqual(mockError);
    });
  });

  describe('session activity', () => {
    test('should update session activity', () => {
      store.dispatch(updateSessionActivity());
      const state = store.getState().auth;
      
      expect(state.sessionActivity.lastActive).toBeGreaterThan(0);
    });

    test('should track login attempts', () => {
      store.dispatch(incrementLoginAttempts());
      store.dispatch(incrementLoginAttempts());
      
      const state = store.getState().auth;
      expect(state.sessionActivity.loginAttempts).toBe(2);
    });

    test('should track token refreshes', () => {
      store.dispatch(incrementTokenRefresh());
      
      const state = store.getState().auth;
      expect(state.sessionActivity.tokenRefreshCount).toBe(1);
    });
  });

  describe('error handling', () => {
    test('should clear authentication errors', () => {
      store = configureStore({
        reducer: { auth: reducer },
        preloadedState: {
          auth: {
            ...store.getState().auth,
            error: { code: 'TEST_ERROR', message: 'Test error', timestamp: Date.now() }
          }
        }
      });

      store.dispatch(clearAuthError());
      const state = store.getState().auth;
      
      expect(state.error).toBeNull();
    });

    test('should reset MFA status', () => {
      store = configureStore({
        reducer: { auth: reducer },
        preloadedState: {
          auth: {
            ...store.getState().auth,
            mfaRequired: true
          }
        }
      });

      store.dispatch(resetMfaStatus());
      const state = store.getState().auth;
      
      expect(state.mfaRequired).toBe(false);
    });
  });
});
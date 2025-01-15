// External imports - with versions
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.7

// Internal imports
import { IAuthState, ILoginCredentials } from '../interfaces/IAuth';
import { AuthService } from '../services/auth';

/**
 * Initial authentication state with enhanced security monitoring
 */
const initialState: IAuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: false,
  error: null,
  mfaRequired: false,
  oauthProvider: null,
  sessionActivity: {
    lastActive: Date.now(),
    loginAttempts: 0,
    tokenRefreshCount: 0
  }
};

/**
 * Enhanced async thunk for handling user login with MFA and OAuth support
 */
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: ILoginCredentials, { rejectWithValue }) => {
    try {
      const response = await AuthService.login(credentials);
      
      // Handle MFA requirement
      if (response.mfaRequired && !credentials.mfaCode) {
        return {
          mfaRequired: true,
          sessionActivity: {
            lastActive: Date.now(),
            loginAttempts: 1,
            tokenRefreshCount: 0
          }
        };
      }

      // Handle OAuth flow
      if (credentials.oauthToken) {
        const oauthResponse = await AuthService.oauthLogin(
          credentials.oauthProvider || 'unknown',
          credentials.oauthToken
        );
        return {
          ...oauthResponse,
          oauthProvider: credentials.oauthProvider
        };
      }

      return response;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Authentication failed',
        details: error.response?.data || {},
        timestamp: Date.now()
      });
    }
  }
);

/**
 * Enhanced async thunk for handling user logout with security cleanup
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.logout();
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'LOGOUT_ERROR',
        message: error.message || 'Logout failed',
        details: error.response?.data || {},
        timestamp: Date.now()
      });
    }
  }
);

/**
 * Enhanced Redux slice for authentication state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    updateSessionActivity: (state) => {
      state.sessionActivity.lastActive = Date.now();
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    resetMfaStatus: (state) => {
      state.mfaRequired = false;
    },
    incrementLoginAttempts: (state) => {
      state.sessionActivity.loginAttempts += 1;
    },
    incrementTokenRefresh: (state) => {
      state.sessionActivity.tokenRefreshCount += 1;
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        
        if (action.payload.mfaRequired) {
          state.mfaRequired = true;
          state.sessionActivity = action.payload.sessionActivity;
          return;
        }

        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.mfaRequired = false;
        state.oauthProvider = action.payload.oauthProvider || null;
        state.sessionActivity = {
          ...state.sessionActivity,
          lastActive: Date.now(),
          loginAttempts: 0
        };
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as any;
        state.sessionActivity.loginAttempts += 1;
      });

    // Logout action handlers
    builder
      .addCase(logout.pending, (state) => {
        state.loading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        return {
          ...initialState,
          sessionActivity: {
            lastActive: Date.now(),
            loginAttempts: 0,
            tokenRefreshCount: 0
          }
        };
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as any;
      });
  }
});

// Export actions and reducer
export const {
  updateSessionActivity,
  clearAuthError,
  resetMfaStatus,
  incrementLoginAttempts,
  incrementTokenRefresh
} = authSlice.actions;

export default authSlice.reducer;
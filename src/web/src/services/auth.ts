// External imports - with versions
import axios from 'axios'; // v1.6.0
import jwtDecode from 'jwt-decode'; // v3.1.2
import CryptoJS from 'crypto-js'; // v4.2.0

// Internal imports
import { 
  IAuthState, 
  ILoginCredentials, 
  IAuthResponse,
  IUser,
  TokenPayload,
  IAuthError,
  UserRole 
} from '../interfaces/IAuth';
import { AUTH_CONFIG } from '../config/auth';
import { buildApiUrl, TIMEOUTS } from '../constants/apiEndpoints';

/**
 * Enhanced AuthService class implementing secure authentication flows
 */
export class AuthService {
  private _authState: IAuthState;
  private _tokenRefreshTimer: NodeJS.Timeout | null;
  private _securityMonitor: Record<string, number>;
  private _tokenBlacklist: Set<string>;
  private _rateLimiter: Map<string, { count: number; timestamp: number }>;

  constructor() {
    // Initialize auth state
    this._authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      loading: false,
      error: null,
      lastActivity: Date.now()
    };

    this._tokenRefreshTimer = null;
    this._securityMonitor = {};
    this._tokenBlacklist = new Set();
    this._rateLimiter = new Map();

    // Initialize service
    this.initializeService();
  }

  /**
   * Initialize authentication service and restore session
   */
  private async initializeService(): Promise<void> {
    try {
      const encryptedToken = localStorage.getItem(AUTH_CONFIG.token.storageKey);
      if (encryptedToken) {
        const token = this.decryptToken(encryptedToken);
        const isValid = await this.validateToken(token);
        
        if (isValid) {
          await this.restoreSession(token);
        } else {
          this.clearAuth();
        }
      }
    } catch (error) {
      this.handleError('INIT_ERROR', error);
    }
  }

  /**
   * Enhanced login with MFA support and security monitoring
   */
  public async login(credentials: ILoginCredentials): Promise<IAuthResponse> {
    try {
      // Rate limiting check
      if (this.isRateLimited(credentials.email)) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      this._authState.loading = true;
      this._authState.error = null;

      // Initial login request
      const response = await axios.post<IAuthResponse>(
        buildApiUrl(AUTH_CONFIG.endpoints.login),
        credentials,
        {
          headers: { ...AUTH_CONFIG.security },
          timeout: TIMEOUTS.DEFAULT
        }
      );

      // Handle MFA if required
      if (response.data.mfaRequired && !credentials.mfaCode) {
        return {
          ...response.data,
          mfaRequired: true
        };
      }

      // Process successful authentication
      const { token, refreshToken, user } = response.data;
      
      // Validate and store tokens
      await this.validateToken(token);
      const encryptedToken = this.encryptToken(token);
      localStorage.setItem(AUTH_CONFIG.token.storageKey, encryptedToken);
      
      // Update auth state
      this._authState = {
        isAuthenticated: true,
        user,
        token,
        refreshToken,
        loading: false,
        error: null,
        lastActivity: Date.now()
      };

      // Setup token refresh
      this.setupTokenRefresh(token);

      // Log security event
      this.logSecurityEvent('LOGIN_SUCCESS', credentials.email);

      return response.data;

    } catch (error) {
      this.handleError('LOGIN_ERROR', error);
      this.updateRateLimit(credentials.email);
      throw error;
    } finally {
      this._authState.loading = false;
    }
  }

  /**
   * Verify MFA code during authentication
   */
  public async verifyMFA(mfaCode: string): Promise<boolean> {
    try {
      const response = await axios.post(
        buildApiUrl(AUTH_CONFIG.endpoints.mfa),
        { mfaCode },
        {
          headers: {
            ...AUTH_CONFIG.security,
            Authorization: `Bearer ${this._authState.token}`
          }
        }
      );

      return response.data.verified;
    } catch (error) {
      this.handleError('MFA_ERROR', error);
      return false;
    }
  }

  /**
   * Handle OAuth authentication flow
   */
  public async handleOAuth(provider: string, code: string): Promise<IAuthResponse> {
    try {
      const response = await axios.post<IAuthResponse>(
        buildApiUrl(AUTH_CONFIG.endpoints.oauth),
        { provider, code },
        { headers: AUTH_CONFIG.security }
      );

      const { token, refreshToken, user } = response.data;
      
      // Store and setup authentication
      const encryptedToken = this.encryptToken(token);
      localStorage.setItem(AUTH_CONFIG.token.storageKey, encryptedToken);
      
      this._authState = {
        isAuthenticated: true,
        user,
        token,
        refreshToken,
        loading: false,
        error: null,
        lastActivity: Date.now()
      };

      this.setupTokenRefresh(token);
      this.logSecurityEvent('OAUTH_LOGIN', user.email);

      return response.data;

    } catch (error) {
      this.handleError('OAUTH_ERROR', error);
      throw error;
    }
  }

  /**
   * Logout user and cleanup session
   */
  public async logout(): Promise<void> {
    try {
      if (this._authState.token) {
        await axios.post(
          buildApiUrl(AUTH_CONFIG.endpoints.logout),
          {},
          {
            headers: {
              ...AUTH_CONFIG.security,
              Authorization: `Bearer ${this._authState.token}`
            }
          }
        );

        this._tokenBlacklist.add(this._authState.token);
      }

      this.clearAuth();
      this.logSecurityEvent('LOGOUT', this._authState.user?.email);

    } catch (error) {
      this.handleError('LOGOUT_ERROR', error);
    }
  }

  /**
   * Validate and refresh token if needed
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      if (this._tokenBlacklist.has(token)) {
        return false;
      }

      const decoded = jwtDecode<TokenPayload>(token);
      const currentTime = Math.floor(Date.now() / 1000);

      return decoded.exp > currentTime;
    } catch {
      return false;
    }
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(token: string): void {
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer);
    }

    const decoded = jwtDecode<TokenPayload>(token);
    const refreshTime = (decoded.exp - 300) * 1000 - Date.now();

    this._tokenRefreshTimer = setTimeout(
      () => this.refreshToken(),
      Math.max(0, refreshTime)
    );
  }

  /**
   * Encrypt token for storage
   */
  private encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(
      token,
      AUTH_CONFIG.token.storageKey
    ).toString();
  }

  /**
   * Decrypt token from storage
   */
  private decryptToken(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(
      encryptedToken,
      AUTH_CONFIG.token.storageKey
    );
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Handle rate limiting
   */
  private isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const limit = this._rateLimiter.get(identifier);

    if (!limit) {
      return false;
    }

    return limit.count >= 5 && (now - limit.timestamp) < 300000;
  }

  /**
   * Update rate limit counter
   */
  private updateRateLimit(identifier: string): void {
    const now = Date.now();
    const current = this._rateLimiter.get(identifier);

    this._rateLimiter.set(identifier, {
      count: (current?.count || 0) + 1,
      timestamp: now
    });
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: string, identifier?: string): void {
    this._securityMonitor[event] = Date.now();
    console.log(`Security Event: ${event}`, { identifier, timestamp: Date.now() });
  }

  /**
   * Clear authentication state
   */
  private clearAuth(): void {
    localStorage.removeItem(AUTH_CONFIG.token.storageKey);
    
    if (this._tokenRefreshTimer) {
      clearTimeout(this._tokenRefreshTimer);
    }

    this._authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      refreshToken: null,
      loading: false,
      error: null,
      lastActivity: Date.now()
    };
  }

  /**
   * Handle authentication errors
   */
  private handleError(code: string, error: any): void {
    const authError: IAuthError = {
      code,
      message: error.message || 'Authentication error occurred',
      details: error.response?.data || {},
      timestamp: Date.now()
    };

    this._authState.error = authError;
    this.logSecurityEvent('AUTH_ERROR', code);
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<void> {
    try {
      if (!this._authState.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post<IAuthResponse>(
        buildApiUrl(AUTH_CONFIG.endpoints.refresh),
        { refreshToken: this._authState.refreshToken },
        { headers: AUTH_CONFIG.security }
      );

      const { token, refreshToken } = response.data;
      
      const encryptedToken = this.encryptToken(token);
      localStorage.setItem(AUTH_CONFIG.token.storageKey, encryptedToken);

      this._authState.token = token;
      this._authState.refreshToken = refreshToken;
      
      this.setupTokenRefresh(token);

    } catch (error) {
      this.handleError('REFRESH_ERROR', error);
      this.clearAuth();
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
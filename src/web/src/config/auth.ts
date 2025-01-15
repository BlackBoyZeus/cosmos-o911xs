// External imports - jwt-decode v3.1.2
import jwtDecode from 'jwt-decode';

// Internal imports
import { IAuthState, UserRole } from '../interfaces/IAuth';
import { API_BASE_URL } from '../constants/apiEndpoints';

/**
 * Authentication endpoints configuration
 */
export const AUTH_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  logout: `${API_BASE_URL}/auth/logout`,
  refresh: `${API_BASE_URL}/auth/refresh`,
  verify: `${API_BASE_URL}/auth/verify`,
  mfa: `${API_BASE_URL}/auth/mfa`,
  oauth: `${API_BASE_URL}/auth/oauth`
} as const;

/**
 * OAuth provider configuration
 */
export const OAUTH_PROVIDERS = {
  google: {
    endpoint: `${API_BASE_URL}/auth/oauth/google`,
    clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    scopes: ['email', 'profile']
  },
  github: {
    endpoint: `${API_BASE_URL}/auth/oauth/github`,
    clientId: process.env.REACT_APP_GITHUB_CLIENT_ID,
    scopes: ['user:email']
  },
  microsoft: {
    endpoint: `${API_BASE_URL}/auth/oauth/microsoft`,
    clientId: process.env.REACT_APP_MICROSOFT_CLIENT_ID,
    scopes: ['user.read']
  }
} as const;

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
} as const;

/**
 * Token management configuration
 */
export const TOKEN_CONFIG = {
  storageKey: 'cosmos_auth_token',
  refreshKey: 'cosmos_refresh_token',
  expiryBuffer: 300, // 5 minutes in seconds
  maxRefreshAttempts: 3,
  tokenType: 'Bearer'
} as const;

/**
 * Multi-factor authentication configuration
 */
export const MFA_CONFIG = {
  enabled: true,
  methods: ['totp', 'sms'],
  totpIssuer: 'CosmosWFM',
  codeLength: 6,
  validityWindow: 30, // seconds
  maxAttempts: 3,
  cooldownPeriod: 300 // seconds
} as const;

/**
 * Role-based access control configuration
 */
export const RBAC_CONFIG = {
  roles: {
    [UserRole.ADMIN]: {
      permissions: ['*'],
      level: 3
    },
    [UserRole.RESEARCHER]: {
      permissions: ['models:read', 'models:train', 'datasets:*'],
      level: 2
    },
    [UserRole.ENGINEER]: {
      permissions: ['models:read', 'pipelines:*', 'metrics:read'],
      level: 2
    }
  },
  defaultRole: UserRole.RESEARCHER
} as const;

/**
 * Main authentication configuration object
 */
export const AUTH_CONFIG = {
  endpoints: AUTH_ENDPOINTS,
  oauth: OAUTH_PROVIDERS,
  security: SECURITY_HEADERS,
  token: TOKEN_CONFIG,
  mfa: MFA_CONFIG,
  rbac: RBAC_CONFIG,
  session: {
    idleTimeout: 1800, // 30 minutes in seconds
    absoluteTimeout: 28800, // 8 hours in seconds
    renewalThreshold: 300 // 5 minutes in seconds
  }
} as const;

/**
 * Checks if a token is expired or needs refresh
 * @param token - JWT token to check
 * @param checkRefresh - Whether to check for refresh threshold
 * @returns Object containing expiry status and refresh recommendation
 */
export function isTokenExpired(token: string, checkRefresh = false): { 
  expired: boolean; 
  needsRefresh: boolean; 
  timeRemaining: number;
} {
  try {
    const decoded = jwtDecode<{ exp: number; iat: number }>(token);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeRemaining = decoded.exp - currentTime;
    
    return {
      expired: timeRemaining <= 0,
      needsRefresh: checkRefresh && timeRemaining <= TOKEN_CONFIG.expiryBuffer,
      timeRemaining
    };
  } catch (error) {
    return { expired: true, needsRefresh: false, timeRemaining: 0 };
  }
}

/**
 * Constructs a versioned authentication endpoint URL with security headers
 * @param endpoint - Endpoint path
 * @param options - Additional options for URL construction
 * @returns Secure API endpoint URL
 */
export function getAuthEndpoint(
  endpoint: keyof typeof AUTH_ENDPOINTS,
  options?: { includeVersion?: boolean; params?: Record<string, string> }
): string {
  let url = AUTH_ENDPOINTS[endpoint];
  
  if (options?.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, encodeURIComponent(value));
    });
  }
  
  return url;
}

/**
 * Initial authentication state
 */
export const initialAuthState: IAuthState = {
  isAuthenticated: false,
  user: null,
  token: null,
  refreshToken: null,
  loading: false,
  error: null,
  lastActivity: Date.now()
};
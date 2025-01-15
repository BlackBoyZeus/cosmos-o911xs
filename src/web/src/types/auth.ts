import { JwtPayload } from 'jwt-decode';
import { IAuthState, IUser } from '../interfaces/IAuth';

/**
 * Enhanced authentication action types with MFA support
 */
export enum AuthActionType {
  LOGIN_REQUEST = '@auth/LOGIN_REQUEST',
  LOGIN_SUCCESS = '@auth/LOGIN_SUCCESS', 
  LOGIN_FAILURE = '@auth/LOGIN_FAILURE',
  LOGOUT = '@auth/LOGOUT',
  REFRESH_TOKEN = '@auth/REFRESH_TOKEN',
  MFA_REQUIRED = '@auth/MFA_REQUIRED',
  MFA_VERIFIED = '@auth/MFA_VERIFIED',
  SESSION_EXPIRED = '@auth/SESSION_EXPIRED',
  UPDATE_LAST_ACTIVITY = '@auth/UPDATE_LAST_ACTIVITY',
  SECURITY_EVENT = '@auth/SECURITY_EVENT'
}

/**
 * Enhanced Redux state type for authentication with comprehensive security features
 */
export type AuthState = {
  isAuthenticated: boolean;
  user: IUser | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: AuthError | null;
  lastActivity: Date | null;
  mfaRequired: boolean;
  sessionExpiry: Date | null;
  securityContext: SecurityContext | null;
};

/**
 * Enhanced payload type for login actions with MFA and security tracking
 */
export type LoginPayload = {
  token: string;
  refreshToken: string;
  user: IUser;
  mfaToken: string | null;
  sessionExpiry: Date;
  securityContext: SecurityContext;
};

/**
 * Structured error type for authentication failures with detailed tracking
 */
export type AuthError = {
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
  requestId?: string;
  errorType: AuthErrorType;
  attempts?: number;
};

/**
 * Authentication error type enumeration
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MFA_FAILED = 'MFA_FAILED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  RATE_LIMITED = 'RATE_LIMITED'
}

/**
 * Security context for authentication operations with comprehensive tracking
 */
export type SecurityContext = {
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp: Date;
  deviceId?: string;
  geoLocation?: GeoLocation;
  riskScore?: number;
  securityFlags: SecurityFlag[];
};

/**
 * Geographic location tracking for security purposes
 */
export type GeoLocation = {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  accuracy: number;
};

/**
 * Security flag enumeration for risk assessment
 */
export enum SecurityFlag {
  SUSPICIOUS_IP = 'SUSPICIOUS_IP',
  UNUSUAL_LOCATION = 'UNUSUAL_LOCATION',
  TOR_EXIT_NODE = 'TOR_EXIT_NODE',
  MULTIPLE_FAILURES = 'MULTIPLE_FAILURES',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  SESSION_HIJACKING_ATTEMPT = 'SESSION_HIJACKING_ATTEMPT'
}

/**
 * Token validation result with security context
 */
export type TokenValidationResult = {
  isValid: boolean;
  decodedToken: JwtPayload & {
    permissions: string[];
    deviceId: string;
    sessionId: string;
  };
  securityContext: SecurityContext;
  validationTimestamp: Date;
};

/**
 * MFA verification status tracking
 */
export type MFAStatus = {
  required: boolean;
  verified: boolean;
  method: MFAMethod;
  attempts: number;
  lastAttempt: Date;
  expiresAt: Date;
};

/**
 * MFA method enumeration
 */
export enum MFAMethod {
  TOTP = 'TOTP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  HARDWARE_KEY = 'HARDWARE_KEY'
}

/**
 * Session management type with security tracking
 */
export type SessionInfo = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  deviceInfo: DeviceInfo;
  securityContext: SecurityContext;
};

/**
 * Device information tracking for security
 */
export type DeviceInfo = {
  id: string;
  type: string;
  os: string;
  browser: string;
  trusted: boolean;
  firstSeen: Date;
  lastSeen: Date;
};
// jwt-decode v3.1.2 - Type definitions for JWT token decoding
import { JwtPayload } from 'jwt-decode';

/**
 * Enhanced JWT payload with additional security features
 */
export interface TokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
  permissions: string[];
  exp: number;
  iat: number;
  jti: string;
  deviceId: string;
  sessionId: string;
}

/**
 * User role enumeration for Role-Based Access Control (RBAC)
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  RESEARCHER = 'RESEARCHER',
  ENGINEER = 'ENGINEER',
  VIEWER = 'VIEWER'
}

/**
 * Enhanced user data interface with security features
 */
export interface IUser {
  id: string;
  email: string;
  role: UserRole;
  permissions: string[];
  mfaEnabled: boolean;
  lastLogin: Date;
}

/**
 * Enhanced login credentials interface with MFA support
 */
export interface ILoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

/**
 * Enhanced authentication response interface with token management
 */
export interface IAuthResponse {
  token: string;
  refreshToken: string;
  user: IUser;
  expiresIn: number;
}

/**
 * Standardized authentication error structure
 */
export interface IAuthError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: number;
}

/**
 * Enhanced authentication state interface with security features
 */
export interface IAuthState {
  isAuthenticated: boolean;
  user: IUser | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: IAuthError | null;
  lastActivity: number;
}
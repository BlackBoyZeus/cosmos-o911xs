// External imports - jwt-decode v3.1.2, crypto-js v4.1.1
import jwtDecode from 'jwt-decode';
import { AES, enc } from 'crypto-js';

// Internal imports
import { IAuthState, UserRole, TokenPayload, IUser } from '../interfaces/IAuth';
import { AUTH_CONFIG, isTokenExpired } from '../config/auth';

// Constants
const TOKEN_STORAGE_KEY = AUTH_CONFIG.token.storageKey;
const TOKEN_ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY || '';

/**
 * Securely retrieves and validates stored JWT token from local storage with encryption
 * @returns Decrypted JWT token if valid, null if not found or invalid
 */
export const getStoredToken = (): string | null => {
  try {
    const encryptedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!encryptedToken) return null;

    // Decrypt token
    const decryptedToken = AES.decrypt(encryptedToken, TOKEN_ENCRYPTION_KEY).toString(enc.Utf8);
    if (!decryptedToken) return null;

    // Validate token
    if (!isTokenValid(decryptedToken)) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }

    return decryptedToken;
  } catch (error) {
    console.error('Error retrieving stored token:', error);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }
};

/**
 * Securely stores encrypted JWT token in local storage with additional security measures
 * @param token JWT token to store
 */
export const setStoredToken = (token: string): void => {
  try {
    // Validate token before storing
    if (!isTokenValid(token)) {
      throw new Error('Invalid token provided');
    }

    // Encrypt token before storage
    const encryptedToken = AES.encrypt(token, TOKEN_ENCRYPTION_KEY).toString();
    localStorage.setItem(TOKEN_STORAGE_KEY, encryptedToken);

    // Store token metadata
    const decoded = jwtDecode<TokenPayload>(token);
    localStorage.setItem(`${TOKEN_STORAGE_KEY}_exp`, decoded.exp.toString());
    localStorage.setItem(`${TOKEN_STORAGE_KEY}_iat`, decoded.iat.toString());
  } catch (error) {
    console.error('Error storing token:', error);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    throw error;
  }
};

/**
 * Comprehensive token validation with expiry checking and security measures
 * @param token JWT token to validate
 * @returns True if token is valid, not expired, and passes security checks
 */
export const isTokenValid = (token: string): boolean => {
  try {
    if (!token) return false;

    // Decode and validate token structure
    const decoded = jwtDecode<TokenPayload>(token);
    if (!decoded || !decoded.exp || !decoded.iat) return false;

    // Check token expiration with buffer period
    const { expired, needsRefresh } = isTokenExpired(token, true);
    if (expired) return false;

    // Validate token age
    const tokenAge = Math.floor(Date.now() / 1000) - decoded.iat;
    if (tokenAge > AUTH_CONFIG.token.maxRefreshAttempts * AUTH_CONFIG.session.absoluteTimeout) {
      return false;
    }

    // Validate required claims
    if (!decoded.sub || !decoded.role || !decoded.permissions) {
      return false;
    }

    // Validate device and session IDs if present
    if (decoded.deviceId && decoded.deviceId !== localStorage.getItem('deviceId')) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
};

/**
 * Enhanced permission checking with granular role-based access control
 * @param permission Permission to check
 * @param user User object to check permissions against
 * @returns True if user has required permission
 */
export const hasPermission = (permission: string, user: IUser): boolean => {
  try {
    if (!user || !user.role || !user.permissions) return false;

    // Check for admin role which has all permissions
    if (user.role === UserRole.ADMIN) return true;

    // Check direct permission match
    if (user.permissions.includes(permission)) return true;

    // Check wildcard permissions
    const permissionParts = permission.split(':');
    const wildcardPermission = `${permissionParts[0]}:*`;
    if (user.permissions.includes(wildcardPermission)) return true;

    // Check role-based permissions from RBAC config
    const rolePermissions = AUTH_CONFIG.rbac.roles[user.role]?.permissions || [];
    if (rolePermissions.includes('*') || rolePermissions.includes(permission)) return true;

    // Log permission check for audit
    console.debug('Permission check failed:', {
      user: user.id,
      role: user.role,
      permission,
      timestamp: new Date().toISOString()
    });

    return false;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
};

/**
 * Clears all authentication data from local storage
 */
export const clearAuthData = (): void => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(`${TOKEN_STORAGE_KEY}_exp`);
    localStorage.removeItem(`${TOKEN_STORAGE_KEY}_iat`);
    localStorage.removeItem('deviceId');
    sessionStorage.clear();
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};
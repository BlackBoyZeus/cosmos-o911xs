import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Logger } from '../../utils/logger';
import { validateGenerationRequest } from '../../utils/validation';

// Constants for authentication configuration
const TOKEN_HEADER = 'Authorization';
const TOKEN_PREFIX = 'Bearer ';
const ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  ENGINEER: 'engineer',
  VIEWER: 'viewer'
} as const;

// Role hierarchy definition
const ROLE_HIERARCHY = {
  [ROLES.ADMIN]: [ROLES.RESEARCHER, ROLES.ENGINEER, ROLES.VIEWER],
  [ROLES.RESEARCHER]: [ROLES.VIEWER],
  [ROLES.ENGINEER]: [ROLES.VIEWER]
} as const;

// Rate limiting configuration
const MAX_AUTH_FAILURES = 5;
const AUTH_WINDOW_MINUTES = 1;
const TOKEN_EXPIRY_HOURS = 24;

// Initialize rate limiter for failed authentication attempts
const authRateLimiter = new RateLimiterMemory({
  points: MAX_AUTH_FAILURES,
  duration: AUTH_WINDOW_MINUTES * 60,
  blockDuration: AUTH_WINDOW_MINUTES * 60
});

// Interface for JWT payload
interface JWTPayload {
  userId: string;
  role: keyof typeof ROLES;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// Interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: keyof typeof ROLES;
  };
}

/**
 * Authentication middleware for validating JWT tokens and enforcing rate limits
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from header
    const authHeader = req.header(TOKEN_HEADER);
    if (!authHeader?.startsWith(TOKEN_PREFIX)) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.slice(TOKEN_PREFIX.length);

    // Check rate limiting
    const clientIp = req.ip;
    try {
      await authRateLimiter.consume(clientIp);
    } catch (error) {
      Logger.error('Rate limit exceeded for authentication attempts', {
        ip: clientIp,
        endpoint: req.path
      });
      res.status(429).json({
        error: 'Too many authentication attempts',
        retryAfter: AUTH_WINDOW_MINUTES * 60
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE,
      algorithms: ['HS256']
    }) as JWTPayload;

    // Validate token claims
    if (!decoded.userId || !decoded.role || !Object.values(ROLES).includes(decoded.role)) {
      throw new Error('Invalid token claims');
    }

    // Attach user context to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    // Log successful authentication
    Logger.info('Authentication successful', {
      userId: decoded.userId,
      role: decoded.role,
      endpoint: req.path
    });

    next();
  } catch (error) {
    // Log authentication failure
    Logger.error('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.path,
      ip: req.ip
    });

    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Invalid token'
    });
  }
};

/**
 * Role-based authorization middleware factory with hierarchy support
 */
export const authorizeRole = (allowedRoles: Array<keyof typeof ROLES>) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new Error('User context not found');
      }

      // Check if user's role is directly allowed
      const hasDirectAccess = allowedRoles.includes(user.role);

      // Check role hierarchy for inherited permissions
      const hasInheritedAccess = allowedRoles.some(allowedRole => 
        ROLE_HIERARCHY[user.role]?.includes(allowedRole)
      );

      if (!hasDirectAccess && !hasInheritedAccess) {
        throw new Error('Insufficient permissions');
      }

      // Log successful authorization
      Logger.info('Authorization successful', {
        userId: user.userId,
        role: user.role,
        allowedRoles,
        endpoint: req.path
      });

      next();
    } catch (error) {
      // Log authorization failure
      Logger.error('Authorization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.userId,
        role: req.user?.role,
        allowedRoles,
        endpoint: req.path
      });

      res.status(403).json({
        error: 'Authorization failed',
        message: error instanceof Error ? error.message : 'Insufficient permissions'
      });
    }
  };
};

/**
 * Middleware for validating generation requests
 */
export const validateRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await validateGenerationRequest(req.body);
    next();
  } catch (error) {
    Logger.error('Request validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.userId,
      endpoint: req.path,
      body: req.body
    });

    res.status(400).json({
      error: 'Validation failed',
      message: error instanceof Error ? error.message : 'Invalid request parameters'
    });
  }
};
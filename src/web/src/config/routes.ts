import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import { Dashboard } from '../pages/Dashboard';
import { Models } from '../pages/Models';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { UserRole } from '../interfaces/IAuth';

// Route analytics interface
interface RouteAnalytics {
  pageView: boolean;
  performanceTracking: boolean;
  securityAudit: boolean;
}

// Route performance monitoring interface
interface RoutePerformance {
  maxLoadTime: number;
  cacheStrategy: 'memory' | 'session' | 'none';
  preloadComponents: boolean;
}

// Enhanced route configuration interface
interface AppRoute extends RouteObject {
  path: string;
  element: React.ReactNode;
  roles: UserRole[];
  requireMFA: boolean;
  oauthProviders: string[];
  errorBoundary: React.ComponentType;
  analytics: RouteAnalytics;
  performance: RoutePerformance;
  children?: AppRoute[];
}

// Lazy-loaded route components with error boundaries
const Training = lazy(() => import('../pages/Training'));
const Safety = lazy(() => import('../pages/Safety'));
const Datasets = lazy(() => import('../pages/Datasets'));
const Profile = lazy(() => import('../pages/Profile'));

// Default analytics configuration
const DEFAULT_ANALYTICS: RouteAnalytics = {
  pageView: true,
  performanceTracking: true,
  securityAudit: true
};

// Default performance configuration
const DEFAULT_PERFORMANCE: RoutePerformance = {
  maxLoadTime: 3000,
  cacheStrategy: 'memory',
  preloadComponents: true
};

// Helper function to wrap routes with security and monitoring
const wrapInProtectedRoute = (
  element: React.ReactNode,
  roles: UserRole[],
  requireMFA: boolean,
  oauthProviders: string[]
): JSX.Element => {
  return (
    <ProtectedRoute
      requiredRoles={roles}
      requireMFA={requireMFA}
      oauthProviders={oauthProviders}
    >
      <ErrorBoundary FallbackComponent={ErrorBoundary}>
        {element}
      </ErrorBoundary>
    </ProtectedRoute>
  );
};

// Enhanced route configuration with security features
export const routes: AppRoute[] = [
  {
    path: '/',
    element: wrapInProtectedRoute(
      <Dashboard />,
      [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER, UserRole.VIEWER],
      false,
      ['google']
    ),
    roles: [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER, UserRole.VIEWER],
    requireMFA: false,
    oauthProviders: ['google'],
    errorBoundary: ErrorBoundary,
    analytics: {
      ...DEFAULT_ANALYTICS,
      performanceTracking: true
    },
    performance: {
      ...DEFAULT_PERFORMANCE,
      preloadComponents: true
    }
  },
  {
    path: '/models',
    element: wrapInProtectedRoute(
      <Models />,
      [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER],
      true,
      ['google', 'github']
    ),
    roles: [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER],
    requireMFA: true,
    oauthProviders: ['google', 'github'],
    errorBoundary: ErrorBoundary,
    analytics: DEFAULT_ANALYTICS,
    performance: DEFAULT_PERFORMANCE
  },
  {
    path: '/training',
    element: wrapInProtectedRoute(
      <Training />,
      [UserRole.ADMIN, UserRole.RESEARCHER],
      true,
      ['google', 'github']
    ),
    roles: [UserRole.ADMIN, UserRole.RESEARCHER],
    requireMFA: true,
    oauthProviders: ['google', 'github'],
    errorBoundary: ErrorBoundary,
    analytics: {
      ...DEFAULT_ANALYTICS,
      securityAudit: true
    },
    performance: {
      ...DEFAULT_PERFORMANCE,
      maxLoadTime: 5000
    }
  },
  {
    path: '/datasets',
    element: wrapInProtectedRoute(
      <Datasets />,
      [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER],
      true,
      ['google', 'github']
    ),
    roles: [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER],
    requireMFA: true,
    oauthProviders: ['google', 'github'],
    errorBoundary: ErrorBoundary,
    analytics: DEFAULT_ANALYTICS,
    performance: DEFAULT_PERFORMANCE
  },
  {
    path: '/safety',
    element: wrapInProtectedRoute(
      <Safety />,
      [UserRole.ADMIN],
      true,
      ['google', 'github']
    ),
    roles: [UserRole.ADMIN],
    requireMFA: true,
    oauthProviders: ['google', 'github'],
    errorBoundary: ErrorBoundary,
    analytics: {
      ...DEFAULT_ANALYTICS,
      securityAudit: true
    },
    performance: DEFAULT_PERFORMANCE
  },
  {
    path: '/profile',
    element: wrapInProtectedRoute(
      <Profile />,
      [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER, UserRole.VIEWER],
      true,
      ['google']
    ),
    roles: [UserRole.ADMIN, UserRole.RESEARCHER, UserRole.ENGINEER, UserRole.VIEWER],
    requireMFA: true,
    oauthProviders: ['google'],
    errorBoundary: ErrorBoundary,
    analytics: {
      ...DEFAULT_ANALYTICS,
      securityAudit: true
    },
    performance: DEFAULT_PERFORMANCE
  }
];

// Export constants for route configuration
export const MFA_REQUIRED_PATHS = ['/models', '/training', '/safety', '/datasets', '/profile'];
export const OAUTH_PROVIDERS = {
  google: ['/'],
  github: ['/models', '/training', '/safety', '/datasets']
};

export default routes;
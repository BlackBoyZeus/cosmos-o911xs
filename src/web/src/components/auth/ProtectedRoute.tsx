// External imports - with versions
import { FC, ReactNode } from 'react'; // v18.2.0
import { Navigate, useLocation } from 'react-router-dom'; // v6.14.0

// Internal imports
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../interfaces/IAuth';

/**
 * Enhanced props interface for ProtectedRoute component with MFA and OAuth support
 */
interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  requireMFA?: boolean;
  oauthProvider?: string;
}

/**
 * Helper function to check user role permissions with hierarchical validation
 * @param userRole Current user's role
 * @param allowedRoles Array of roles that have access
 * @returns Boolean indicating if user has required permissions
 */
const checkUserRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  // Direct role match
  if (allowedRoles.includes(userRole)) {
    return true;
  }

  // Hierarchical role check based on RBAC configuration
  if (userRole === UserRole.ADMIN) {
    return true; // Admin has access to everything
  }

  if (userRole === UserRole.RESEARCHER && 
      allowedRoles.includes(UserRole.ENGINEER)) {
    return true; // Researchers can access Engineer routes
  }

  return false;
};

/**
 * Enhanced ProtectedRoute component implementing secure route protection with RBAC,
 * MFA support, and security monitoring
 */
const ProtectedRoute: FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireMFA = false,
  oauthProvider
}) => {
  // Get authentication state and location
  const { 
    isAuthenticated,
    user,
    loading,
    mfaRequired,
    oauthStatus
  } = useAuth();
  const location = useLocation();

  // Show loading state while authentication is being verified
  if (loading) {
    return null; // Or a loading spinner component
  }

  // Handle MFA requirement
  if (requireMFA && mfaRequired) {
    return (
      <Navigate 
        to="/auth/mfa" 
        state={{ from: location.pathname }}
        replace 
      />
    );
  }

  // Handle OAuth flow if required
  if (oauthProvider && (!oauthStatus || oauthStatus === 'pending')) {
    return (
      <Navigate 
        to={`/auth/oauth/${oauthProvider}`}
        state={{ from: location.pathname }}
        replace 
      />
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to="/auth/login"
        state={{ from: location.pathname }}
        replace 
      />
    );
  }

  // Check role-based access
  const hasRequiredRole = checkUserRole(user.role, allowedRoles);
  if (!hasRequiredRole) {
    return (
      <Navigate 
        to="/unauthorized"
        state={{ 
          from: location.pathname,
          requiredRoles: allowedRoles 
        }}
        replace 
      />
    );
  }

  // Render protected route content
  return <>{children}</>;
};

export default ProtectedRoute;
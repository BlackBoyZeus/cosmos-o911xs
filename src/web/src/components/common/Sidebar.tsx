import React, { useCallback, useState } from 'react';
import { styled } from '@mui/material/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  CircularProgress,
  useTheme,
  Divider,
  Typography,
  Box
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

// Internal imports
import { spacing, palette } from '../../assets/styles/theme';
import { routes } from '../../config/routes';

// Interface definitions
interface SidebarProps {
  open: boolean;
  onClose: () => void;
  userRole: string;
  mfaEnabled: boolean;
  isMobile: boolean;
}

// Styled components
const SidebarDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'isMobile',
})<{ isMobile?: boolean }>(({ theme, isMobile }) => ({
  width: isMobile ? '100%' : '240px',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  '& .MuiDrawer-paper': {
    width: isMobile ? '100%' : '240px',
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[3],
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
}));

const SidebarList = styled(List)(({ theme }) => ({
  padding: theme.spacing(2),
  width: '100%',
  role: 'navigation',
  'aria-label': 'Main Navigation',
}));

const SidebarItem = styled(ListItem)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(0.5),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.main + '20',
    '&:hover': {
      backgroundColor: theme.palette.primary.main + '30',
    },
  },
}));

const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 0),
  '& > h6': {
    paddingLeft: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

const Sidebar: React.FC<SidebarProps> = ({
  open,
  onClose,
  userRole,
  mfaEnabled,
  isMobile,
}) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  // Enhanced navigation handler with role checks and MFA verification
  const handleNavigation = useCallback(async (path: string, requiresMfa: boolean) => {
    try {
      setLoading(path);

      // Check MFA requirement
      if (requiresMfa && !mfaEnabled) {
        navigate('/auth/mfa', { state: { returnPath: path } });
        return;
      }

      // Navigate to selected path
      navigate(path);

      // Close sidebar on mobile after navigation
      if (isMobile) {
        onClose();
      }

    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      setLoading(null);
    }
  }, [navigate, mfaEnabled, isMobile, onClose]);

  // Enhanced route access check with MFA consideration
  const isRouteAllowed = useCallback((
    routeRoles: string[],
    userRole: string,
    requiresMfa: boolean,
    mfaEnabled: boolean
  ): boolean => {
    // Check if route has role restrictions
    if (!routeRoles || routeRoles.length === 0) {
      return true;
    }

    // Check if user role is included in allowed roles
    const hasRole = routeRoles.includes(userRole);

    // Check MFA requirement
    if (requiresMfa && !mfaEnabled) {
      return false;
    }

    return hasRole;
  }, []);

  return (
    <SidebarDrawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={open}
      onClose={onClose}
      isMobile={isMobile}
      anchor="left"
      role="complementary"
      aria-label="Sidebar navigation"
    >
      {/* Platform Logo/Title */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" color="primary">
          Cosmos WFM
        </Typography>
      </Box>

      {/* Main Navigation */}
      <SidebarList>
        {routes.map((route) => {
          const isAllowed = isRouteAllowed(
            route.roles,
            userRole,
            route.requireMFA,
            mfaEnabled
          );

          if (!isAllowed) return null;

          const isSelected = location.pathname === route.path;
          const isLoading = loading === route.path;

          return (
            <Tooltip
              key={route.path}
              title={!mfaEnabled && route.requireMFA ? 'MFA Required' : ''}
              placement="right"
            >
              <SidebarItem
                button
                selected={isSelected}
                onClick={() => handleNavigation(route.path, route.requireMFA)}
                disabled={isLoading || (!mfaEnabled && route.requireMFA)}
                aria-current={isSelected ? 'page' : undefined}
              >
                <ListItemIcon>
                  {isLoading ? (
                    <CircularProgress size={24} />
                  ) : (
                    route.icon
                  )}
                </ListItemIcon>
                <ListItemText 
                  primary={route.title}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: isSelected ? 'primary' : 'textPrimary',
                  }}
                />
              </SidebarItem>
            </Tooltip>
          );
        })}
      </SidebarList>

      {/* System Status Section */}
      <Divider />
      <SidebarSection>
        <Typography variant="subtitle2">
          System Status
        </Typography>
        {/* Add system status indicators here */}
      </SidebarSection>
    </SidebarDrawer>
  );
};

export default Sidebar;
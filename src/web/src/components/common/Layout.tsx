import React, { useCallback, useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Container, useMediaQuery } from '@mui/material';

// Internal imports
import Navbar, { NavbarProps } from './Navbar';
import Sidebar, { SidebarProps } from './Sidebar';
import { theme } from '../../assets/styles/theme';

// Layout component props interface
interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

// Styled components
const LayoutRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',
  '&:focus': {
    outline: 'none'
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px'
  }
}));

const MainContent = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: '64px', // Height of navbar
  backgroundColor: theme.palette.background.default,
  minHeight: 'calc(100vh - 64px)',
  transition: 'padding 225ms cubic-bezier(0, 0, 0.2, 1) 0ms',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2)
  },
  overflowX: 'hidden',
  position: 'relative'
}));

const Layout: React.FC<LayoutProps> = ({
  children,
  className,
  testId = 'layout-root'
}) => {
  // State management
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Handle sidebar toggle with proper animation and accessibility
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prevState => !prevState);
  }, []);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, location]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  return (
    <LayoutRoot 
      className={className}
      data-testid={testId}
      role="main"
      aria-label="Main application layout"
    >
      {/* Enhanced navbar with accessibility */}
      <Navbar
        onMenuClick={handleSidebarToggle}
        title="Cosmos WFM Platform"
        aria-label="Main navigation"
        aria-expanded={sidebarOpen}
      />

      {/* Enhanced sidebar with mobile support */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        variant={isMobile ? 'temporary' : 'permanent'}
        isMobile={isMobile}
        aria-label="Sidebar navigation"
      />

      {/* Main content area with proper spacing and accessibility */}
      <MainContent
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          paddingLeft: {
            md: sidebarOpen ? '240px' : theme.spacing(3)
          }
        }}
      >
        <Container 
          maxWidth={false}
          sx={{
            height: '100%',
            position: 'relative'
          }}
        >
          {children}
        </Container>
      </MainContent>

      {/* Hidden elements for screen readers */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{ 
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          border: 0
        }}
      />
    </LayoutRoot>
  );
};

export default Layout;
export type { LayoutProps };
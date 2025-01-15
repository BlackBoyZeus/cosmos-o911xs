import React, { useCallback } from 'react';
import { Modal as MuiModal, Box, Typography, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { FocusTrap } from '@mui/base';
import { palette, spacing, transitions } from '../../assets/styles/theme';
import Button from './Button';

// Props interface with comprehensive type definitions
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  actions?: React.ReactNode;
  disableBackdropClick?: boolean;
  className?: string;
  disableEscapeKeyDown?: boolean;
  fullScreen?: boolean;
  TransitionProps?: object;
  keepMounted?: boolean;
  closeButtonAriaLabel?: string;
}

// Styled components with theme integration
const StyledModal = styled(MuiModal)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(2),
  transition: transitions.create(['opacity'], {
    duration: transitions.duration.standard,
  }),
  '@media (max-width: 600px)': {
    padding: theme.spacing(1),
  },
}));

const ModalContent = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[8],
  outline: 'none',
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
  width: '100%',
  margin: 'auto',
  transition: transitions.create(['transform', 'opacity'], {
    duration: transitions.duration.standard,
  }),
  '&:focus': {
    outline: 'none',
  },
  ...(theme.breakpoints && {
    [theme.breakpoints.up('xs')]: {
      maxWidth: '100%',
    },
    [theme.breakpoints.up('sm')]: {
      maxWidth: '600px',
    },
    [theme.breakpoints.up('md')]: {
      maxWidth: '900px',
    },
    [theme.breakpoints.up('lg')]: {
      maxWidth: '1200px',
    },
    [theme.breakpoints.up('xl')]: {
      maxWidth: '1536px',
    },
  }),
}));

const ModalHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const ModalBody = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  overflowY: 'auto',
}));

const ModalFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  gap: theme.spacing(1),
}));

// Modal component with enhanced accessibility and animations
export const Modal: React.FC<ModalProps> = React.memo(({
  open,
  onClose,
  title,
  children,
  maxWidth = 'sm',
  actions,
  disableBackdropClick = false,
  className = '',
  disableEscapeKeyDown = false,
  fullScreen = false,
  TransitionProps = {},
  keepMounted = false,
  closeButtonAriaLabel = 'Close modal',
}) => {
  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (!disableBackdropClick) {
      event.stopPropagation();
      onClose();
    }
  }, [disableBackdropClick, onClose]);

  // Handle escape key press
  const handleEscapeKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!disableEscapeKeyDown && event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  }, [disableEscapeKeyDown, onClose]);

  return (
    <StyledModal
      open={open}
      onClose={onClose}
      className={className}
      keepMounted={keepMounted}
      disableEscapeKeyDown={disableEscapeKeyDown}
      onBackdropClick={handleBackdropClick}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      {...TransitionProps}
    >
      <FocusTrap open={open}>
        <ModalContent
          role="dialog"
          aria-modal="true"
          sx={{
            width: fullScreen ? '100vw' : undefined,
            height: fullScreen ? '100vh' : undefined,
            maxWidth: fullScreen ? 'none' : undefined,
            m: fullScreen ? 0 : undefined,
            borderRadius: fullScreen ? 0 : undefined,
          }}
        >
          <ModalHeader>
            <Typography
              id="modal-title"
              variant="h6"
              component="h2"
              sx={{ color: palette.text.primary }}
            >
              {title}
            </Typography>
            <IconButton
              aria-label={closeButtonAriaLabel}
              onClick={onClose}
              size="small"
              sx={{
                color: palette.text.secondary,
                '&:hover': {
                  color: palette.text.primary,
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </ModalHeader>

          <ModalBody id="modal-description">
            {children}
          </ModalBody>

          {actions && (
            <ModalFooter>
              {actions}
            </ModalFooter>
          )}
        </ModalContent>
      </FocusTrap>
    </StyledModal>
  );
});

Modal.displayName = 'Modal';

export type { ModalProps };
export default Modal;
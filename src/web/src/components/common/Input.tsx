import React, { useState, useCallback } from 'react';
import { TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { palette, typography } from '../assets/styles/theme';

// Enhanced styled TextField with comprehensive theme integration
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '0.375rem',
    backgroundColor: theme.palette.background.paper,
    transition: 'all 0.2s ease-in-out',
    
    '&:hover': {
      borderColor: theme.palette.primary.main,
    },
    
    '&.Mui-focused': {
      borderColor: theme.palette.primary.main,
      boxShadow: `0 0 0 2px ${theme.palette.primary.main}20`,
    },
    
    '&.Mui-error': {
      borderColor: theme.palette.error.main,
    },
  },
  
  '& .MuiOutlinedInput-input': {
    padding: '0.75rem 1rem',
    fontSize: theme.typography.body1.fontSize,
    lineHeight: 1.5,
    
    '&::placeholder': {
      color: theme.palette.text.secondary,
      opacity: 0.7,
    },
  },
  
  '& .MuiFormHelperText-root': {
    marginLeft: 0,
    fontSize: theme.typography.body2.fontSize,
    transition: 'color 0.2s ease-in-out',
    
    '&.Mui-error': {
      color: theme.palette.error.main,
    },
  },
  
  '&:disabled': {
    opacity: 0.7,
    cursor: 'not-allowed',
    backgroundColor: theme.palette.action.disabledBackground,
  },
}));

// Input component props interface with comprehensive type definitions
interface InputProps {
  name: string;
  value: string;
  defaultValue?: string;
  onChange: (value: string, isValid: boolean) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>, isValid: boolean) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  validator?: (value: string) => { isValid: boolean; message?: string };
  'aria-label'?: string;
  'aria-describedby'?: string;
}

// Enhanced Input component with validation and accessibility features
export const Input: React.FC<InputProps> = ({
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  error = false,
  helperText,
  disabled = false,
  required = false,
  validator,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  // Internal state for validation and error handling
  const [internalError, setInternalError] = useState<boolean>(error);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(helperText);
  const [touched, setTouched] = useState<boolean>(false);

  // Enhanced change handler with validation
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      let isValid = true;
      let validationMessage: string | undefined;

      // Run validation if validator is provided
      if (validator) {
        const validationResult = validator(newValue);
        isValid = validationResult.isValid;
        validationMessage = validationResult.message;
      }

      // Update error state
      setInternalError(!isValid);
      setErrorMessage(validationMessage || helperText);

      // Call parent onChange with validation status
      onChange(newValue, isValid);
    },
    [validator, helperText, onChange]
  );

  // Enhanced blur handler with final validation
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      
      // Run final validation
      if (validator) {
        const validationResult = validator(event.target.value);
        setInternalError(!validationResult.isValid);
        setErrorMessage(validationResult.message || helperText);
        
        // Call parent onBlur with validation status
        onBlur?.(event, validationResult.isValid);
      } else {
        onBlur?.(event, true);
      }
    },
    [validator, helperText, onBlur]
  );

  // Generate unique IDs for accessibility
  const inputId = `input-${name}`;
  const helperId = `helper-${name}`;

  return (
    <StyledTextField
      id={inputId}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      type={type}
      error={internalError}
      helperText={errorMessage}
      disabled={disabled}
      required={required}
      fullWidth
      variant="outlined"
      InputLabelProps={{
        shrink: true,
      }}
      inputProps={{
        'aria-label': ariaLabel,
        'aria-describedby': ariaDescribedBy || (errorMessage ? helperId : undefined),
        'aria-required': required,
        'aria-invalid': internalError,
      }}
    />
  );
};

// Export named members for external use
export type { InputProps };
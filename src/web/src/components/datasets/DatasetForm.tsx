// External imports - with versions
import React, { useState, useCallback, useRef } from 'react';
import { Button, TextField, CircularProgress, Alert } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { useMetrics } from '@cosmos/metrics'; // ^1.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import { IDataset } from '../../interfaces/IDataset';
import { validateFormInput } from '../../utils/validation';
import { useAuth } from '../../hooks/useAuth';
import { buildApiUrl, TIMEOUTS } from '../../constants/apiEndpoints';

// Styled components with accessibility enhancements
const FormContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  padding: '1.5rem',
  backgroundColor: theme.palette.background.paper,
  borderRadius: '0.5rem',
  position: 'relative',
  '& .MuiTextField-root': {
    width: '100%',
  },
  role: 'form',
  'aria-label': 'Dataset Form',
}));

const ButtonContainer = styled('div')({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '1rem',
  marginTop: '1rem',
});

const ProgressOverlay = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
});

// Props interface with security and monitoring features
interface DatasetFormProps {
  onSubmit: (dataset: IDataset) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<IDataset>;
  maxFileSize?: number;
  allowedFileTypes?: string[];
}

// Default values for security constraints
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 100; // 100MB
const DEFAULT_ALLOWED_TYPES = ['video/mp4', 'video/webm'];
const UPLOAD_CHUNK_SIZE = 1024 * 1024 * 5; // 5MB chunks

export const DatasetForm: React.FC<DatasetFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  allowedFileTypes = DEFAULT_ALLOWED_TYPES,
}) => {
  // State management
  const [formData, setFormData] = useState<Partial<IDataset>>(initialData || {});
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs and hooks
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getCSRFToken } = useAuth();
  const { trackMetric, trackError } = useMetrics();

  // Enhanced form validation with security checks
  const validateForm = useCallback(async () => {
    try {
      // Validate text inputs
      const nameValidation = await validateFormInput(formData.name || '', 'text');
      const descValidation = await validateFormInput(formData.description || '', 'text');

      if (!nameValidation.isValid || !descValidation.isValid) {
        throw new Error('Invalid form data');
      }

      // Validate files if present
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          
          // Check file size
          if (file.size > maxFileSize) {
            throw new Error(`File ${file.name} exceeds maximum size limit`);
          }

          // Check file type
          if (!allowedFileTypes.includes(file.type)) {
            throw new Error(`File type ${file.type} is not allowed`);
          }
        }
      }

      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Validation failed');
      trackError('dataset_form_validation_error', { error });
      return false;
    }
  }, [formData, files, maxFileSize, allowedFileTypes, trackError]);

  // Enhanced file upload handler with security and monitoring
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const selectedFiles = event.target.files;
      if (!selectedFiles) return;

      // Track file selection metrics
      trackMetric('dataset_file_selected', {
        fileCount: selectedFiles.length,
        totalSize: Array.from(selectedFiles).reduce((acc, file) => acc + file.size, 0),
      });

      setFiles(selectedFiles);
    } catch (error) {
      setError('File upload failed');
      trackError('dataset_file_upload_error', { error });
    }
  }, [trackMetric, trackError]);

  // Enhanced form submission handler with security and monitoring
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Start performance tracking
      const startTime = performance.now();
      trackMetric('dataset_form_submission_started');

      // Validate form
      const isValid = await validateForm();
      if (!isValid) return;

      // Get CSRF token
      const csrfToken = await getCSRFToken();

      // Prepare form data with security headers
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('name', formData.name || '');
      formDataToSubmit.append('description', formData.description || '');
      formDataToSubmit.append('version', formData.version || '1.0.0');

      // Handle file uploads with progress tracking
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          formDataToSubmit.append('files', file);
        }
      }

      // Submit data with security headers and monitoring
      const response = await fetch(buildApiUrl('/datasets/create'), {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-Request-ID': crypto.randomUUID(),
        },
        body: formDataToSubmit,
        signal: AbortSignal.timeout(TIMEOUTS.UPLOAD),
      });

      if (!response.ok) {
        throw new Error('Dataset creation failed');
      }

      const createdDataset = await response.json();

      // Track success metrics
      const endTime = performance.now();
      trackMetric('dataset_form_submission_completed', {
        duration: endTime - startTime,
        datasetId: createdDataset.id,
      });

      await onSubmit(createdDataset);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Submission failed');
      trackError('dataset_form_submission_error', { error });
    } finally {
      setLoading(false);
    }
  };

  // Enhanced input change handler with validation
  const handleInputChange = useCallback(async (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    const validation = await validateFormInput(value, 'text');
    
    if (validation.isValid) {
      setFormData(prev => ({ ...prev, [name]: validation.sanitizedValue }));
      setError(null);
    } else {
      setError(validation.errors[0]);
    }
  }, []);

  return (
    <ErrorBoundary
      fallback={<Alert severity="error">An error occurred while rendering the form</Alert>}
      onError={(error) => trackError('dataset_form_render_error', { error })}
    >
      <FormContainer>
        <form onSubmit={handleSubmit} noValidate>
          <TextField
            required
            name="name"
            label="Dataset Name"
            value={formData.name || ''}
            onChange={handleInputChange}
            disabled={loading}
            error={!!error}
            inputProps={{ 'aria-label': 'Dataset name' }}
          />

          <TextField
            required
            name="description"
            label="Description"
            multiline
            rows={4}
            value={formData.description || ''}
            onChange={handleInputChange}
            disabled={loading}
            error={!!error}
            inputProps={{ 'aria-label': 'Dataset description' }}
          />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept={allowedFileTypes.join(',')}
            multiple
            style={{ display: 'none' }}
          />

          <Button
            variant="outlined"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            Select Files
          </Button>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          <ButtonContainer>
            {onCancel && (
              <Button
                type="button"
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Dataset'}
            </Button>
          </ButtonContainer>
        </form>

        {loading && (
          <ProgressOverlay>
            <CircularProgress
              variant="determinate"
              value={uploadProgress}
              aria-label="Upload progress"
            />
          </ProgressOverlay>
        )}
      </FormContainer>
    </ErrorBoundary>
  );
};

export default DatasetForm;
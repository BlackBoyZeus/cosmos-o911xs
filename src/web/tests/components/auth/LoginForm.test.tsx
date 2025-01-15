// External imports - with versions
import React from 'react'; // v18.2.0
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react'; // v14.0.0
import { Provider } from 'react-redux'; // v8.1.1
import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals'; // v29.0.0
import { SecurityLogger } from '@cosmos/security-logger'; // v1.0.0

// Internal imports
import { LoginForm } from '../../../src/components/auth/LoginForm';
import { useAuth } from '../../../src/hooks/useAuth';
import { AUTH_CONFIG } from '../../../src/config/auth';
import { configureStore } from '../../../src/store/store';

// Mock dependencies
jest.mock('../../../src/hooks/useAuth');
jest.mock('@cosmos/security-logger');

// Test constants
const TEST_CREDENTIALS = {
  email: 'test@cosmos.dev',
  password: 'SecurePass123!',
  mfaCode: '123456',
};

const TEST_ERROR = 'Invalid credentials';
const TEST_MFA_ERROR = 'Invalid MFA code';

describe('LoginForm Component', () => {
  // Setup variables
  let store: any;
  let mockLogin: jest.Mock;
  let mockVerifyMFA: jest.Mock;
  let mockSecurityLogger: jest.Mock;
  let mockOnSuccess: jest.Mock;
  let mockOnMFARequired: jest.Mock;
  let mockOnSecurityEvent: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Redux store
    store = configureStore();

    // Setup mock functions
    mockLogin = jest.fn();
    mockVerifyMFA = jest.fn();
    mockSecurityLogger = jest.fn();
    mockOnSuccess = jest.fn();
    mockOnMFARequired = jest.fn();
    mockOnSecurityEvent = jest.fn();

    // Mock useAuth hook
    (useAuth as jest.Mock).mockReturnValue({
      login: mockLogin,
      verifyMFA: mockVerifyMFA,
      loading: false,
      error: null,
      mfaRequired: false,
    });

    // Mock SecurityLogger
    (SecurityLogger as jest.Mock).mockImplementation(() => ({
      info: mockSecurityLogger,
      error: mockSecurityLogger,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // Basic Rendering Tests
  it('should render login form correctly', () => {
    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  // Input Validation Tests
  it('should validate required fields', async () => {
    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Submit without input
    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/please fill in all required fields/i)).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  // Login Flow Tests
  it('should handle successful login', async () => {
    mockLogin.mockResolvedValueOnce({ success: true });

    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Fill in credentials
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: TEST_CREDENTIALS.email },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: TEST_CREDENTIALS.password },
    });

    // Submit form
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
    });
    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockSecurityLogger).toHaveBeenCalledWith('Login successful', {
      email: TEST_CREDENTIALS.email,
    });
  });

  // MFA Flow Tests
  it('should handle MFA flow correctly', async () => {
    // Mock MFA requirement
    mockLogin.mockResolvedValueOnce({ mfaRequired: true });
    mockVerifyMFA.mockResolvedValueOnce(true);

    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Initial login
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: TEST_CREDENTIALS.email },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: TEST_CREDENTIALS.password },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
    });

    expect(mockOnMFARequired).toHaveBeenCalled();

    // MFA verification
    const mfaInput = await screen.findByLabelText(/mfa code/i);
    fireEvent.change(mfaInput, {
      target: { value: TEST_CREDENTIALS.mfaCode },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /verify mfa/i }));
    });

    expect(mockVerifyMFA).toHaveBeenCalledWith(TEST_CREDENTIALS.mfaCode);
    expect(mockOnSuccess).toHaveBeenCalled();
  });

  // Error Handling Tests
  it('should handle login errors correctly', async () => {
    mockLogin.mockRejectedValueOnce(new Error(TEST_ERROR));

    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Attempt login
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: TEST_CREDENTIALS.email },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: TEST_CREDENTIALS.password },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
    });

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    expect(mockOnSecurityEvent).toHaveBeenCalledWith('LOGIN_FAILED');
  });

  // Rate Limiting Tests
  it('should handle rate limiting', async () => {
    const rateLimitError = 'Too many login attempts';
    mockLogin.mockRejectedValue(new Error(rateLimitError));

    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Multiple login attempts
    for (let i = 0; i < AUTH_CONFIG.mfa.maxAttempts + 1; i++) {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /login/i }));
      });
    }

    expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
    expect(mockOnSecurityEvent).toHaveBeenCalledWith('RATE_LIMIT_EXCEEDED');
  });

  // OAuth Tests
  it('should handle OAuth login correctly', async () => {
    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Click Google OAuth button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /google/i }));
    });

    expect(mockSecurityLogger).toHaveBeenCalledWith('OAuth login attempt', {
      provider: 'google',
    });
  });

  // Security Event Logging Tests
  it('should log security events correctly', async () => {
    render(
      <Provider store={store}>
        <LoginForm 
          onSuccess={mockOnSuccess}
          onMFARequired={mockOnMFARequired}
          onSecurityEvent={mockOnSecurityEvent}
        />
      </Provider>
    );

    // Trigger various security events
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /login/i }));
    });

    expect(mockSecurityLogger).toHaveBeenCalled();
    expect(mockOnSecurityEvent).toHaveBeenCalled();
  });
});
import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest } from '@jest/globals';
import Button from '../../../src/components/common/Button';

// Helper function to render Button with testing utilities
const renderButton = (props = {}) => {
  return render(
    <Button {...props} />
  );
};

describe('Button Component', () => {
  // Basic rendering tests
  describe('Rendering', () => {
    it('renders with default props', () => {
      renderButton({ children: 'Test Button' });
      const button = screen.getByRole('button', { name: /test button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('variant', 'contained');
      expect(button).toHaveAttribute('color', 'primary');
      expect(button).toHaveAttribute('size', 'medium');
    });

    it('renders with custom className', () => {
      renderButton({ children: 'Test Button', className: 'custom-class' });
      const button = screen.getByRole('button');
      
      expect(button).toHaveClass('custom-class');
    });
  });

  // Variant tests
  describe('Variants', () => {
    it.each([
      ['contained'],
      ['outlined'],
      ['text']
    ])('renders %s variant correctly', (variant) => {
      renderButton({ children: 'Test Button', variant });
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('variant', variant);
    });
  });

  // Color tests
  describe('Colors', () => {
    it.each([
      ['primary'],
      ['secondary'],
      ['error'],
      ['warning'],
      ['success']
    ])('renders %s color correctly', (color) => {
      renderButton({ children: 'Test Button', color });
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('color', color);
    });
  });

  // Size tests
  describe('Sizes', () => {
    it.each([
      ['small'],
      ['medium'],
      ['large']
    ])('renders %s size correctly', (size) => {
      renderButton({ children: 'Test Button', size });
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('size', size);
    });
  });

  // Disabled state tests
  describe('Disabled State', () => {
    it('renders in disabled state', () => {
      const handleClick = jest.fn();
      renderButton({ 
        children: 'Test Button', 
        disabled: true,
        onClick: handleClick 
      });
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      
      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('maintains focus management when disabled', async () => {
      const user = userEvent.setup();
      renderButton({ children: 'Test Button', disabled: true });
      
      const button = screen.getByRole('button');
      await user.tab();
      
      expect(button).not.toHaveFocus();
    });
  });

  // Loading state tests
  describe('Loading State', () => {
    it('renders loading spinner and updates ARIA attributes', () => {
      renderButton({ 
        children: 'Test Button', 
        loading: true,
        loadingText: 'Loading Test' 
      });
      
      const button = screen.getByRole('button');
      const spinner = screen.getByRole('progressbar');
      const statusElement = screen.getByRole('status');
      
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-label', 'Loading Test');
      expect(statusElement).toBeInTheDocument();
    });

    it('prevents interaction during loading state', () => {
      const handleClick = jest.fn();
      renderButton({ 
        children: 'Test Button', 
        loading: true,
        onClick: handleClick 
      });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  // Interaction tests
  describe('Interactions', () => {
    it('handles click events', async () => {
      const handleClick = jest.fn();
      renderButton({ 
        children: 'Test Button', 
        onClick: handleClick 
      });
      
      const button = screen.getByRole('button');
      await userEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles async click handlers', async () => {
      const asyncHandler = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      renderButton({ 
        children: 'Test Button', 
        onClick: asyncHandler 
      });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(asyncHandler).toHaveBeenCalledTimes(1);
      });
    });

    it('handles keyboard navigation', async () => {
      const handleClick = jest.fn();
      const user = userEvent.setup();
      
      renderButton({ 
        children: 'Test Button', 
        onClick: handleClick 
      });
      
      const button = screen.getByRole('button');
      await user.tab();
      expect(button).toHaveFocus();
      
      await user.keyboard('{enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
      
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('provides appropriate ARIA labels', () => {
      renderButton({ 
        children: 'Test Button',
        ariaLabel: 'Custom Label' 
      });
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
    });

    it('maintains accessible name when content is hidden during loading', () => {
      renderButton({ 
        children: 'Test Button',
        loading: true 
      });
      
      const button = screen.getByRole('button', { name: /test button/i });
      expect(button).toBeInTheDocument();
    });

    it('announces loading state to screen readers', async () => {
      renderButton({ 
        children: 'Test Button',
        loading: true,
        loadingText: 'Custom Loading Message' 
      });
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('handles click handler errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = jest.fn().mockRejectedValue(new Error('Test Error'));
      
      renderButton({ 
        children: 'Test Button', 
        onClick: errorHandler 
      });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Action failed. Please try again.');
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
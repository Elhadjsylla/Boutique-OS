import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  id,
  className = '',
  ...props
}, ref) => {
  const inputId = id || `input-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex flex-col w-full text-left">
      <label
        htmlFor={inputId}
        className="font-label-md text-label-md text-on-surface-variant mb-xs font-semibold uppercase tracking-wider"
      >
        {label}
      </label>

      <input
        ref={ref}
        id={inputId}
        className={`h-12 w-full px-md bg-surface-container-lowest border rounded-xl font-body-lg text-body-lg text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary focus:border-transparent ${
          error ? 'border-error ring-1 ring-error/55' : 'border-outline-variant'
        } ${className}`}
        {...props}
      />

      {error && (
        <span className="font-label-md text-label-md text-error mt-xs font-semibold">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

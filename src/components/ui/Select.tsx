import React, { useState, useRef, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string; // class for the trigger button
  containerClassName?: string; // class for wrapper
  dropdownClassName?: string; // class for option container
  optionClassName?: string; // class for each option
  isAdmin?: boolean; // toggle admin styling
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  className = '',
  containerClassName = '',
  dropdownClassName = '',
  optionClassName = '',
  isAdmin = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  // Styles based on admin or standard mode
  const labelStyles = isAdmin
    ? "text-[9px] font-black uppercase tracking-wider text-admin-text-muted mb-1 text-left"
    : "font-label-md text-label-md text-on-surface-variant mb-xs font-semibold uppercase tracking-wider text-left";

  const triggerStyles = isAdmin
    ? `w-full h-11 px-4 text-xs bg-admin-surface border border-admin-border rounded-xl text-admin-text focus:outline-none focus:ring-2 focus:ring-admin-primary/40 flex items-center justify-between cursor-pointer ${className}`
    : `h-10 px-3 bg-white border border-outline-variant rounded-xl text-xs font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 flex items-center justify-between cursor-pointer ${className}`;

  const dropdownStyles = isAdmin
    ? `absolute left-0 right-0 mt-1.5 bg-admin-card border border-admin-border rounded-xl shadow-xl overflow-hidden z-50 py-1 flex flex-col ${dropdownClassName}`
    : `absolute left-0 right-0 mt-1.5 bg-white border border-outline-variant rounded-xl shadow-lg overflow-hidden z-50 py-1 flex flex-col ${dropdownClassName}`;

  const getOptionStyles = (optVal: string) => {
    const isSelected = optVal === value;
    if (isAdmin) {
      return `px-4 py-2.5 text-xs text-left cursor-pointer transition-colors ${
        isSelected ? 'bg-admin-primary/20 text-admin-primary-light font-bold' : 'text-admin-text hover:bg-admin-surface'
      } ${optionClassName}`;
    } else {
      return `px-4 py-2.5 text-xs text-left cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface hover:bg-surface-container'
      } ${optionClassName}`;
    }
  };

  return (
    <div className={`flex flex-col w-full text-left relative ${containerClassName}`} ref={containerRef}>
      {label && <label className={labelStyles}>{label}</label>}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerStyles}
      >
        <span>{selectedOption ? selectedOption.label : ''}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={dropdownStyles}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              className={getOptionStyles(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { forwardRef } from 'react';

const Input = forwardRef(({ 
  className = '', 
  ...props 
}, ref) => {
  const baseStyles = "flex w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-on-surface-variant";
  
  return (
    <input
      ref={ref}
      className={`${baseStyles} ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;

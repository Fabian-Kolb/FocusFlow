import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  variant = 'elevated',
  padding = 'normal',
  interactive = false,
  ...props 
}) => {
  const variantStyles = {
    elevated: "bg-white border border-outline-variant rounded-xl lg:rounded-2xl shadow-sm relative",
    flat: "bg-white border border-outline-variant rounded-2xl shadow-none relative"
  };

  const baseStyles = variantStyles[variant] || variantStyles.elevated;
  
  const paddings = {
    none: "",
    small: "p-3 sm:p-4",
    normal: "p-4 sm:p-6",
    large: "p-6 sm:p-8"
  };

  const interactiveStyles = interactive 
    ? "hover:border-primary transition-colors cursor-pointer group" 
    : "";

  return (
    <div 
      className={`${baseStyles} ${paddings[padding]} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;

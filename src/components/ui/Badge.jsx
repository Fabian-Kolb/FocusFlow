import React from 'react';

const Badge = ({ 
  children, 
  variant = 'default',
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider";
  
  const variants = {
    default: "bg-surface-low border border-outline-variant text-primary",
    primary: "bg-primary text-on-primary border border-transparent",
    outline: "bg-transparent border border-primary text-primary",
  };

  return (
    <span 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;

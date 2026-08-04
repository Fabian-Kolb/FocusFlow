import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  padding = 'normal',
  interactive = false,
  ...props 
}) => {
  const baseStyles = "bg-white border border-outline-variant rounded-xl shadow-sm";
  
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

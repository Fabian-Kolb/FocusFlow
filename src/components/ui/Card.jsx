import React from 'react';

const Card = ({
  children,
  className = '',
  variant = 'elevated',
  padding = 'normal',
  interactive = false,
  ...props
}) => {
  // elevated: weiße Karte mit weichem Schatten (Standard), flat: nur Rahmen,
  // accent: hebt die eine Hauptkachel eines Screens hervor
  const variantStyles = {
    elevated: "bg-white border border-outline-variant/70 rounded-xl shadow-card relative",
    flat: "bg-white border border-outline-variant rounded-xl shadow-none relative",
    accent: "bg-white border border-accent-border rounded-xl shadow-raised ring-1 ring-accent/10 relative"
  };

  const baseStyles = variantStyles[variant] || variantStyles.elevated;

  const paddings = {
    none: "",
    small: "p-3 sm:p-4",
    normal: "p-4 sm:p-6",
    large: "p-6 sm:p-8"
  };

  const interactiveStyles = interactive
    ? "hover:border-primary/30 hover:shadow-raised transition-[box-shadow,border-color] duration-fast cursor-pointer group"
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

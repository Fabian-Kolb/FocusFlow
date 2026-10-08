import React from 'react';

// Kleine Statusmarke. Satzschreibung statt Großbuchstaben, Farbe nur mit Bedeutung.
const Badge = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const baseStyles = "inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 rounded-md text-xs font-semibold";

  const variants = {
    default: "bg-surface-low border border-outline-variant text-primary",
    primary: "bg-primary text-on-primary border border-transparent",
    outline: "bg-transparent border border-outline-variant text-on-surface-variant",
    accent: "bg-accent-soft border border-accent-border text-accent-strong",
    success: "bg-success-soft border border-success-border text-success",
    info: "bg-info-soft border border-info-border text-info",
    warning: "bg-warning-soft border border-warning-border text-warning",
    danger: "bg-danger-soft border border-danger-border text-danger",
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant] || variants.default} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;

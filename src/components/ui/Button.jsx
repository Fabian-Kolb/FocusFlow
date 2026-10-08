import React from 'react';

/**
 * Einheitlicher Button.
 * Farbe = Bedeutung:
 * - primary (blau): hinzufügen, speichern, senden, bestätigen
 * - destructive (rot): löschen
 * - secondary (neutral): alle übrigen Aktionen
 * - ghost: leise Aktionen in dichten Bereichen
 * - danger-ghost: leises Löschen (rot nur als Text)
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  fullWidth = false,
  loading = false,
  disabled = false,
  type = 'button',
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary: "bg-accent text-white hover:bg-accent-hover border border-transparent shadow-sm",
    secondary: "bg-white text-primary border border-outline-variant hover:border-primary",
    outline: "bg-transparent text-primary border border-primary hover:bg-primary hover:text-white",
    ghost: "bg-transparent text-on-surface-variant hover:text-primary hover:bg-surface-low border border-transparent",
    destructive: "bg-danger text-white hover:opacity-90 border border-transparent",
    "danger-ghost": "bg-transparent text-danger hover:bg-danger-soft border border-transparent",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-md min-h-[32px]",
    md: "px-4 py-2 text-sm rounded-lg min-h-[40px]",
    lg: "px-6 py-3 text-base rounded-lg min-h-[48px]",
    icon: "p-2 rounded-lg min-w-[40px] min-h-[40px]"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${widthClass} ${className}`}
      {...props}
    >
      {loading && <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">progress_activity</span>}
      {children}
    </button>
  );
};

export default Button;

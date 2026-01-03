
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  isLoading,
  disabled,
  ...props 
}) => {
  // Added 'touch-manipulation' to prevent 300ms tap delay on some mobile browsers
  const baseStyles = "rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation";
  
  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-6 py-3",
    lg: "px-8 py-4 text-lg"
  };

  const variants = {
    primary: "bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    danger: "bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400"
  };

  return (
    <button 
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  );
};

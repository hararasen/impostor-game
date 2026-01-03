import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-2 w-full">
    {label && <label className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{label}</label>}
    <input 
      className={`bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors ${className}`}
      {...props}
    />
  </div>
);

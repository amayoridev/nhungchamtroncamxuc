import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
  inputClassName?: string;
  error?: string;
  showIcon?: boolean;
}

export function PasswordInput({
  label,
  icon = <Lock className="w-4 h-4" />,
  containerClassName = '',
  inputClassName = '',
  className = '',
  id,
  error,
  showIcon = true,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  // Combine custom classes with default input styling
  const customClass = inputClassName || className;
  const paddingLeftClass = showIcon && icon ? 'pl-11' : 'pl-4';

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="text-[10px] font-bold text-text-minimal/50 uppercase tracking-wider block ml-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {showIcon && icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-minimal/40 pointer-events-none z-10">
            {icon}
          </span>
        )}
        <input
          {...props}
          id={id}
          type={showPassword ? 'text' : 'password'}
          className={`w-full ${paddingLeftClass} pr-11 py-3 bg-bg-minimal border border-accent-minimal rounded-2xl text-xs focus:outline-none focus:border-primary-minimal transition-all text-text-minimal placeholder:text-text-minimal/30 ${customClass}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-minimal/40 hover:text-text-minimal/80 transition-colors p-1 rounded-lg focus:outline-none cursor-pointer z-10"
          title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          tabIndex={-1}
        >
          {showPassword ? (
            <Eye className="w-4 h-4 text-[#124B31]" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-600 font-semibold ml-1">{error}</p>}
    </div>
  );
}

export default PasswordInput;

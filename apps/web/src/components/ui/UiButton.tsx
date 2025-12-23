/**
 * Назначение файла: кнопка на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'ghost'
  | 'link'
  | 'outline';

export type UiButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export type UiButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
  size?: UiButtonSize;
};

const variantClasses: Record<UiButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  neutral: 'btn-neutral',
  ghost: 'btn-ghost',
  link: 'btn-link',
  outline: 'btn-outline',
};

const sizeClasses: Record<UiButtonSize, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

const UiButton = React.forwardRef<HTMLButtonElement, UiButtonProps>(
  ({ variant = 'primary', size = 'md', type = 'button', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn('btn', variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  },
);

UiButton.displayName = 'UiButton';

export { UiButton };

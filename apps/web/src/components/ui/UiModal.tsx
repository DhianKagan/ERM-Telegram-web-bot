/**
 * Назначение файла: модальное окно на базе DaisyUI.
 * Основные модули: React, cn.
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

export type UiModalProps = Omit<
  React.ComponentProps<'dialog'>,
  'open' | 'children'
> & {
  open?: boolean;
  children?: React.ReactNode;
};

const UiModal = React.forwardRef<HTMLDialogElement, UiModalProps>(
  ({ className, open = false, children, ...props }, ref) => {
    return (
      <dialog ref={ref} open={open} className={cn('modal', className)} {...props}>
        <div className="modal-box">{children}</div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    );
  },
);

UiModal.displayName = 'UiModal';

export { UiModal };

import { toast as sonnerToast } from 'svelte-sonner';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastInit {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface Toast extends ToastInit {
  id: string | number;
  variant: ToastVariant;
}

type SonnerData = Parameters<typeof sonnerToast>[1];

function toSonnerData(init: ToastInit): SonnerData {
  return {
    description: init.description,
    duration: init.duration,
  } as SonnerData;
}

function dispatch(init: ToastInit | string): string | number {
  const base: ToastInit = typeof init === 'string' ? { description: init } : init;
  const variant = base.variant ?? 'info';
  const message = base.title ?? base.description ?? '';
  const data = toSonnerData(
    base.title ? base : { ...base, description: undefined },
  );
  switch (variant) {
    case 'success':
      return sonnerToast.success(message, data);
    case 'warning':
      return sonnerToast.warning(message, data);
    case 'danger':
      return sonnerToast.error(message, data);
    case 'info':
    default:
      return sonnerToast.info(message, data);
  }
}

export function toast(init: ToastInit | string): string | number {
  return dispatch(init);
}

toast.info = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  dispatch({ ...init, description, variant: 'info' });
toast.success = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  dispatch({ ...init, description, variant: 'success' });
toast.warning = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  dispatch({ ...init, description, variant: 'warning' });
toast.danger = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  dispatch({ ...init, description, variant: 'danger' });
toast.dismiss = (id?: string | number) => sonnerToast.dismiss(id);
toast.clear = () => sonnerToast.dismiss();

export const toaster = {
  push: (init: ToastInit | string) => dispatch(init),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  clear: () => sonnerToast.dismiss(),
};

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastInit {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

export interface Toast extends ToastInit {
  id: number;
  variant: ToastVariant;
  duration: number;
}

const DEFAULT_DURATION = 4500;

class ToasterStore {
  toasts = $state<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  push(init: ToastInit | string): number {
    const base: ToastInit = typeof init === 'string' ? { description: init } : init;
    const toast: Toast = {
      id: this.nextId++,
      title: base.title,
      description: base.description,
      variant: base.variant ?? 'info',
      duration: base.duration ?? DEFAULT_DURATION,
    };
    this.toasts = [...this.toasts, toast];
    if (toast.duration > 0) {
      const timer = setTimeout(() => this.dismiss(toast.id), toast.duration);
      this.timers.set(toast.id, timer);
    }
    return toast.id;
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.toasts = [];
  }
}

export const toaster = new ToasterStore();

export function toast(init: ToastInit | string): number {
  return toaster.push(init);
}

toast.info = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  toaster.push({ ...init, description, variant: 'info' });
toast.success = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  toaster.push({ ...init, description, variant: 'success' });
toast.warning = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  toaster.push({ ...init, description, variant: 'warning' });
toast.danger = (description: string, init?: Omit<ToastInit, 'description' | 'variant'>) =>
  toaster.push({ ...init, description, variant: 'danger' });
toast.dismiss = (id: number) => toaster.dismiss(id);
toast.clear = () => toaster.clear();

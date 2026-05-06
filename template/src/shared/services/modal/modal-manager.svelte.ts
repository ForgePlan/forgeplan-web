import type { Component, ComponentProps } from 'svelte';

// Generic Component type covers the unknown-prop-shape case we need at the
// store level; per-call, the public open() signature still infers props from
// the concrete component type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any>;

export interface ModalEntry {
  id: number;
  component: AnyComponent;
  props: Record<string, unknown>;
  resolve: (value: unknown) => void;
}

export interface ModalManager {
  readonly stack: ModalEntry[];
  open<C extends AnyComponent>(
    component: C,
    props?: Omit<ComponentProps<C>, 'modalId'>,
  ): Promise<unknown>;
  close(id: number, value?: unknown): void;
  closeTop(value?: unknown): void;
}

function createModalManager(): ModalManager {
  const stack = $state<ModalEntry[]>([]);
  let nextId = 1;

  function open<C extends AnyComponent>(
    component: C,
    props?: Omit<ComponentProps<C>, 'modalId'>,
  ): Promise<unknown> {
    return new Promise((resolve) => {
      const id = nextId++;
      stack.push({
        id,
        component,
        props: (props ?? {}) as Record<string, unknown>,
        resolve,
      });
    });
  }

  function close(id: number, value: unknown = undefined): void {
    const idx = stack.findIndex((entry) => entry.id === id);
    if (idx === -1) return;
    const removed = stack.splice(idx, 1);
    const entry = removed[0];
    if (!entry) return;
    entry.resolve(value);
  }

  function closeTop(value: unknown = undefined): void {
    const top = stack[stack.length - 1];
    if (top) close(top.id, value);
  }

  return {
    get stack() {
      return stack;
    },
    open,
    close,
    closeTop,
  };
}

export const modalManager: ModalManager = createModalManager();

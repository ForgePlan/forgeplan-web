<script lang="ts">
  import type { Snippet } from 'svelte';
  import '@/app';
  import { ModalRoot, Toaster, TooltipProvider } from '@/shared/ui';

  const { children }: { children?: Snippet } = $props();
</script>

<TooltipProvider>
  {@render children?.()}
  <ModalRoot />
  <Toaster />
</TooltipProvider>

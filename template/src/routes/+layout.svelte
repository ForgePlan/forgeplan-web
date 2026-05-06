<script lang="ts">
  import type { Snippet } from 'svelte';
  import '@/app';
  import { ModalRoot } from '@/shared/ui';

  const { children }: { children?: Snippet } = $props();
</script>

{@render children?.()}
<ModalRoot />

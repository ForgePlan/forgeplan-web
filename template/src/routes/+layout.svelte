<script lang="ts">
  import type { Snippet } from 'svelte';
  import '@/app';

  const { children }: { children?: Snippet } = $props();
</script>

{@render children?.()}

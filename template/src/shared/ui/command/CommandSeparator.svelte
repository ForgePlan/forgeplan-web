<script lang="ts">
  import { Command as CommandPrimitive } from 'bits-ui';

  interface Props {
    class?: string;
  }

  let { class: className }: Props = $props();
</script>

<CommandPrimitive.Separator class="command-separator {className ?? ''}" />

<style>
  :global(.command-separator) {
    height: 1px;
    margin: 4px 0;
    background: var(--line);
  }
</style>

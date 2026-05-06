<script lang="ts">
  import { modalManager } from '@/shared/services';
</script>

{#each modalManager.stack as entry (entry.id)}
  {@const { component: ModalComponent, props, id } = entry}
  <ModalComponent {...props} modalId={id} />
{/each}

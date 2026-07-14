<script lang="ts">
  export let categories: string[] = [];
  let active = 'All';
  $: options = ['All', ...new Set(categories)];
</script>

<div class="filter" role="group" aria-label="Project filters">
  {#each options as option}
    <button
      type="button"
      class:active={active === option}
      aria-pressed={active === option}
      onclick={() => (active = option)}>{option}</button
    >
  {/each}
</div>

<style>
  .filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  button {
    min-height: 2rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: transparent;
    color: var(--muted-foreground);
    font: 0.68rem var(--font-mono);
    cursor: pointer;
  }
  button:hover,
  button.active {
    border-color: var(--accent);
    color: var(--foreground);
  }
  button.active {
    background: var(--accent-soft);
  }
</style>

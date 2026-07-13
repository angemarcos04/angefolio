<script lang="ts">
  export let label = 'Preview card';
  let visible = true;
</script>

<div class="demo">
  <span>{label}</span>
  <button
    type="button"
    aria-pressed={visible}
    onclick={() => (visible = !visible)}
  >
    {visible ? 'Visible' : 'Hidden'}
  </button>
</div>

<style>
  .demo {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--muted-foreground);
    font: 0.7rem var(--font-mono);
  }
  button {
    padding: 0.3rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    cursor: pointer;
  }
</style>

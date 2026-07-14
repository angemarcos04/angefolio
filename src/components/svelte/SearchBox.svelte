<script lang="ts">
  import { onMount } from 'svelte';

  interface SearchResultData {
    url: string;
    excerpt: string;
    meta: {
      title?: string;
    };
  }

  interface PagefindResult {
    data: () => Promise<SearchResultData>;
  }

  interface PagefindModule {
    search: (query: string) => Promise<{ results: PagefindResult[] }>;
  }

  let query = '';
  let loading = false;
  let results: SearchResultData[] = [];
  let message = 'Enter a term to search the public site.';
  let pagefind: PagefindModule | undefined;

  async function loadPagefind() {
    if (pagefind) return pagefind;

    // Pagefind creates this module after Astro's bundle step, so keep the
    // browser import outside Vite's build-time module resolution.
    const importPagefind = new Function('path', 'return import(path)') as (
      path: string,
    ) => Promise<PagefindModule>;
    pagefind = await importPagefind('/pagefind/pagefind.js');
    return pagefind;
  }

  async function runSearch() {
    const term = query.trim();

    if (!term) {
      results = [];
      message = 'Enter a term to search the public site.';
      return;
    }

    loading = true;
    message = 'Searching…';

    try {
      const searchIndex = await loadPagefind();
      const response = await searchIndex.search(term);
      results = await Promise.all(
        response.results.slice(0, 20).map((result) => result.data()),
      );
      message = `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${term}”.`;

      const url = new URL(window.location.href);
      url.searchParams.set('q', term);
      window.history.replaceState({}, '', url);
    } catch {
      results = [];
      message =
        'Search index is available after a production build. You can still browse Projects, Notes, and Lab directly.';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    query = new URLSearchParams(window.location.search).get('q') ?? '';
    if (query) void runSearch();
  });
</script>

<section
  class="search-shell bento-surface"
  aria-labelledby="search-label"
  data-pagefind-ignore
>
  <form
    role="search"
    onsubmit={(event) => {
      event.preventDefault();
      void runSearch();
    }}
  >
    <label id="search-label" for="site-search">Search the public archive</label>
    <div class="search-control">
      <input
        id="site-search"
        name="q"
        type="search"
        bind:value={query}
        placeholder="Try Astro, Linux, CSPAMS…"
        autocomplete="off"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Searching…' : 'Search'}
      </button>
    </div>
  </form>

  <p class="status" aria-live="polite">{message}</p>

  {#if results.length > 0}
    <ol class="results" aria-label="Search results">
      {#each results as result}
        <li>
          <a href={result.url}>
            <span>{result.meta.title ?? 'Untitled page'}</span>
            <small>{result.url}</small>
          </a>
          <p>{@html result.excerpt}</p>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .search-shell {
    min-width: 0;
    padding: clamp(1rem, 4vw, 1.5rem);
    box-shadow: none;
  }
  form {
    display: grid;
    gap: 0.55rem;
  }
  label {
    color: var(--accent-text);
    font: 0.7rem var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .search-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.55rem;
  }
  input,
  button {
    min-height: 2.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font: 0.9rem var(--type-body);
  }
  input {
    min-width: 0;
    padding: 0.65rem 0.75rem;
    background: var(--background);
    color: var(--foreground);
  }
  input::placeholder {
    color: var(--muted-foreground);
  }
  button {
    padding: 0.65rem 1rem;
    border-color: var(--primary-background);
    background: var(--primary-background);
    color: var(--accent-foreground);
    font-family: var(--type-ui);
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    cursor: wait;
    opacity: 0.68;
  }
  .status {
    margin: 0.9rem 0 0;
    color: var(--muted-foreground);
    font: 0.875rem/1.5 var(--type-body);
  }
  .results {
    display: grid;
    gap: 0;
    margin: 1.25rem 0 0;
    padding: 0;
    border-top: 1px solid var(--border);
    list-style: none;
  }
  .results li {
    min-width: 0;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border);
  }
  .results a {
    display: grid;
    gap: 0.15rem;
  }
  .results a:hover span {
    color: var(--accent-text);
  }
  .results a span {
    font-family: var(--type-heading);
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .results small {
    overflow-wrap: anywhere;
    color: var(--subtle-foreground);
    font: 0.64rem var(--font-mono);
  }
  .results p {
    max-width: 64ch;
    margin: 0.45rem 0 0;
    color: var(--muted-foreground);
    font-size: 1rem;
    line-height: 1.65;
  }
  .results :global(mark) {
    background: color-mix(in srgb, var(--accent) 24%, transparent);
    color: var(--foreground);
  }
  @media (max-width: 480px) {
    .search-control {
      grid-template-columns: 1fr;
    }
  }
</style>

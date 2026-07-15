<script lang="ts">
  import { onMount } from 'svelte';
  import type { ProgressSection } from '../../lib/data/homeProgress';

  export let sections: ProgressSection[] = [];

  type ResolvedSection = ProgressSection & {
    index: number;
    element: HTMLElement;
  };

  let activeIndex = 0;
  let progress = 0;

  onMount(() => {
    const resolvedSections: ResolvedSection[] = sections
      .map((section, index) => {
        const element = document.getElementById(section.id);

        return element
          ? {
              ...section,
              index,
              element,
            }
          : null;
      })
      .filter((section): section is ResolvedSection => section !== null);

    let framePending = false;
    let settleFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const update = () => {
      const documentElement = document.documentElement;
      const viewportHeight = window.innerHeight;
      const scrollableDistance = documentElement.scrollHeight - viewportHeight;

      progress =
        scrollableDistance > 0
          ? Math.min(Math.max(window.scrollY / scrollableDistance, 0), 1)
          : 0;

      if (resolvedSections.length === 0) {
        activeIndex = 0;
        return;
      }

      if (window.scrollY <= 0) {
        activeIndex = 0;
        return;
      }

      const reachedBottom =
        window.scrollY + viewportHeight >= documentElement.scrollHeight - 2;

      if (reachedBottom) {
        activeIndex = resolvedSections[resolvedSections.length - 1].index;
        return;
      }

      const activationPoint = viewportHeight * 0.35;
      let nextActiveIndex = 0;

      for (const section of resolvedSections) {
        const top = section.element.getBoundingClientRect().top;

        if (top <= activationPoint) {
          nextActiveIndex = section.index;
        }
      }

      activeIndex = nextActiveIndex;
    };

    const scheduleUpdate = () => {
      if (framePending) return;

      framePending = true;

      requestAnimationFrame(() => {
        update();
        framePending = false;
      });
    };

    update();
    settleFrame = requestAnimationFrame(update);

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('load', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('load', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
      resizeObserver?.disconnect();
      if (settleFrame !== null) {
        cancelAnimationFrame(settleFrame);
      }

      if (framePending) {
        framePending = false;
      }
    };
  });
</script>

<nav
  class="home-progress"
  aria-label="Homepage sections"
  style={`--scroll-progress: ${progress}`}
>
  <ol class="home-progress__list">
    {#each sections as section, index}
      <li class="home-progress__item">
        <a
          href={`#${section.id}`}
          class:is-active={index === activeIndex}
          class:is-complete={index < activeIndex}
          aria-current={index === activeIndex ? 'location' : undefined}
          aria-label={section.label}
          data-label={section.label}
        >
          <span class="home-progress__dot" aria-hidden="true"></span>
          <span class="sr-only">{section.label}</span>
        </a>
      </li>
    {/each}
  </ol>

  <span class="home-progress__track" aria-hidden="true"></span>
  <span class="home-progress__fill" aria-hidden="true"></span>
</nav>

<style>
  .home-progress {
    position: fixed;
    z-index: 20;
    top: 50%;
    left: max(1rem, calc((100vw - 1180px) / 2 - 2.125rem));
    display: none;
    transform: translateY(-50%);
    color: var(--foreground);
  }

  .home-progress__list {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 1.4rem;
    margin: 0;
    padding: 0.25rem 0;
    list-style: none;
  }

  .home-progress__track,
  .home-progress__fill {
    position: absolute;
    top: 1rem;
    bottom: 1rem;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    border-radius: 999px;
    pointer-events: none;
  }

  .home-progress__track {
    background: color-mix(in srgb, var(--border) 78%, transparent);
  }

  .home-progress__fill {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--accent) 90%, transparent),
      color-mix(in srgb, var(--accent-hover) 72%, transparent)
    );
    transform: translateX(-50%) scaleY(var(--scroll-progress, 0));
    transform-origin: top;
  }

  .home-progress__item {
    position: relative;
  }

  .home-progress__item a {
    position: relative;
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border-radius: 999px;
    color: inherit;
    outline: none;
  }

  .home-progress__dot {
    position: relative;
    z-index: 1;
    width: 0.62rem;
    height: 0.62rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: color-mix(in srgb, var(--muted-foreground) 32%, var(--card));
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--background) 82%, transparent);
    transition:
      transform 140ms ease,
      width 140ms ease,
      height 140ms ease,
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .home-progress__item a:hover .home-progress__dot,
  .home-progress__item a:focus-visible .home-progress__dot {
    transform: scale(1.08);
    border-color: var(--accent-text);
    background: color-mix(in srgb, var(--muted-foreground) 48%, var(--card));
  }

  .home-progress__item a.is-complete .home-progress__dot {
    border-color: color-mix(in srgb, var(--accent) 50%, var(--border-strong));
    background: color-mix(in srgb, var(--accent) 38%, var(--card));
  }

  .home-progress__item a.is-active .home-progress__dot {
    width: 0.95rem;
    height: 0.95rem;
    border-color: color-mix(
      in srgb,
      var(--accent-hover) 70%,
      var(--background)
    );
    background: var(--accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--background) 82%, transparent);
  }

  .home-progress__item a.is-active:hover .home-progress__dot,
  .home-progress__item a.is-active:focus-visible .home-progress__dot {
    transform: scale(1.04);
    border-color: var(--accent-hover);
  }

  .home-progress__item a::after {
    position: absolute;
    top: 50%;
    left: calc(100% + 0.65rem);
    width: max-content;
    max-width: 12rem;
    padding: 0.34rem 0.52rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    box-shadow: var(--shadow-soft);
    content: attr(data-label);
    font: 0.66rem var(--font-mono);
    letter-spacing: 0.06em;
    opacity: 0;
    pointer-events: none;
    transform: translate(0, -50%) translateX(-0.2rem);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
    white-space: nowrap;
  }

  .home-progress__item a:hover::after,
  .home-progress__item a:focus-visible::after {
    opacity: 1;
    transform: translate(0, -50%);
  }

  .home-progress__item a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (min-width: 1280px) {
    .home-progress {
      display: block;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-progress__dot,
    .home-progress__fill,
    .home-progress__item a::after {
      transition: none;
    }
  }
</style>

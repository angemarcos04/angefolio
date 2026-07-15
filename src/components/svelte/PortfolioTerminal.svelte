<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { commandNames, executeCommand } from '../../lib/terminal/commands';
  import { completeInput } from '../../lib/terminal/completion';
  import { buildFilesystem, displayPath } from '../../lib/terminal/filesystem';
  import { parseCommandLine } from '../../lib/terminal/parser';
  import type {
    PortfolioTerminalData,
    TerminalLine,
  } from '../../lib/terminal/types';
  import { applyTheme } from '../../lib/theme';

  export let data: PortfolioTerminalData;

  interface OutputBlock {
    id: number;
    prompt?: string;
    lines: TerminalLine[];
  }

  const filesystem = buildFilesystem(data);
  const startupLines: TerminalLine[] = [
    {
      text: 'angefolio virtual shell — read-only portfolio environment',
      kind: 'accent',
    },
    { text: 'type `help` to list commands', kind: 'muted' },
  ];
  const previewFocus = data.nowItems[0] ?? 'Building angefolio.';
  const previewQueue =
    data.nowItems.slice(1, 3).join(' · ') || 'No queued items.';
  const previewLog = data.buildCommit
    ? `${data.buildCommit.slice(0, 8)} angefolio build commit`
    : data.latestUpdate
      ? `${data.latestUpdate.date ?? 'content'} ${data.latestUpdate.label}`
      : 'commit metadata unavailable in this build';

  let open = false;
  let input = '';
  let cwd = '';
  let history: string[] = [];
  let historyIndex = 0;
  let historyDraft = '';
  let output: OutputBlock[] = [{ id: 0, lines: startupLines }];
  let nextOutputId = 1;
  let liveMessage = '';
  let inputElement: HTMLInputElement;
  let triggerElement: HTMLButtonElement;
  let dialogElement: HTMLDialogElement;
  let returnFocus: HTMLElement | null = null;
  let previousBodyOverflow = '';

  const prompt = () => `${data.username}@${data.hostname}:${displayPath(cwd)}$`;

  function scrollToNewest() {
    void tick().then(() => {
      const scroller =
        dialogElement?.querySelector<HTMLElement>('.terminal-output');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  }

  function focusInput() {
    void tick().then(() => inputElement?.focus());
  }

  function openTerminal() {
    if (open) return;
    returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : triggerElement;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    open = true;
    focusInput();
    scrollToNewest();
  }

  function closeTerminal() {
    if (!open) return;
    open = false;
    document.body.style.overflow = previousBodyOverflow;
    void tick().then(() => (returnFocus ?? triggerElement)?.focus());
  }

  function addBlock(lines: TerminalLine[], commandPrompt?: string) {
    output = [...output, { id: nextOutputId, prompt: commandPrompt, lines }];
    nextOutputId += 1;
    const newest = lines.at(-1)?.text;
    if (newest) liveMessage = newest;
  }

  function followNavigation(url: string, external = false) {
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(url);
    }
  }

  function runInput() {
    const commandLine = input.trim();
    if (!commandLine) return;

    history = [...history, commandLine];
    historyIndex = history.length;
    historyDraft = '';
    input = '';

    const parsed = parseCommandLine(commandLine);
    if (parsed.error) {
      addBlock([{ text: parsed.error, kind: 'error' }], prompt());
      scrollToNewest();
      return;
    }

    addBlock([], prompt());
    output[output.length - 1].lines = [{ text: commandLine, kind: 'command' }];
    output = [...output];

    for (const parsedCommand of parsed.commands) {
      const result = executeCommand(parsedCommand.name, parsedCommand.args, {
        data,
        filesystem,
        cwd,
        history,
      });

      if (result.clear) output = [];
      if (result.cwd !== undefined) cwd = result.cwd;
      if (result.lines?.length) addBlock(result.lines);
      if (result.theme) applyTheme(result.theme);
      if (result.navigate) {
        followNavigation(result.navigate.url, result.navigate.external);
      }
      if (result.close) {
        closeTerminal();
        break;
      }
      if (result.ok === false) break;
    }

    scrollToNewest();
  }

  function cancelInput() {
    addBlock(
      [
        { text: input, kind: 'command' },
        { text: '^C', kind: 'accent' },
      ],
      prompt(),
    );
    input = '';
    historyIndex = history.length;
    historyDraft = '';
    scrollToNewest();
  }

  function navigateHistory(direction: -1 | 1) {
    if (history.length === 0) return;
    if (direction === -1) {
      if (historyIndex === history.length) historyDraft = input;
      historyIndex = Math.max(0, historyIndex - 1);
      input = history[historyIndex];
      return;
    }

    historyIndex = Math.min(history.length, historyIndex + 1);
    input =
      historyIndex === history.length ? historyDraft : history[historyIndex];
  }

  function completeCommand() {
    const completion = completeInput(input, {
      commandNames,
      cwd,
      filesystem,
      projectSlugs: data.projects.map((project) => project.slug),
      routeNames: [
        ...Object.keys(data.routes),
        ...data.socials.map((social) => social.label.toLowerCase()),
        'github',
        'email',
      ],
    });
    input = completion.value;
    if (completion.candidates.length > 1) {
      addBlock([{ text: completion.candidates.join('  '), kind: 'muted' }]);
      scrollToNewest();
    }
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      runInput();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateHistory(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateHistory(1);
    } else if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      completeCommand();
    } else if (event.ctrlKey && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      output = [];
    } else if (event.ctrlKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      cancelInput();
    }
  }

  function handleDialogClick(event: MouseEvent) {
    if (event.target === dialogElement) closeTerminal();
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.code === 'Backquote') {
      event.preventDefault();
      open ? closeTerminal() : openTerminal();
      return;
    }
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTerminal();
      return;
    }
    if (event.defaultPrevented) return;
    if (event.key !== 'Tab') return;

    const focusable = dialogElement?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeydown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeydown);
      if (open) document.body.style.overflow = previousBodyOverflow;
    };
  });
</script>

<button
  bind:this={triggerElement}
  type="button"
  class="terminal-preview terminal-glow"
  aria-label="Open the interactive angefolio terminal"
  aria-haspopup="dialog"
  aria-expanded={open}
  onclick={openTerminal}
  data-pagefind-ignore
>
  <span class="terminal-bar" aria-hidden="true">
    <span class="terminal-dots"><i></i><i></i><i></i></span>
    <strong>{data.username}@{data.hostname}:~</strong>
  </span>
  <span class="preview-body">
    <span><b>$ status</b></span>
    <span>focus: {previewFocus}</span>
    <span>queue: {previewQueue}</span>
    <span class="preview-spacer" aria-hidden="true"></span>
    <span><b>$ git log -1 --oneline</b></span>
    <span>{previewLog}</span>
    <span class="interaction-hint"
      >click to enter&nbsp;&nbsp; Ctrl+` to toggle</span
    >
  </span>
</button>

{#if open}
  <dialog
    bind:this={dialogElement}
    open
    class="terminal-dialog"
    aria-modal="true"
    aria-labelledby="portfolio-terminal-title"
    onclick={handleDialogClick}
    data-pagefind-ignore
  >
    <section class="terminal-window terminal-glow">
      <header class="terminal-bar">
        <span class="terminal-dots" aria-hidden="true"
          ><i></i><i></i><i></i></span
        >
        <h2 id="portfolio-terminal-title">
          {data.username}@{data.hostname}:{displayPath(cwd)}
        </h2>
        <button
          type="button"
          class="close-button"
          aria-label="Close portfolio terminal"
          onclick={closeTerminal}>×</button
        >
      </header>

      <div class="terminal-output" aria-live="off">
        {#each output as block (block.id)}
          <div class="output-block">
            {#if block.prompt}
              <div class="command-row">
                <span class="prompt">{block.prompt}</span>
                {#if block.lines[0]?.kind === 'command'}
                  <span>{block.lines[0].text}</span>
                {/if}
              </div>
            {/if}
            {#each block.prompt && block.lines[0]?.kind === 'command' ? block.lines.slice(1) : block.lines as outputLine}
              <div
                class:line-error={outputLine.kind === 'error'}
                class:line-muted={outputLine.kind === 'muted'}
                class:line-accent={outputLine.kind === 'accent'}
                class="output-line"
              >
                <span>{outputLine.text}</span>
                {#if outputLine.links?.length}
                  <span class="output-links">
                    {#each outputLine.links as link}
                      <a
                        href={link.url}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        >[{link.label}]</a
                      >
                    {/each}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}

        <label class="input-row">
          <span class="prompt">{prompt()}</span>
          <span class="sr-only">Terminal command</span>
          <input
            bind:this={inputElement}
            bind:value={input}
            aria-label="Terminal command input"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            onkeydown={handleInputKeydown}
          />
        </label>
      </div>
      <p class="terminal-help">
        Tab complete · ↑↓ history · Ctrl+L clear · Esc close
      </p>
      <span class="sr-only" aria-live="polite" aria-atomic="true"
        >{liveMessage}</span
      >
    </section>
  </dialog>
{/if}

<style>
  .terminal-preview {
    display: block;
    width: 100%;
    max-width: 100%;
    margin-top: 1.35rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 34%, var(--border));
    border-radius: var(--radius-lg);
    background: var(--terminal-background);
    color: var(--terminal-foreground);
    font-family: var(--type-code);
    font-variant-ligatures: none;
    font-feature-settings:
      'calt' 0,
      'liga' 0;
    text-align: left;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      transform 140ms ease;
  }
  .terminal-preview:hover,
  .terminal-preview:focus-visible {
    border-color: var(--accent);
  }
  .terminal-preview:active {
    transform: translateY(1px);
  }
  .terminal-bar {
    display: flex;
    min-height: 2.15rem;
    align-items: center;
    gap: 0.36rem;
    padding: 0.45rem 0.7rem;
    border-bottom: 1px solid var(--border);
    color: var(--terminal-muted);
  }
  .terminal-dots {
    display: inline-flex;
    flex: none;
    gap: 0.36rem;
  }
  .terminal-dots i {
    width: 0.48rem;
    height: 0.48rem;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      var(--accent) 25%,
      var(--terminal-background)
    );
  }
  .terminal-dots i:nth-child(2) {
    background: var(--accent);
  }
  .terminal-dots i:nth-child(3) {
    background: var(--terminal-accent);
  }
  .terminal-bar strong,
  .terminal-bar h2 {
    min-width: 0;
    margin: 0 0 0 0.35rem;
    overflow: hidden;
    font-size: 0.66rem;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .preview-body {
    display: grid;
    gap: 0.18rem;
    padding: clamp(0.75rem, 3vw, 1rem);
    font-size: clamp(0.7rem, 2vw, 0.78rem);
    overflow-wrap: anywhere;
  }
  .preview-body b,
  .prompt,
  .output-links a {
    color: var(--terminal-accent);
    font-weight: 500;
  }
  .preview-spacer {
    height: 0.25rem;
  }
  .interaction-hint {
    margin-top: 0.45rem;
    color: var(--terminal-muted);
    font-size: 0.66rem;
  }
  .terminal-dialog {
    position: fixed;
    z-index: 80;
    inset: 0;
    display: grid;
    width: 100%;
    max-width: none;
    height: 100%;
    max-height: none;
    margin: 0;
    padding: clamp(0.75rem, 3vw, 2rem);
    place-items: center;
    border: 0;
    background: color-mix(in srgb, var(--background) 78%, transparent);
  }
  .terminal-window {
    display: grid;
    width: min(78vw, 68rem);
    height: min(78vh, 48rem);
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
    border-radius: var(--radius-lg);
    background: var(--terminal-background);
    color: var(--terminal-foreground);
    font: clamp(0.72rem, 1.5vw, 0.84rem)/1.55 var(--type-code);
    font-variant-ligatures: none;
    font-feature-settings:
      'calt' 0,
      'liga' 0;
    box-shadow: var(--shadow-soft);
  }
  .terminal-window .terminal-bar {
    min-width: 0;
  }
  .terminal-window h2 {
    flex: 1;
  }
  .close-button {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: none;
    margin-left: auto;
    place-items: center;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--terminal-muted);
    font: 1.1rem/1 var(--type-code);
    cursor: pointer;
  }
  .close-button:hover {
    border-color: var(--border);
    color: var(--terminal-foreground);
  }
  .terminal-output {
    min-width: 0;
    overflow: auto;
    padding: clamp(0.85rem, 2vw, 1.2rem);
    scrollbar-color: var(--border-strong) var(--terminal-background);
  }
  .output-block + .output-block {
    margin-top: 0.3rem;
  }
  .command-row,
  .input-row,
  .output-line {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .command-row,
  .input-row {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
  }
  .prompt {
    flex: none;
    white-space: nowrap;
  }
  .line-muted {
    color: var(--terminal-muted);
  }
  .line-accent {
    color: var(--terminal-accent);
  }
  .line-error {
    color: var(--danger-foreground);
  }
  .output-links {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-left: 0.55rem;
  }
  .output-links a:hover {
    color: var(--terminal-foreground);
  }
  .input-row {
    margin-top: 0.35rem;
  }
  input {
    width: 100%;
    min-width: 2rem;
    padding: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--terminal-foreground);
    font: inherit;
    caret-color: var(--terminal-accent);
  }
  .terminal-help {
    margin: 0;
    padding: 0.4rem 0.75rem;
    border-top: 1px solid var(--border);
    color: var(--terminal-muted);
    font-size: 0.63rem;
    text-align: right;
  }
  @media (max-width: 700px) {
    .terminal-dialog {
      padding: max(0.5rem, env(safe-area-inset-top)) 0.5rem
        max(0.5rem, env(safe-area-inset-bottom));
    }
    .terminal-window {
      width: 100%;
      height: min(92dvh, 50rem);
    }
    .terminal-help {
      text-align: left;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .terminal-preview {
      transition: none;
    }
    .terminal-preview:active {
      transform: none;
    }
  }
</style>

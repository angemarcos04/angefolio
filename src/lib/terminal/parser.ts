export interface ParsedCommand {
  name: string;
  args: string[];
  raw: string;
}

export interface ParseResult {
  commands: ParsedCommand[];
  error?: string;
}

function tokenize(input: string): { tokens: string[]; error?: string } {
  const tokens: string[] = [];
  let token = '';
  let quote: '"' | "'" | null = null;
  let tokenStarted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      if (character === quote) {
        quote = null;
      } else if (character === '\\' && input[index + 1] === quote) {
        token += quote;
        index += 1;
      } else {
        token += character;
      }
      tokenStarted = true;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(character)) {
      if (tokenStarted) {
        tokens.push(token);
        token = '';
        tokenStarted = false;
      }
      continue;
    }

    token += character;
    tokenStarted = true;
  }

  if (quote) return { tokens, error: 'Unclosed quoted string.' };
  if (tokenStarted) tokens.push(token);
  return { tokens };
}

function splitChain(input: string): { parts: string[]; error?: string } {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      current += character;
      if (character === quote && input[index - 1] !== '\\') quote = null;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }

    if (character === '&' && input[index + 1] === '&') {
      if (!current.trim()) return { parts, error: 'Unexpected `&&`.' };
      parts.push(current.trim());
      current = '';
      index += 1;
      continue;
    }

    current += character;
  }

  if (!current.trim() && parts.length > 0) {
    return { parts, error: 'Expected a command after `&&`.' };
  }
  if (current.trim()) parts.push(current.trim());
  return { parts };
}

export function parseCommandLine(input: string): ParseResult {
  const chain = splitChain(input.trim());
  if (chain.error) return { commands: [], error: chain.error };

  const commands: ParsedCommand[] = [];
  for (const raw of chain.parts) {
    const parsed = tokenize(raw);
    if (parsed.error) return { commands: [], error: parsed.error };
    const [name = '', ...args] = parsed.tokens;
    if (name) commands.push({ name: name.toLowerCase(), args, raw });
  }

  return { commands };
}

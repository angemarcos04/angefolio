import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { isSafeImageReference } from '../data/mediaReference';

export interface ProjectHeading {
  id: string;
  label: string;
}

function decodeHeadingText(value: string): string {
  const codePoint = (value: number) =>
    value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => codePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      codePoint(Number.parseInt(code, 16)),
    )
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

export function renderProjectMarkdownDocument(source: string): {
  html: string;
  headings: ProjectHeading[];
} {
  const html = marked.parse(source, { async: false, gfm: true, breaks: false });
  const sanitized = sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      a: ['href', 'title'],
      code: ['class'],
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  });
  // Keep Markdown images limited to uploaded assets, site images, or HTTPS.
  // sanitize-html removes event handlers and all other attributes first.
  const safe = sanitized.replace(/<img\b[^>]*>/gi, (tag) => {
    const source = /\bsrc="([^"]*)"/i.exec(tag)?.[1]?.replaceAll('&amp;', '&');
    if (!source || !isSafeImageReference(source)) return '';
    return tag.replace(/\s*\/?\s*>$/, ' loading="lazy" decoding="async">');
  });
  const headings: ProjectHeading[] = [];
  const used = new Map<string, number>();
  const withIds = safe.replace(
    /<h([1-6])>([\s\S]*?)<\/h\1>/g,
    (_, level: string, inner: string) => {
      const label = decodeHeadingText(inner).trim();
      const base =
        label
          .toLowerCase()
          .normalize('NFKD')
          .replace(/\p{M}/gu, '')
          .replace(/[^\p{L}\p{N}]+/gu, '-')
          .replace(/^-|-$/g, '') || 'section';
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count + 1}`;
      if (Number(level) <= 3) headings.push({ id, label });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );
  return { html: withIds, headings };
}

export function renderProjectMarkdown(source: string): string {
  return renderProjectMarkdownDocument(source).html;
}

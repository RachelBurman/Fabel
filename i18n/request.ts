import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

const locales = ['en', 'es', 'fr', 'de', 'it', 'zh', 'ja'];

function parseAcceptLanguage(header: string): string {
  const parts = header.split(',').map(part => {
    const [tag, q] = part.trim().split(';q=');
    return { tag: tag.trim().toLowerCase(), q: q ? parseFloat(q) : 1.0 };
  }).sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const exact = locales.find(l => l === tag);
    if (exact) return exact;
    const prefix = locales.find(l => tag.startsWith(l + '-'));
    if (prefix) return prefix;
  }
  return 'en';
}

export default getRequestConfig(async () => {
  const headerStore = await headers();
  const locale = parseAcceptLanguage(headerStore.get('accept-language') ?? '');

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

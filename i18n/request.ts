import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

const locales = ['en', 'es', 'fr', 'de', 'it', 'zh', 'ja'];

export default getRequestConfig(async () => {
  // Prefer explicit locale cookie (set when user switches language)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && locales.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: (await import(`../messages/${cookieLocale}.json`)).default,
    };
  }

  // Fall back to Accept-Language header
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language') ?? '';
  const detected = locales.find(l => acceptLanguage.toLowerCase().startsWith(l));
  const locale = detected ?? 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

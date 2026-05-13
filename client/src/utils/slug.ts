export function slugify(input: string): string {
  const s = (input ?? '').trim().toLowerCase();
  if (!s) return '';

  // Basic RU transliteration (good enough for MVP SEO URLs)
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  };

  const translit = s
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('');

  return translit
    .replace(/[^a-z0-9]+/g, '-')   // separators
    .replace(/^-+|-+$/g, '')       // trim dashes
    .replace(/-{2,}/g, '-')        // collapse
    .slice(0, 80);                 // keep URLs short-ish
}

export function newsPath(id: number, title: string): string {
  const slug = slugify(title);
  return slug ? `/news/${id}-${slug}` : `/news/${id}`;
}


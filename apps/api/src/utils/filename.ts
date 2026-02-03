const CYRILLIC_PATTERN = /[\u0400-\u04ff]/;

const hasCyrillic = (value: string): boolean => CYRILLIC_PATTERN.test(value);

export const normalizeFilename = (value: string): string => {
  if (!value) return value;
  if (hasCyrillic(value)) return value;
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  if (decoded !== value && hasCyrillic(decoded)) {
    return decoded;
  }
  return value;
};

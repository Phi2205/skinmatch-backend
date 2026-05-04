/**
 * Convert a string to a URL-friendly slug.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Normalize Unicode to separate accents
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '') // Remove special characters
    .replace(/(\s+)/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Remove consecutive -
    .replace(/^-+/, '') // Remove leading -
    .replace(/-+$/, ''); // Remove trailing -
}

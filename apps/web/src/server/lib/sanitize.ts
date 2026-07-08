// Strips dangerous HTML from user-submitted content before database storage.
// Prevents XSS — stored cross-site scripting attacks.
// Usage: const clean = sanitize(userInput)

import DOMPurify from 'isomorphic-dompurify';

// Enforce rel="noopener noreferrer" on every target="_blank" link to prevent
// reverse tabnapping (window.opener hijack). Chrome 88+ adds noopener implicitly
// but this hook provides defense-in-depth across all browsers.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node instanceof Element && node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function sanitize(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORCE_BODY: true,
  });
}

// For plain text fields — strips ALL HTML
export function sanitizePlainText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

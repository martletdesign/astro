/** Resolve a starter-local route under the configured Astro base. */
export const localPath = (path = '') => `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;

import createClient from 'openapi-fetch';
import type { paths } from './schema';
export const api = createClient<paths>({
  baseUrl: '',
  credentials: 'include',
  headers: { 'X-Requested-With': 'AvecLesFemmes' },
});
export type { paths, components } from './schema';

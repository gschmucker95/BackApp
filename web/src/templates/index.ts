import type { Template } from './types';
import { postgresDockerComposeTemplate } from './postgres-docker-compose';
import { postgresNativeTemplate } from './postgres-native';

/** All registered templates (use Template<any> for heterogeneous array) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const templates: Record<string, Template<any>> = {
  "postgres-docker-compose": postgresDockerComposeTemplate,
  "postgres-native": postgresNativeTemplate,
};

/** Get a template by ID */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTemplateById(id: string): Template<any> | undefined {
  return templates[id];
}

/** Get template metadata for listing */
export function getTemplateList(): Array<{ id: string; name: string; description: string }> {
  return Object.entries(templates).map(([id, t]) => ({
    id,
    name: t.name,
    description: t.description,
  }));
}

// Re-export types
export * from './types';

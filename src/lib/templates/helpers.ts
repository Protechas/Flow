import { BUILTIN_ENTERPRISE_TEMPLATES } from "./builtin-templates";
import {
  getEnterpriseTemplate,
  listEnterpriseTemplates,
  listTemplatesForDepartment,
} from "./template-registry";

const BUILTIN_IDS = new Set(BUILTIN_ENTERPRISE_TEMPLATES.map((t) => t.id));

export function isEnterpriseTemplateId(id: string): boolean {
  return BUILTIN_IDS.has(id) || id.startsWith("tpl-");
}

export function getEnterpriseTemplateOrNull(id: string) {
  return getEnterpriseTemplate(id);
}

export { listEnterpriseTemplates, listTemplatesForDepartment };

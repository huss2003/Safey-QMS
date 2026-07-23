export function audit(action: string, entity: string, payload?: unknown) {
  console.info(`[audit ${new Date().toISOString()}] ${action} :: ${entity}`, payload ?? "");
}

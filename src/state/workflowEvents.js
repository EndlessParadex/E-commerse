let revision = 0;
const listeners = new Set();
export const workflowRevision = () => revision;
export const subscribeWorkflow = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function notifyWorkflow() { revision += 1; for (const listener of listeners) listener(); }

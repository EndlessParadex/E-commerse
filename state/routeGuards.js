const guards = new Set();
let approvedRoute = '';
export function registerRouteGuard(guard) { guards.add(guard); return () => guards.delete(guard); }
export function approveNextRoute(route) { approvedRoute = route; }
export function canLeaveRoute(next) {
  const approved = approvedRoute === next; approvedRoute = '';
  return approved || [...guards].every((guard) => guard());
}

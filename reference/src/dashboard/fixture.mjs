// The canonical fixture remains authoritative; each page transfers only the
// fields its controller consumes. Embedded JSON cannot terminate its script tag.
export function dashboardPayload(view, fixture) {
  switch (view) {
    case 'analytics': return {analytics:fixture.analytics,categories:fixture.categories};
    case 'administration': return {people:fixture.people};
    case 'operations': return {as_of:fixture.as_of,services:fixture.services,alerts:fixture.alerts,activity:fixture.activity};
    default: throw new Error(`Unsupported dashboard: ${view}`);
  }
}
export function serializeForScript(value) {
  return JSON.stringify(value).replace(/</g,'\\u003c');
}

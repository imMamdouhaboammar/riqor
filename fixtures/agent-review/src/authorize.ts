export type Membership = { userId: string; tenantId: string; active: boolean; actions: string[] };

export function canAccess(
  userId: string | undefined,
  tenantId: string,
  action: string,
  memberships: Membership[],
) {
  if (!userId) return action === "read";
  return memberships.some((membership) => membership.userId === userId && membership.actions.includes(action));
}

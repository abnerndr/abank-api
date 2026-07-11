export interface AuthPrincipal {
  id: string;
  roles: string[];
}

export function isAdmin(principal: AuthPrincipal): boolean {
  return principal.roles.includes('admin');
}

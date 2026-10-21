import type { MemberRole } from "@/db/schema";

// Matriz central de autorización de DEETA. Es la única fuente de verdad: la
// usan la interfaz, las server actions, las consultas SQL (lista de roles
// permitidos) y DEETA AI. No duplicar estas reglas en componentes.

export const PERMISSIONS = [
  "SALE_CREATE",
  "SALE_VIEW",
  "SALE_CANCEL",
  "CREDIT_SALE",
  "PRODUCT_VIEW",
  "PRODUCT_CREATE",
  "PRODUCT_EDIT",
  "PRODUCT_PRICE_EDIT",
  "PRODUCT_IMPORT",
  "PRODUCT_DELETE",
  "STOCK_VIEW",
  "STOCK_ADJUST",
  "CASH_OPEN",
  "CASH_CLOSE",
  "CASH_VIEW_HISTORY",
  "EXPENSE_VIEW",
  "EXPENSE_CREATE",
  "EXPENSE_CANCEL",
  "EXPENSE_CATEGORY_MANAGE",
  "ANALYTICS_VIEW",
  "PROFITABILITY_VIEW",
  "CUSTOMER_VIEW",
  "CUSTOMER_EDIT",
  "CUSTOMER_PAYMENT",
  "CUSTOMER_ADJUSTMENT",
  "CUSTOMER_DEACTIVATE",
  "AI_USE",
  "TEAM_VIEW",
  "TEAM_INVITE",
  "TEAM_MANAGE",
  "OWNER_MANAGE",
  "BUSINESS_SETTINGS",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Roles que se pueden asignar hoy. EMPLOYEE es el rol anterior al sprint de
// equipo: se conserva en la base y se trata como Encargado.
export const ASSIGNABLE_ROLES = ["OWNER", "ADMIN", "MANAGER", "SELLER"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const SELLER: Permission[] = [
  "SALE_CREATE",
  "SALE_VIEW",
  "CREDIT_SALE",
  "PRODUCT_VIEW",
  "STOCK_VIEW",
  "CASH_OPEN",
  "CUSTOMER_VIEW",
  "CUSTOMER_EDIT",
  "CUSTOMER_PAYMENT",
  "AI_USE",
];

const MANAGER: Permission[] = [
  ...SELLER,
  "SALE_CANCEL",
  "PRODUCT_CREATE",
  "PRODUCT_EDIT",
  "PRODUCT_PRICE_EDIT",
  "PRODUCT_IMPORT",
  "STOCK_ADJUST",
  "CASH_CLOSE",
  "CASH_VIEW_HISTORY",
  "EXPENSE_VIEW",
  "EXPENSE_CREATE",
  "ANALYTICS_VIEW",
];

const ADMIN: Permission[] = PERMISSIONS.filter((permission) => permission !== "OWNER_MANAGE");

const MATRIX: Record<MemberRole, ReadonlySet<Permission>> = {
  OWNER: new Set(PERMISSIONS),
  ADMIN: new Set(ADMIN),
  MANAGER: new Set(MANAGER),
  SELLER: new Set(SELLER),
  EMPLOYEE: new Set(MANAGER),
};

export function effectiveRole(role: MemberRole): AssignableRole {
  return role === "EMPLOYEE" ? "MANAGER" : role;
}

export function hasPermission(role: MemberRole | null | undefined, permission: Permission) {
  return Boolean(role && MATRIX[role]?.has(permission));
}

export function permissionsFor(role: MemberRole): Permission[] {
  return PERMISSIONS.filter((permission) => MATRIX[role].has(permission));
}

// Roles con un permiso, para filtrar en SQL: `role = any(${rolesWith(...)})`.
export function rolesWith(permission: Permission): MemberRole[] {
  return (Object.keys(MATRIX) as MemberRole[]).filter((role) => MATRIX[role].has(permission));
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  MANAGER: "Encargado",
  SELLER: "Vendedor",
  EMPLOYEE: "Encargado",
};

export const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
  OWNER: "Acceso completo al negocio.",
  ADMIN: "Puede administrar la mayor parte del negocio.",
  MANAGER: "Puede gestionar la operación diaria.",
  SELLER: "Puede registrar ventas y acceder a funciones básicas.",
};

// Resumen legible de "este rol puede…" (informativo, no editable).
export const ROLE_CAPABILITIES: Record<AssignableRole, string[]> = {
  OWNER: ["Todo lo del administrador", "Gestionar dueños del negocio"],
  ADMIN: ["Ver análisis y rentabilidad", "Gestionar equipo y configuración", "Anular gastos y ajustar cuentas de clientes"],
  MANAGER: ["Vender y cancelar ventas", "Cargar productos, precios y stock", "Abrir y cerrar caja", "Registrar gastos"],
  SELLER: ["Vender, también fiado", "Consultar productos y stock", "Abrir la caja", "Registrar pagos de clientes"],
};

// Reglas de gestión de equipo, puras para poder probarlas.
export type TeamChangeIssue = "FORBIDDEN" | "SELF" | "OWNER_ONLY" | "LAST_OWNER";

export function teamRoleChangeIssue(input: {
  actorRole: MemberRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: MemberRole;
  nextRole: AssignableRole;
  ownerCount: number;
}): TeamChangeIssue | null {
  if (!hasPermission(input.actorRole, "TEAM_MANAGE")) return "FORBIDDEN";
  if (input.actorUserId === input.targetUserId) return "SELF";
  const touchesOwner = input.targetRole === "OWNER" || input.nextRole === "OWNER";
  if (touchesOwner && !hasPermission(input.actorRole, "OWNER_MANAGE")) return "OWNER_ONLY";
  if (input.targetRole === "OWNER" && input.nextRole !== "OWNER" && input.ownerCount <= 1) return "LAST_OWNER";
  return null;
}

export function teamRemovalIssue(input: {
  actorRole: MemberRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: MemberRole;
  ownerCount: number;
}): TeamChangeIssue | null {
  if (!hasPermission(input.actorRole, "TEAM_MANAGE")) return "FORBIDDEN";
  if (input.actorUserId === input.targetUserId) return "SELF";
  if (input.targetRole === "OWNER" && !hasPermission(input.actorRole, "OWNER_MANAGE")) return "OWNER_ONLY";
  if (input.targetRole === "OWNER" && input.ownerCount <= 1) return "LAST_OWNER";
  return null;
}

export function invitationRoleIssue(actorRole: MemberRole, role: AssignableRole): TeamChangeIssue | null {
  if (!hasPermission(actorRole, "TEAM_INVITE")) return "FORBIDDEN";
  if (role === "OWNER" && !hasPermission(actorRole, "OWNER_MANAGE")) return "OWNER_ONLY";
  return null;
}

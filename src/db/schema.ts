import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  foreignKey,
  integer,
  index,
  pgEnum,
  pgTable,
  pgView,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...auditColumns,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...auditColumns,
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...auditColumns,
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...auditColumns,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const businessCategory = pgEnum("business_category", [
  "KIOSK",
  "GROCERY",
  "HARDWARE_STORE",
  "CLOTHING_STORE",
  "HEALTH_FOOD_STORE",
  "BAKERY",
  "DISTRIBUTOR",
  "OTHER",
]);

// EMPLOYEE es el rol anterior al equipo: se conserva y se trata como MANAGER.
export const memberRole = pgEnum("member_role", ["OWNER", "ADMIN", "EMPLOYEE", "MANAGER", "SELLER"]);
export const invitationStatus = pgEnum("invitation_status", ["PENDING", "ACCEPTED", "CANCELLED"]);

export const business = pgTable("business", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: businessCategory("category").notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  phone: text("phone"),
  timezone: text("timezone").default("America/Argentina/Buenos_Aires").notNull(),
  ...auditColumns,
}, (table) => [
  check("business_timezone_supported", sql`${table.timezone} in ('America/Argentina/Buenos_Aires', 'America/Montevideo')`),
]);

export const businessMember = pgTable(
  "business_member",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: memberRole("role").default("EMPLOYEE").notNull(),
    // Negocio activo de la persona: exactamente una membresía por usuario.
    isCurrent: boolean("is_current").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("business_member_user_current_unique").on(table.userId).where(sql`${table.isCurrent}`),
    uniqueIndex("business_member_business_user_unique").on(table.businessId, table.userId),
    index("business_member_user_idx").on(table.userId),
    index("business_member_business_idx").on(table.businessId),
  ],
);

// Membresía del negocio activo. Todas las lecturas acotadas por usuario usan
// esta vista para no mezclar negocios cuando una persona pertenece a varios.
export const activeMembership = pgView("active_membership", {
  id: text("id").notNull(),
  businessId: text("business_id").notNull(),
  userId: text("user_id").notNull(),
  role: memberRole("role").notNull(),
  isCurrent: boolean("is_current").notNull(),
}).existing();

export const businessInvitation = pgTable(
  "business_invitation",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull(),
    // Solo se guarda el hash SHA-256 del token; el token viaja únicamente en el enlace.
    tokenHash: text("token_hash").notNull(),
    status: invitationStatus("status").default("PENDING").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    acceptedBy: text("accepted_by").references(() => user.id, { onDelete: "restrict" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("business_invitation_token_hash_unique").on(table.tokenHash),
    uniqueIndex("business_invitation_pending_email_unique")
      .on(table.businessId, table.email)
      .where(sql`${table.status} = 'PENDING'`),
    index("business_invitation_business_status_idx").on(table.businessId, table.status),
    check("business_invitation_email_lowercase", sql`${table.email} = lower(${table.email})`),
    check("business_invitation_role_assignable", sql`${table.role} <> 'EMPLOYEE'`),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    // Solo datos no sensibles: nunca contraseñas, tokens ni secretos.
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_log_business_created_idx").on(table.businessId, table.createdAt),
    index("audit_log_business_entity_idx").on(table.businessId, table.entityType, table.entityId),
  ],
);

export const stockMovementType = pgEnum("stock_movement_type", [
  "INITIAL",
  "IN",
  "OUT",
  "ADJUSTMENT",
  "SALE",
  "PURCHASE",
  "RETURN",
]);

export const productImportStatus = pgEnum("product_import_status", [
  "UPLOADED",
  "READY",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
]);

export const productImportRowStatus = pgEnum("product_import_row_status", [
  "PENDING",
  "READY",
  "WARNING",
  "ERROR",
  "IMPORTED",
  "UPDATED",
  "SKIPPED",
]);

export const productImportExistingStrategy = pgEnum("product_import_existing_strategy", [
  "SKIP",
  "UPDATE_PRICES",
  "UPDATE_PRICES_STOCK",
]);

export const product = pgTable(
  "product",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    costPriceCents: bigint("cost_price_cents", { mode: "number" }).notNull(),
    salePriceCents: bigint("sale_price_cents", { mode: "number" }).notNull(),
    currentStock: integer("current_stock").default(0).notNull(),
    minimumStock: integer("minimum_stock").default(0).notNull(),
    barcode: text("barcode"),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("product_id_business_unique").on(table.id, table.businessId),
    uniqueIndex("product_business_barcode_unique")
      .on(table.businessId, table.barcode)
      .where(sql`${table.barcode} is not null`),
    index("product_business_active_idx").on(table.businessId, table.isActive),
    index("product_business_active_created_idx").on(table.businessId, table.isActive, table.createdAt),
    index("product_business_name_idx").on(table.businessId, table.name),
    check("product_cost_price_nonnegative", sql`${table.costPriceCents} >= 0`),
    check("product_sale_price_nonnegative", sql`${table.salePriceCents} >= 0`),
    check("product_current_stock_nonnegative", sql`${table.currentStock} >= 0`),
    check("product_minimum_stock_nonnegative", sql`${table.minimumStock} >= 0`),
  ],
);

export const stockMovement = pgTable(
  "stock_movement",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    productId: text("product_id").notNull(),
    type: stockMovementType("type").notNull(),
    quantity: integer("quantity").notNull(),
    previousStock: integer("previous_stock").notNull(),
    resultingStock: integer("resulting_stock").notNull(),
    reason: text("reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.productId, table.businessId],
      foreignColumns: [product.id, product.businessId],
      name: "stock_movement_product_business_fk",
    }).onDelete("cascade"),
    index("stock_movement_business_product_created_idx").on(
      table.businessId,
      table.productId,
      table.createdAt,
    ),
    index("stock_movement_created_by_idx").on(table.createdBy),
    check("stock_movement_previous_nonnegative", sql`${table.previousStock} >= 0`),
    check("stock_movement_resulting_nonnegative", sql`${table.resultingStock} >= 0`),
  ],
);

export const productImport = pgTable(
  "product_import",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    originalFilename: text("original_filename").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size").notNull(),
    status: productImportStatus("status").default("UPLOADED").notNull(),
    headers: jsonb("headers").$type<string[]>().notNull(),
    mapping: jsonb("mapping").$type<Record<string, string>>(),
    existingStrategy: productImportExistingStrategy("existing_strategy").default("SKIP").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    readyRows: integer("ready_rows").default(0).notNull(),
    warningRows: integer("warning_rows").default(0).notNull(),
    errorRows: integer("error_rows").default(0).notNull(),
    importedRows: integer("imported_rows").default(0).notNull(),
    updatedRows: integer("updated_rows").default(0).notNull(),
    skippedRows: integer("skipped_rows").default(0).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("product_import_id_business_unique").on(table.id, table.businessId),
    index("product_import_business_created_idx").on(table.businessId, table.createdAt),
    index("product_import_created_by_idx").on(table.createdBy),
    check("product_import_file_type_supported", sql`${table.fileType} in ('CSV', 'XLSX')`),
    check("product_import_file_size_positive", sql`${table.fileSize} > 0`),
    check(
      "product_import_counts_nonnegative",
      sql`${table.totalRows} >= 0 and ${table.readyRows} >= 0 and ${table.warningRows} >= 0 and ${table.errorRows} >= 0 and ${table.importedRows} >= 0 and ${table.updatedRows} >= 0 and ${table.skippedRows} >= 0`,
    ),
  ],
);

export const productImportRow = pgTable(
  "product_import_row",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    importId: text("import_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    rawValues: jsonb("raw_values").$type<string[]>().notNull(),
    overrides: jsonb("overrides").$type<Record<string, string>>(),
    status: productImportRowStatus("status").default("PENDING").notNull(),
    issues: jsonb("issues").$type<string[]>().default([]).notNull(),
    included: boolean("included").default(true).notNull(),
    name: text("name"),
    description: text("description"),
    barcode: text("barcode"),
    costPriceCents: bigint("cost_price_cents", { mode: "number" }),
    salePriceCents: bigint("sale_price_cents", { mode: "number" }),
    initialStock: integer("initial_stock"),
    minimumStock: integer("minimum_stock"),
    existingProductId: text("existing_product_id"),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.importId, table.businessId],
      foreignColumns: [productImport.id, productImport.businessId],
      name: "product_import_row_import_business_fk",
    }).onDelete("cascade"),
    uniqueIndex("product_import_row_import_number_unique").on(table.importId, table.rowNumber),
    index("product_import_row_business_import_status_idx").on(table.businessId, table.importId, table.status),
    index("product_import_row_import_barcode_idx").on(table.importId, table.barcode),
    check("product_import_row_number_positive", sql`${table.rowNumber} > 1`),
    check("product_import_row_cost_nonnegative", sql`${table.costPriceCents} is null or ${table.costPriceCents} >= 0`),
    check("product_import_row_sale_nonnegative", sql`${table.salePriceCents} is null or ${table.salePriceCents} >= 0`),
    check("product_import_row_stock_nonnegative", sql`${table.initialStock} is null or ${table.initialStock} >= 0`),
    check("product_import_row_minimum_nonnegative", sql`${table.minimumStock} is null or ${table.minimumStock} >= 0`),
  ],
);

// CREDIT = venta 100 % fiada; MIXED = venta con el cobro dividido en sale_payment.
export const paymentMethod = pgEnum("payment_method", ["CASH", "TRANSFER", "CARD", "CREDIT", "MIXED"]);
export const salePaymentMethod = pgEnum("sale_payment_method", ["CASH", "TRANSFER", "CARD", "CREDIT"]);
export const customerMovementType = pgEnum("customer_movement_type", [
  "CREDIT_SALE",
  "PAYMENT",
  "SALE_CANCELLATION",
  "ADJUSTMENT",
]);
export const saleStatus = pgEnum("sale_status", ["COMPLETED", "CANCELLED"]);
export const incomeSource = pgEnum("income_source", ["SALE", "OTHER", "SERVICE", "MANUAL", "CUSTOMER_PAYMENT"]);
export const incomeStatus = pgEnum("income_status", ["ACTIVE", "REVERSED"]);
export const cashSessionStatus = pgEnum("cash_session_status", ["OPEN", "CLOSED"]);
export const scannerPairingStatus = pgEnum("scanner_pairing_status", [
  "WAITING",
  "CONNECTED",
  "EXPIRED",
  "REVOKED",
]);
export const scannerEventStatus = pgEnum("scanner_event_status", [
  "FOUND",
  "NOT_FOUND",
  "OUT_OF_STOCK",
]);
export const expensePaymentMethod = pgEnum("expense_payment_method", ["CASH", "TRANSFER", "CARD", "OTHER"]);
export const expenseStatus = pgEnum("expense_status", ["ACTIVE", "CANCELLED"]);
export const aiMessageRole = pgEnum("ai_message_role", ["USER", "ASSISTANT"]);
export const aiRequestStatus = pgEnum("ai_request_status", ["STARTED", "SUCCEEDED", "FAILED"]);

export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    document: text("document"),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "restrict" }),
    // Saldo materializado para listar rápido. La fuente de verdad son los
    // movimientos: cada operación lo actualiza en la misma sentencia.
    balanceCents: bigint("balance_cents", { mode: "number" }).default(0).notNull(),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("customer_id_business_unique").on(table.id, table.businessId),
    index("customer_business_active_name_idx").on(table.businessId, table.isActive, table.name),
    index("customer_business_balance_idx").on(table.businessId, table.balanceCents),
    check("customer_name_length", sql`char_length(${table.name}) between 2 and 120`),
    check("customer_balance_nonnegative", sql`${table.balanceCents} >= 0`),
  ],
);

export const cashSession = pgTable(
  "cash_session",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    openedBy: text("opened_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    closedBy: text("closed_by").references(() => user.id, { onDelete: "restrict" }),
    openingAmountCents: bigint("opening_amount_cents", { mode: "number" }).notNull(),
    expectedCashCents: bigint("expected_cash_cents", { mode: "number" }).notNull(),
    declaredCashCents: bigint("declared_cash_cents", { mode: "number" }),
    differenceCents: bigint("difference_cents", { mode: "number" }),
    status: cashSessionStatus("status").default("OPEN").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("cash_session_id_business_unique").on(table.id, table.businessId),
    uniqueIndex("cash_session_one_open_per_business")
      .on(table.businessId)
      .where(sql`${table.status} = 'OPEN'`),
    index("cash_session_business_opened_idx").on(table.businessId, table.openedAt),
    check("cash_session_opening_nonnegative", sql`${table.openingAmountCents} >= 0`),
    check(
      "cash_session_closed_values",
      sql`(${table.status} = 'OPEN' and ${table.closedAt} is null and ${table.closedBy} is null and ${table.declaredCashCents} is null and ${table.differenceCents} is null)
        or (${table.status} = 'CLOSED' and ${table.closedAt} is not null and ${table.closedBy} is not null and ${table.declaredCashCents} is not null and ${table.differenceCents} is not null)`,
    ),
  ],
);

export const sale = pgTable(
  "sale",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    cashSessionId: text("cash_session_id"),
    customerId: text("customer_id"),
    clientRequestId: text("client_request_id"),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    status: saleStatus("status").default("COMPLETED").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.cashSessionId, table.businessId],
      foreignColumns: [cashSession.id, cashSession.businessId],
      name: "sale_cash_session_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.customerId, table.businessId],
      foreignColumns: [customer.id, customer.businessId],
      name: "sale_customer_business_fk",
    }).onDelete("restrict"),
    uniqueIndex("sale_id_business_unique").on(table.id, table.businessId),
    uniqueIndex("sale_business_client_request_unique")
      .on(table.businessId, table.clientRequestId)
      .where(sql`${table.clientRequestId} is not null`),
    index("sale_business_customer_idx").on(table.businessId, table.customerId),
    index("sale_business_created_idx").on(table.businessId, table.createdAt),
    index("sale_business_status_created_idx").on(table.businessId, table.status, table.createdAt),
    index("sale_cash_session_idx").on(table.cashSessionId),
    check("sale_total_positive", sql`${table.totalCents} > 0`),
  ],
);

export const salePayment = pgTable(
  "sale_payment",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    saleId: text("sale_id").notNull(),
    method: salePaymentMethod("method").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.saleId, table.businessId],
      foreignColumns: [sale.id, sale.businessId],
      name: "sale_payment_sale_business_fk",
    }).onDelete("cascade"),
    uniqueIndex("sale_payment_sale_method_unique").on(table.saleId, table.method),
    index("sale_payment_business_method_idx").on(table.businessId, table.method),
    check("sale_payment_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const saleItem = pgTable(
  "sale_item",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    saleId: text("sale_id").notNull(),
    productId: text("product_id").notNull(),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.saleId, table.businessId],
      foreignColumns: [sale.id, sale.businessId],
      name: "sale_item_sale_business_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productId, table.businessId],
      foreignColumns: [product.id, product.businessId],
      name: "sale_item_product_business_fk",
    }).onDelete("restrict"),
    uniqueIndex("sale_item_sale_product_unique").on(table.saleId, table.productId),
    index("sale_item_product_idx").on(table.productId),
    index("sale_item_business_product_idx").on(table.businessId, table.productId),
    check("sale_item_quantity_positive", sql`${table.quantity} > 0`),
    check("sale_item_price_nonnegative", sql`${table.unitPriceCents} >= 0`),
    check("sale_item_cost_nonnegative", sql`${table.unitCostCents} >= 0`),
    check("sale_item_subtotal_nonnegative", sql`${table.subtotalCents} >= 0`),
  ],
);

export const income = pgTable(
  "income",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    saleId: text("sale_id"),
    cashSessionId: text("cash_session_id"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    source: incomeSource("source").notNull(),
    status: incomeStatus("status").default("ACTIVE").notNull(),
    reversedBy: text("reversed_by").references(() => user.id, { onDelete: "restrict" }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.saleId, table.businessId],
      foreignColumns: [sale.id, sale.businessId],
      name: "income_sale_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.cashSessionId, table.businessId],
      foreignColumns: [cashSession.id, cashSession.businessId],
      name: "income_cash_session_business_fk",
    }).onDelete("restrict"),
    // Una venta con cobro dividido genera un ingreso por medio de pago.
    uniqueIndex("income_sale_method_unique").on(table.saleId, table.paymentMethod).where(sql`${table.saleId} is not null`),
    index("income_business_created_idx").on(table.businessId, table.createdAt),
    index("income_cash_session_idx").on(table.cashSessionId),
    check("income_amount_positive", sql`${table.amountCents} > 0`),
  ],
);

export const customerAccountMovement = pgTable(
  "customer_account_movement",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    customerId: text("customer_id").notNull(),
    type: customerMovementType("type").notNull(),
    // Convención única: positivo aumenta la deuda, negativo la reduce.
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    balanceAfterCents: bigint("balance_after_cents", { mode: "number" }).notNull(),
    saleId: text("sale_id"),
    paymentMethod: paymentMethod("payment_method"),
    cashSessionId: text("cash_session_id"),
    note: text("note"),
    idempotencyKey: text("idempotency_key"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.customerId, table.businessId],
      foreignColumns: [customer.id, customer.businessId],
      name: "customer_movement_customer_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.saleId, table.businessId],
      foreignColumns: [sale.id, sale.businessId],
      name: "customer_movement_sale_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.cashSessionId, table.businessId],
      foreignColumns: [cashSession.id, cashSession.businessId],
      name: "customer_movement_cash_session_business_fk",
    }).onDelete("restrict"),
    index("customer_movement_business_customer_created_idx").on(table.businessId, table.customerId, table.createdAt),
    index("customer_movement_business_type_created_idx").on(table.businessId, table.type, table.createdAt),
    index("customer_movement_sale_idx").on(table.saleId),
    index("customer_movement_cash_session_idx").on(table.cashSessionId),
    uniqueIndex("customer_movement_business_idempotency_unique")
      .on(table.businessId, table.idempotencyKey)
      .where(sql`${table.idempotencyKey} is not null`),
    check("customer_movement_balance_nonnegative", sql`${table.balanceAfterCents} >= 0`),
    check(
      "customer_movement_sign_by_type",
      sql`(${table.type} = 'CREDIT_SALE' and ${table.amountCents} > 0)
        or (${table.type} in ('PAYMENT', 'SALE_CANCELLATION') and ${table.amountCents} < 0)
        or (${table.type} = 'ADJUSTMENT' and ${table.amountCents} <> 0)`,
    ),
    check(
      "customer_movement_payment_method",
      sql`(${table.type} = 'PAYMENT' and ${table.paymentMethod} in ('CASH', 'TRANSFER', 'CARD'))
        or (${table.type} <> 'PAYMENT' and ${table.paymentMethod} is null)`,
    ),
  ],
);

export const expenseCategory = pgTable(
  "expense_category",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("expense_category_id_business_unique").on(table.id, table.businessId),
    uniqueIndex("expense_category_business_name_unique").on(table.businessId, table.name),
    index("expense_category_business_active_idx").on(table.businessId, table.isActive),
    check("expense_category_name_length", sql`char_length(${table.name}) between 2 and 80`),
  ],
);

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    categoryId: text("category_id").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    paymentMethod: expensePaymentMethod("payment_method").notNull(),
    cashSessionId: text("cash_session_id"),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    status: expenseStatus("status").default("ACTIVE").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    cancelledBy: text("cancelled_by").references(() => user.id, { onDelete: "restrict" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    ...auditColumns,
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId, table.businessId],
      foreignColumns: [expenseCategory.id, expenseCategory.businessId],
      name: "expense_category_business_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.cashSessionId, table.businessId],
      foreignColumns: [cashSession.id, cashSession.businessId],
      name: "expense_cash_session_business_fk",
    }).onDelete("restrict"),
    index("expense_business_date_status_idx").on(table.businessId, table.expenseDate, table.status),
    index("expense_business_category_date_idx").on(table.businessId, table.categoryId, table.expenseDate),
    index("expense_cash_session_idx").on(table.cashSessionId),
    index("expense_created_at_idx").on(table.businessId, table.createdAt),
    check("expense_amount_positive", sql`${table.amountCents} > 0`),
    check("expense_description_length", sql`char_length(${table.description}) between 2 and 200`),
    check(
      "expense_cancellation_state",
      sql`(${table.status} = 'ACTIVE' and ${table.cancelledAt} is null and ${table.cancelledBy} is null)
        or (${table.status} = 'CANCELLED' and ${table.cancelledAt} is not null and ${table.cancelledBy} is not null)`,
    ),
  ],
);

export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("ai_conversation_id_business_unique").on(table.id, table.businessId),
    index("ai_conversation_business_user_updated_idx").on(table.businessId, table.userId, table.updatedAt),
    check("ai_conversation_title_length", sql`char_length(${table.title}) between 1 and 120`),
  ],
);

export const aiMessage = pgTable(
  "ai_message",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    conversationId: text("conversation_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: aiMessageRole("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.conversationId, table.businessId],
      foreignColumns: [aiConversation.id, aiConversation.businessId],
      name: "ai_message_conversation_business_fk",
    }).onDelete("cascade"),
    index("ai_message_conversation_created_idx").on(table.conversationId, table.createdAt),
    index("ai_message_business_user_idx").on(table.businessId, table.userId),
    check("ai_message_content_length", sql`char_length(${table.content}) between 1 and 8000`),
  ],
);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(() => aiConversation.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: aiRequestStatus("status").default("STARTED").notNull(),
    toolCalls: integer("tool_calls").default(0).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("ai_usage_business_created_idx").on(table.businessId, table.createdAt),
    index("ai_usage_user_created_idx").on(table.userId, table.createdAt),
    check("ai_usage_tokens_nonnegative", sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.totalTokens} >= 0 and ${table.toolCalls} >= 0`),
  ],
);

export const scannerPairingSession = pgTable(
  "scanner_pairing_session",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => business.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    targetCartId: text("target_cart_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: scannerPairingStatus("status").default("WAITING").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("scanner_pairing_id_business_unique").on(table.id, table.businessId),
    uniqueIndex("scanner_pairing_token_hash_unique").on(table.tokenHash),
    uniqueIndex("scanner_pairing_active_cart_unique")
      .on(table.businessId, table.targetCartId)
      .where(sql`${table.status} in ('WAITING', 'CONNECTED')`),
    index("scanner_pairing_business_status_idx").on(table.businessId, table.status),
    index("scanner_pairing_expires_idx").on(table.expiresAt),
  ],
);

export const scannerScanEvent = pgTable(
  "scanner_scan_event",
  {
    id: text("id").primaryKey(),
    sequence: bigserial("sequence", { mode: "number" }).notNull(),
    businessId: text("business_id").notNull(),
    pairingSessionId: text("pairing_session_id").notNull(),
    productId: text("product_id"),
    barcode: text("barcode").notNull(),
    format: text("format"),
    status: scannerEventStatus("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.pairingSessionId, table.businessId],
      foreignColumns: [scannerPairingSession.id, scannerPairingSession.businessId],
      name: "scanner_event_pairing_business_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.productId, table.businessId],
      foreignColumns: [product.id, product.businessId],
      name: "scanner_event_product_business_fk",
    }).onDelete("restrict"),
    uniqueIndex("scanner_event_sequence_unique").on(table.sequence),
    index("scanner_event_pairing_sequence_idx").on(table.pairingSessionId, table.sequence),
    index("scanner_event_business_created_idx").on(table.businessId, table.createdAt),
    check("scanner_event_barcode_length", sql`char_length(${table.barcode}) between 1 and 80`),
  ],
);

export const authSchema = { user, session, account, verification };

export type Business = typeof business.$inferSelect;
export type MemberRole = (typeof memberRole.enumValues)[number];
export type BusinessInvitation = typeof businessInvitation.$inferSelect;
export type Product = typeof product.$inferSelect;
export type StockMovement = typeof stockMovement.$inferSelect;
export type StockMovementType = (typeof stockMovementType.enumValues)[number];
export type ProductImport = typeof productImport.$inferSelect;
export type ProductImportRow = typeof productImportRow.$inferSelect;
export type ProductImportStatus = (typeof productImportStatus.enumValues)[number];
export type ProductImportRowStatus = (typeof productImportRowStatus.enumValues)[number];
export type ProductImportExistingStrategy = (typeof productImportExistingStrategy.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type Sale = typeof sale.$inferSelect;
export type SaleItem = typeof saleItem.$inferSelect;
export type CashSession = typeof cashSession.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type CustomerAccountMovement = typeof customerAccountMovement.$inferSelect;
export type CustomerMovementType = (typeof customerMovementType.enumValues)[number];
export type SalePaymentMethod = (typeof salePaymentMethod.enumValues)[number];
export type Income = typeof income.$inferSelect;
export type ScannerPairingSession = typeof scannerPairingSession.$inferSelect;
export type ScannerScanEvent = typeof scannerScanEvent.$inferSelect;
export type ExpenseCategory = typeof expenseCategory.$inferSelect;
export type Expense = typeof expense.$inferSelect;
export type ExpensePaymentMethod = (typeof expensePaymentMethod.enumValues)[number];
export type AiConversation = typeof aiConversation.$inferSelect;
export type AiMessage = typeof aiMessage.$inferSelect;
export type AiUsage = typeof aiUsage.$inferSelect;

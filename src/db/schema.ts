import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users_table", {
  public_key: text().primaryKey().notNull(),
  invested_amount: int().notNull(),
});

export const tokensTable = sqliteTable("tokens_table", {
  mint: text().primaryKey().notNull(),
  invested_amount: int().notNull(),
  bonded_time: int().notNull(),
});

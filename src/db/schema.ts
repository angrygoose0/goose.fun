import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations } from 'drizzle-orm';

export const usersTable = sqliteTable("users_table", {
  public_key: text().notNull(),
  mint: text().notNull(),
  locked_amount: text().notNull(),
});

export const tokensTable = sqliteTable("tokens_table", {
  mint: text().primaryKey().notNull(),
  locked_amount: text().notNull(),
  bonded_time: int().notNull(),
  creation_time: int().notNull(),
  pool_id: text().notNull(),
});


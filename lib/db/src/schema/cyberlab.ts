import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const usersTable = pgTable("cyberlab_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("student"),
  avatar: text("avatar"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  ...timestamps,
});

export const categoriesTable = pgTable("cyberlab_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  labCount: integer("lab_count").notNull().default(0),
  color: text("color").notNull().default("#64f28b"),
  ...timestamps,
});

export const labsTable = pgTable("cyberlab_labs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  categoryId: text("category_id").notNull(),
  difficulty: text("difficulty").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  instructions: text("instructions").notNull(),
  objectives: jsonb("objectives").$type<string[]>().notNull().default([]),
  hints: jsonb("hints").$type<string[]>().notNull().default([]),
  requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
  docker: jsonb("docker").$type<Record<string, unknown>>().notNull().default({}),
  flagHash: text("flag_hash"),
  status: text("status").notNull().default("Draft"),
  accent: text("accent").notNull().default("#64f28b"),
  ...timestamps,
});

export const commandsTable = pgTable("cyberlab_commands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tool: text("tool").notNull(),
  category: text("category").notNull(),
  operatingSystem: text("operating_system").notNull(),
  difficulty: text("difficulty").notNull(),
  command: text("command").notNull(),
  description: text("description").notNull(),
  options: jsonb("options").$type<Array<{ flag: string; description: string }>>().notNull().default([]),
  example: text("example").notNull(),
  relatedLabs: jsonb("related_labs").$type<string[]>().notNull().default([]),
  ...timestamps,
});

export const learningModulesTable = pgTable("cyberlab_learning_modules", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  level: text("level").notNull(),
  accent: text("accent").notNull().default("#64f28b"),
  published: boolean("published").notNull().default(true),
  ...timestamps,
});

export const lessonsTable = pgTable("cyberlab_lessons", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull(),
  title: text("title").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  position: integer("position").notNull(),
  ...timestamps,
});

export const labInstancesTable = pgTable("cyberlab_lab_instances", {
  id: text("id").primaryKey(),
  labId: text("lab_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  dockerConfigured: boolean("docker_configured").notNull().default(false),
  containerReference: text("container_reference"),
  ...timestamps,
});

export const flagsTable = pgTable("cyberlab_flags", {
  id: text("id").primaryKey(),
  labId: text("lab_id").notNull().unique(),
  valueHash: text("value_hash").notNull(),
  ...timestamps,
});

export const flagAttemptsTable = pgTable("cyberlab_flag_attempts", {
  id: text("id").primaryKey(),
  labId: text("lab_id").notNull(),
  userId: text("user_id").notNull(),
  submittedHash: text("submitted_hash").notNull(),
  correct: boolean("correct").notNull().default(false),
  ...timestamps,
});

export const progressTable = pgTable("cyberlab_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  labId: text("lab_id"),
  moduleId: text("module_id"),
  progress: integer("progress").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const achievementsTable = pgTable("cyberlab_achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  target: integer("target").notNull(),
  ...timestamps,
});

export const userAchievementsTable = pgTable("cyberlab_user_achievements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  achievementId: text("achievement_id").notNull(),
  progress: integer("progress").notNull().default(0),
  unlocked: boolean("unlocked").notNull().default(false),
  ...timestamps,
});

export const activityLogsTable = pgTable("cyberlab_activity_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  ...timestamps,
});

export const reportsTable = pgTable("cyberlab_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("Open"),
  description: text("description").notNull(),
  ...timestamps,
});

export const systemSettingsTable = pgTable("cyberlab_system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  ...timestamps,
});

export const insertUserSchema = createInsertSchema(usersTable);
export const insertCategorySchema = createInsertSchema(categoriesTable);
export const insertLabSchema = createInsertSchema(labsTable);
export const insertCommandSchema = createInsertSchema(commandsTable);
export const insertLearningModuleSchema = createInsertSchema(learningModulesTable);
export const insertLessonSchema = createInsertSchema(lessonsTable);
export const insertLabInstanceSchema = createInsertSchema(labInstancesTable);
export const insertFlagSchema = createInsertSchema(flagsTable);
export const insertFlagAttemptSchema = createInsertSchema(flagAttemptsTable);
export const insertProgressSchema = createInsertSchema(progressTable);
export const insertAchievementSchema = createInsertSchema(achievementsTable);
export const insertActivityLogSchema = createInsertSchema(activityLogsTable);
export const insertReportSchema = createInsertSchema(reportsTable);
export const insertSystemSettingSchema = createInsertSchema(systemSettingsTable);

export type User = typeof usersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Lab = typeof labsTable.$inferSelect;
export type Command = typeof commandsTable.$inferSelect;
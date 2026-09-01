import { createHash, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import {
  achievementsTable,
  activityLogsTable,
  categoriesTable,
  commandsTable,
  flagsTable,
  flagAttemptsTable,
  labInstancesTable,
  labsTable,
  learningModulesTable,
  lessonsTable,
  progressTable,
  usersTable,
  db,
} from "@workspace/db";
import {
  CreateLabBody,
  DeleteLabParams,
  GetCommandParams,
  GetCurrentUserResponse,
  GetLabParams,
  GetLearningModuleParams,
  ListCommandsQueryParams,
  ListLabsQueryParams,
  ListUsersQueryParams,
  SubmitFlagBody,
  SubmitFlagParams,
  UpdateLabBody,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth, type CyberLabRequest, ensureLocalUser } from "../middlewares/auth";
import { dockerLabService } from "../services/dockerLabService";

const router: IRouter = Router();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

async function categoryMap() {
  const rows = await db.select().from(categoriesTable);
  return new Map(rows.map((category) => [category.id, category]));
}

async function progressMap(userId: string) {
  const rows = await db.select().from(progressTable).where(eq(progressTable.userId, userId));
  return new Map(rows.filter((row) => row.labId).map((row) => [row.labId!, row]));
}

async function labResponse(lab: typeof labsTable.$inferSelect, userId = "demo-student") {
  const categories = await categoryMap();
  const progress = await progressMap(userId);
  const category = categories.get(lab.categoryId);
  const labProgress = progress.get(lab.id);
  return {
    id: lab.id,
    name: lab.name,
    slug: lab.slug,
    description: lab.description,
    category: {
      id: category?.id ?? lab.categoryId,
      name: category?.name ?? "Uncategorized",
      slug: category?.slug ?? "uncategorized",
      labCount: category?.labCount ?? 0,
      color: category?.color,
    },
    difficulty: lab.difficulty,
    estimatedMinutes: lab.estimatedMinutes,
    status: lab.status,
    progress: labProgress?.progress ?? 0,
    completed: Boolean(labProgress?.completedAt),
    objectiveCount: asArray<string>(lab.objectives).length,
    instanceStatus: null,
    accent: lab.accent,
  };
}

async function currentUser(req: CyberLabRequest) {
  return ensureLocalUser(req.userId ?? "demo-student");
}

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await currentUser(req);
    res.json(GetCurrentUserResponse.parse(user));
  } catch (error) {
    return next(error);
  }
});

router.get("/labs", async (req, res, next) => {
  try {
    const params = ListLabsQueryParams.parse(req.query);
    const filters = [eq(labsTable.status, "Published")];
    if (params.category) filters.push(eq(labsTable.categoryId, params.category));
    if (params.difficulty) filters.push(eq(labsTable.difficulty, params.difficulty));
    const labs = await db.select().from(labsTable).where(and(...filters)).orderBy(asc(labsTable.name));
    const search = params.search?.toLowerCase();
    const filtered = search
      ? labs.filter((lab) => `${lab.name} ${lab.description}`.toLowerCase().includes(search))
      : labs;
    res.json(await Promise.all(filtered.map((lab) => labResponse(lab))));
  } catch (error) {
    return next(error);
  }
});

router.get("/labs/:id", async (req, res, next) => {
  try {
    const { id } = GetLabParams.parse(req.params);
    const [lab] = await db.select().from(labsTable).where(eq(labsTable.id, id)).limit(1);
    if (!lab) return res.status(404).json({ error: "Lab not found" });
    const base = await labResponse(lab);
    return res.json({
      ...base,
      objectives: asArray<string>(lab.objectives),
      instructions: lab.instructions,
      hints: asArray<string>(lab.hints),
      requirements: asArray<string>(lab.requirements),
      docker: {
        image: (lab.docker as Record<string, unknown>)?.image ?? null,
        tag: (lab.docker as Record<string, unknown>)?.tag ?? null,
        targetPort: (lab.docker as Record<string, unknown>)?.targetPort ?? null,
        protocol: (lab.docker as Record<string, unknown>)?.protocol ?? "http",
        network: (lab.docker as Record<string, unknown>)?.network ?? null,
        timeoutMinutes: (lab.docker as Record<string, unknown>)?.timeoutMinutes ?? 60,
        configured: Boolean((lab.docker as Record<string, unknown>)?.configured),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/labs/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = GetLabParams.parse(req.params);
    const body = UpdateLabBody.parse(req.body);
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, body.categoryId)).limit(1);
    if (!category) return res.status(400).json({ error: "Category not found" });
    const [existing] = await db.select().from(labsTable).where(eq(labsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Lab not found" });
    const [lab] = await db.update(labsTable).set({
      name: body.name,
      slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      description: body.description,
      categoryId: body.categoryId,
      difficulty: body.difficulty,
      estimatedMinutes: body.estimatedMinutes,
      instructions: body.instructions,
      objectives: body.objectives ?? existing.objectives,
      hints: body.hints ?? existing.hints,
      docker: body.docker ?? existing.docker,
      accent: category.color,
      updatedAt: new Date(),
    }).where(eq(labsTable.id, id)).returning();
    return res.json(await labResponse(lab));
  } catch (error) {
    return next(error);
  }
});

router.delete("/labs/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = DeleteLabParams.parse(req.params);
    const [existing] = await db.select({ id: labsTable.id }).from(labsTable).where(eq(labsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Lab not found" });
    await db.delete(flagAttemptsTable).where(eq(flagAttemptsTable.labId, id));
    await db.delete(flagsTable).where(eq(flagsTable.labId, id));
    await db.delete(progressTable).where(eq(progressTable.labId, id));
    await db.delete(labInstancesTable).where(eq(labInstancesTable.labId, id));
    await db.delete(labsTable).where(eq(labsTable.id, id));
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

router.post("/labs/:id/start", requireAuth, async (req: CyberLabRequest, res, next) => {
  try {
    const { id } = GetLabParams.parse(req.params);
    const [lab] = await db.select().from(labsTable).where(eq(labsTable.id, id)).limit(1);
    if (!lab || lab.status !== "Published") return res.status(404).json({ error: "Published lab not found" });
    const result = await dockerLabService.createLabInstance(lab.docker as never);
    if (!result.ok) return res.status(409).json({ error: result.message });
    const instanceId = randomUUID();
    const [instance] = await db.insert(labInstancesTable).values({
      id: instanceId,
      labId: lab.id,
      userId: req.userId!,
      status: "running",
      dockerConfigured: true,
      containerReference: result.containerReference,
      durationMinutes: 0,
    }).returning();
    return res.status(201).json({
      id: instance.id,
      labId: lab.id,
      labName: lab.name,
      userId: instance.userId,
      status: instance.status,
      startedAt: instance.startedAt,
      durationMinutes: instance.durationMinutes,
      dockerConfigured: instance.dockerConfigured,
      containerReference: instance.containerReference,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/labs/:id/submit-flag", requireAuth, async (req: CyberLabRequest, res, next) => {
  try {
    const { id } = SubmitFlagParams.parse(req.params);
    const { value } = SubmitFlagBody.parse(req.body);
    const [lab] = await db.select().from(labsTable).where(eq(labsTable.id, id)).limit(1);
    if (!lab) return res.status(404).json({ error: "Lab not found" });
    const [instance] = await db.select().from(labInstancesTable)
      .where(and(eq(labInstancesTable.labId, id), eq(labInstancesTable.userId, req.userId!), eq(labInstancesTable.status, "running")))
      .limit(1);
    if (!instance) return res.status(400).json({ error: "Start an active lab instance before submitting a flag." });
    const [flag] = await db.select().from(flagsTable).where(eq(flagsTable.labId, id)).limit(1);
    const isCorrect = Boolean(flag && flag.valueHash === hash(value.trim()));
    await db.insert(flagAttemptsTable).values({
      id: randomUUID(),
      labId: id,
      userId: req.userId!,
      submittedHash: hash(value.trim()),
      correct: isCorrect,
    });
    const [attempts] = await db.select({ total: count() }).from(flagAttemptsTable)
      .where(and(eq(flagAttemptsTable.labId, id), eq(flagAttemptsTable.userId, req.userId!)));
    if (isCorrect) {
      const completedAt = new Date();
      const [existingProgress] = await db.select({ id: progressTable.id }).from(progressTable)
        .where(and(eq(progressTable.userId, req.userId!), eq(progressTable.labId, id))).limit(1);
      if (existingProgress) {
        await db.update(progressTable).set({ progress: 100, completedAt }).where(eq(progressTable.id, existingProgress.id));
      } else {
        await db.insert(progressTable).values({ id: randomUUID(), userId: req.userId!, labId: id, progress: 100, completedAt });
      }
      await db.update(labInstancesTable).set({ status: "completed", stoppedAt: completedAt }).where(eq(labInstancesTable.id, instance.id));
      await db.insert(activityLogsTable).values({
        id: randomUUID(),
        userId: req.userId!,
        type: "lab",
        title: `Completed ${lab.name}`,
        description: "Flag validated and lab progress updated.",
      });
    }
    return res.json({
      correct: isCorrect,
      message: isCorrect ? "Flag accepted. Lab completed." : "That flag is not correct yet.",
      attemptCount: Number(attempts?.total ?? 0),
      completedAt: isCorrect ? new Date() : null,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/commands", async (req, res, next) => {
  try {
    const params = ListCommandsQueryParams.parse(req.query);
    const filters = [];
    if (params.category) filters.push(eq(commandsTable.category, params.category));
    if (params.difficulty) filters.push(eq(commandsTable.difficulty, params.difficulty));
    const rows = await db.select().from(commandsTable).where(filters.length ? and(...filters) : undefined).orderBy(asc(commandsTable.name));
    const search = params.search?.toLowerCase();
    res.json(rows.filter((row) => !search || `${row.name} ${row.tool} ${row.description}`.toLowerCase().includes(search)));
  } catch (error) {
    return next(error);
  }
});

router.get("/commands/:id", async (req, res, next) => {
  try {
    const { id } = GetCommandParams.parse(req.params);
    const [command] = await db.select().from(commandsTable).where(eq(commandsTable.id, id)).limit(1);
    if (!command) return res.status(404).json({ error: "Command not found" });
    return res.json(command);
  } catch (error) {
    return next(error);
  }
});

router.get("/learning", async (_req, res, next) => {
  try {
    const modules = await db.select().from(learningModulesTable).where(eq(learningModulesTable.published, true)).orderBy(asc(learningModulesTable.title));
    const rows = await Promise.all(modules.map(async (module) => {
      const moduleLessons = await db.select().from(lessonsTable).where(eq(lessonsTable.moduleId, module.id));
      return { id: module.id, title: module.title, description: module.description, category: module.category, lessonCount: moduleLessons.length, completedLessons: 0, progress: 0, level: module.level, accent: module.accent };
    }));
    res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/learning/:id", async (req, res, next) => {
  try {
    const { id } = GetLearningModuleParams.parse(req.params);
    const [module] = await db.select().from(learningModulesTable).where(eq(learningModulesTable.id, id)).limit(1);
    if (!module) return res.status(404).json({ error: "Learning module not found" });
    const moduleLessons = await db.select().from(lessonsTable).where(eq(lessonsTable.moduleId, id)).orderBy(asc(lessonsTable.position));
    return res.json({ id: module.id, title: module.title, description: module.description, category: module.category, lessonCount: moduleLessons.length, completedLessons: 0, progress: 0, level: module.level, accent: module.accent, lessons: moduleLessons.map((lesson) => ({ id: lesson.id, title: lesson.title, durationMinutes: lesson.durationMinutes, completed: false, position: lesson.position })) });
  } catch (error) {
    return next(error);
  }
});

router.get("/achievements", async (_req, res, next) => {
  try {
    const rows = await db.select().from(achievementsTable).orderBy(asc(achievementsTable.name));
    res.json(rows.map((row) => ({ id: row.id, name: row.name, description: row.description, icon: row.icon, unlocked: false, progress: 0, target: row.target })));
  } catch (error) {
    return next(error);
  }
});

router.get("/dashboard", requireAuth, async (req: CyberLabRequest, res, next) => {
  try {
    const user = await currentUser(req);
    const [labs, modules, activities, completed] = await Promise.all([
      db.select().from(labsTable).where(eq(labsTable.status, "Published")).orderBy(asc(labsTable.name)),
      db.select().from(learningModulesTable).where(eq(learningModulesTable.published, true)).orderBy(asc(learningModulesTable.title)).limit(1),
      db.select().from(activityLogsTable).where(eq(activityLogsTable.userId, req.userId!)).orderBy(desc(activityLogsTable.createdAt)).limit(5),
      db.select({ total: count() }).from(progressTable).where(and(eq(progressTable.userId, req.userId!), eq(progressTable.progress, 100))),
    ]);
    const module = modules[0];
    const recommendedLabs = await Promise.all(labs.slice(0, 3).map((lab) => labResponse(lab, req.userId)));
    res.json({
      user,
      stats: { labsCompleted: Number(completed[0]?.total ?? 0), labsAvailable: labs.length, currentStreak: 3, commandsLearned: 5, overallProgress: labs.length ? Math.round((Number(completed[0]?.total ?? 0) / labs.length) * 100) : 0 },
      continueLearning: module ? { id: module.id, title: module.title, description: module.description, category: module.category, lessonCount: 2, completedLessons: 0, progress: 0, level: module.level, accent: module.accent } : { id: "none", title: "No modules yet", description: "Learning content will appear here.", category: "Foundations", lessonCount: 0, completedLessons: 0, progress: 0, level: "Foundations", accent: "#64f28b" },
      recommendedLabs,
      recentActivity: activities.map((activity) => ({ id: activity.id, type: activity.type, title: activity.title, description: activity.description, timestamp: activity.createdAt })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/progress", requireAuth, async (req: CyberLabRequest, res, next) => {
  try {
    const [labs, userProgress] = await Promise.all([
      db.select().from(labsTable).where(eq(labsTable.status, "Published")),
      db.select().from(progressTable).where(eq(progressTable.userId, req.userId!)),
    ]);
    const completedCount = userProgress.filter((row) => row.progress === 100).length;
    res.json({ overallProgress: labs.length ? Math.round((completedCount / labs.length) * 100) : 0, labsStarted: userProgress.length, labsCompleted: completedCount, commandsLearned: 5, currentStreak: 3, categoryProgress: [{ category: "Reconnaissance", progress: 0, completed: 0, total: labs.filter((lab) => lab.categoryId === "cat-recon").length }, { category: "Web Security", progress: 0, completed: 0, total: labs.filter((lab) => lab.categoryId === "cat-web").length }, { category: "Linux", progress: 0, completed: 0, total: labs.filter((lab) => lab.categoryId === "cat-linux").length }] });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/overview", requireAdmin, async (_req, res, next) => {
  try {
    const [users, labs, published, running, completed, attempts, activities] = await Promise.all([
      db.select({ total: count() }).from(usersTable),
      db.select({ total: count() }).from(labsTable),
      db.select({ total: count() }).from(labsTable).where(eq(labsTable.status, "Published")),
      db.select({ total: count() }).from(labInstancesTable).where(eq(labInstancesTable.status, "running")),
      db.select({ total: count() }).from(progressTable).where(eq(progressTable.progress, 100)),
      db.select({ total: count() }).from(flagAttemptsTable),
      db.select().from(activityLogsTable).orderBy(desc(activityLogsTable.createdAt)).limit(5),
    ]);
    res.json({ totalUsers: Number(users[0]?.total ?? 0), activeUsers: Number(users[0]?.total ?? 0), totalLabs: Number(labs[0]?.total ?? 0), publishedLabs: Number(published[0]?.total ?? 0), runningInstances: Number(running[0]?.total ?? 0), labsCompleted: Number(completed[0]?.total ?? 0), flagSubmissions: Number(attempts[0]?.total ?? 0), dockerConnected: Boolean(process.env.DOCKER_HOST), recentActivity: activities.map((activity) => ({ id: activity.id, title: activity.title, detail: activity.description, timestamp: activity.createdAt })) });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/users", requireAdmin, async (req, res, next) => {
  try {
    const params = ListUsersQueryParams.parse(req.query);
    const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
    const search = params.search?.toLowerCase();
    res.json(rows.filter((row) => !search || `${row.name} ${row.email}`.toLowerCase().includes(search)));
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/lab-instances", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await db.select({ instance: labInstancesTable, lab: labsTable }).from(labInstancesTable).leftJoin(labsTable, eq(labInstancesTable.labId, labsTable.id)).orderBy(desc(labInstancesTable.startedAt));
    res.json(rows.map(({ instance, lab }) => ({ id: instance.id, labId: instance.labId, labName: lab?.name ?? "Unknown lab", userId: instance.userId, status: instance.status, startedAt: instance.startedAt, durationMinutes: instance.durationMinutes, dockerConfigured: instance.dockerConfigured, containerReference: instance.containerReference })));
  } catch (error) {
    return next(error);
  }
});

router.post("/labs", requireAdmin, async (req, res, next) => {
  try {
    const body = CreateLabBody.parse(req.body);
    const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, body.categoryId)).limit(1);
    if (!category) return res.status(400).json({ error: "Category not found" });
    const id = randomUUID();
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const [lab] = await db.insert(labsTable).values({ id, name: body.name, slug, description: body.description, categoryId: body.categoryId, difficulty: body.difficulty, estimatedMinutes: body.estimatedMinutes, instructions: body.instructions, objectives: body.objectives ?? [], hints: body.hints ?? [], requirements: [], docker: body.docker ?? { image: null, tag: null, targetPort: null, protocol: "http", timeoutMinutes: 60, configured: false }, status: "Draft", accent: category.color }).returning();
    return res.status(201).json(await labResponse(lab));
  } catch (error) {
    return next(error);
  }
});

export default router;
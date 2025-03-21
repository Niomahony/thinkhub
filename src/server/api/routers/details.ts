import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { milestones, tasks } from "~/server/db/schema";
import { eq } from "drizzle-orm";

interface Task {
  id: number;
  title: string;
  description: string | null;
  createdBy: string;
  order: number;
  milestoneId: number;
  projectId: number;
}

interface Milestone {
  id: number;
  title: string;
  description: string | null;
  dueDate: Date;
  projectId: number;
  tasks: Task[];
}

export const detailsRouter = createTRPCRouter({
  getMilestones: publicProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input, ctx }) => {
      const milestonesWithTasks = await ctx.db
        .select({
          milestone: milestones,
          task: tasks,
        })
        .from(milestones)
        .leftJoin(tasks, eq(tasks.milestoneId, milestones.id))
        .where(eq(milestones.projectId, input.projectId))
        .execute();

      const milestoneMap = new Map<number, Milestone>();

      milestonesWithTasks.forEach(({ milestone, task }) => {
        if (!milestoneMap.has(milestone.id)) {
          milestoneMap.set(milestone.id, { ...milestone, tasks: [] });
        }
        if (task) {
          milestoneMap.get(milestone.id)!.tasks.push(task as Task);
        }
      });

      return Array.from(milestoneMap.values());
    }),

  createMilestone: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        title: z.string(),
        description: z.string(),
        dueDate: z.date(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.insert(milestones).values({
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
      });
    }),

  createTask: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        milestoneId: z.number(),
        title: z.string().optional(),
        createdBy: z.string(),
        order: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.db
        .insert(tasks)
        .values({
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          title: input.title ?? "",
          createdBy: input.createdBy,
          order: input.order,
        })
        .$returningId();

      return result[0];
    }),

  getTasks: publicProcedure
    .input(z.object({ milestoneId: z.number() }))
    .query(async ({ input, ctx }) => {
      return ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.milestoneId, input.milestoneId));
    }),

  updateTask: protectedProcedure
    .input(
      z.object({
        taskId: z.number(),
        milestoneId: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.db
        .update(tasks)
        .set({ milestoneId: input.milestoneId })
        .where(eq(tasks.id, input.taskId));
    }),

  reorderTasks: protectedProcedure
    .input(
      z.object({
        milestoneId: z.number(),
        tasks: z.array(z.number()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { milestoneId, tasks: taskIds } = input;
      const updateTasks = taskIds.map((taskId, index) =>
        ctx.db.update(tasks).set({ order: index }).where(eq(tasks.id, taskId)),
      );
      await ctx.db.transaction(async () => {
        for (const updateTask of updateTasks) {
          await updateTask.execute();
        }
      });
      return ctx.db
        .select()
        .from(tasks)
        .where(eq(tasks.milestoneId, milestoneId));
    }),
});

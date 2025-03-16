import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { projects, projectMembers, documents, users } from "~/server/db/schema";
import { and, eq, like } from "drizzle-orm";

export const projectRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const createdProjectId = await ctx.db
        .insert(projects)
        .values({
          name: input.name,
          description: input.description ?? "",
          createdBy: ctx.session.user.id,
        })
        .$returningId();

      console.log(
        " Created Project ID in Mutation (Server Log):",
        createdProjectId,
      );
      return createdProjectId;
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const createdProjects = await ctx.db
      .select()
      .from(projects)
      .where(eq(projects.createdBy, userId));

    const memberProjects = await ctx.db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdBy: projects.createdBy,
        createdAt: projects.createdAt,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));

    const uniqueProjectsMap = new Map<number, typeof projects.$inferSelect>();

    [...createdProjects, ...memberProjects].forEach((project) => {
      uniqueProjectsMap.set(project.id, project);
    });

    return Array.from(uniqueProjectsMap.values());
  }),

  searchUsersByEmail: protectedProcedure
    .input(z.object({ email: z.string().min(3) }))
    .query(async ({ ctx, input }) => {
      const matchingUsers = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(like(users.email, `%${input.email}%`))
        .limit(5);

      return matchingUsers;
    }),

  getUserIdByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!user[0]) {
        throw new Error("User not found.");
      }

      return user[0];
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        email: z.string().email(),
        role: z.enum(["Manager", "Researcher", "Viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: eq(users.email, input.email),
      });

      if (!user) {
        throw new Error("User not found.");
      }

      const existingMember = await ctx.db.query.projectMembers.findFirst({
        where: and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, user.id),
        ),
      });

      if (existingMember) {
        throw new Error("User is already a member of this project.");
      }

      await ctx.db.insert(projectMembers).values({
        projectId: input.projectId,
        userId: user.id,
        role: input.role,
      });

      return { success: true };
    }),

  deleteMember: protectedProcedure
    .input(
      z.object({
        projectId: z.number(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, input.projectId),
            eq(projectMembers.userId, input.userId),
          ),
        );
    }),

  getProjectDetails: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.query.projects.findFirst({
        where: (fields) => eq(fields.id, input.projectId),
      });

      if (!project) {
        return null;
      }

      const members = await ctx.db
        .select({
          userId: projectMembers.userId,
          email: users.email,
          role: projectMembers.role,
          joinedAt: projectMembers.joinedAt,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, input.projectId));

      const creator = await ctx.db.query.users.findFirst({
        where: (fields) => eq(fields.id, project.createdBy),
      });

      return { ...project, members, creatorEmail: creator?.email };
    }),

  assignDocument: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        fileUrl: z.string(),
        projectId: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(documents).values({
        title: input.title,
        fileUrl: input.fileUrl,
        projectId: input.projectId,
        uploadedBy: ctx.session.user.id,
      });
    }),

  getDocuments: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(documents)
        .where(eq(documents.projectId, input.projectId));
    }),

  getProjectMembers: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: projectMembers.id,
          userId: projectMembers.userId,
          projectId: projectMembers.projectId,
          role: projectMembers.role,
          joinedAt: projectMembers.joinedAt,
          name: users.name,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, input.projectId));
    }),
});

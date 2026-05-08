import { NOT_ADMIN_ERR_MSG, PRIVILEGED_REPORT_VIEWERS, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const privilegedReportViewerSet = new Set(
  PRIVILEGED_REPORT_VIEWERS.map((viewer) => viewer.trim().toLowerCase())
);

function normalizeAdminIdentifier(value?: string | null): string {
  return value?.trim().toLowerCase() || '';
}

function isPrivilegedAdminUser(user: NonNullable<TrpcContext["user"]>): boolean {
  if (user.role === 'admin') return true;
  const email = normalizeAdminIdentifier(user.email);
  const emailName = email.split('@')[0] || '';
  return [
    user.openId,
    user.name,
    email,
    emailName,
  ]
    .map(normalizeAdminIdentifier)
    .some((value) => value && privilegedReportViewerSet.has(value));
}

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !isPrivilegedAdminUser(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

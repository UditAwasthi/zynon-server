import { builder } from "./builder";

export const UserType = builder.objectRef<{
  id: string;
  username: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;

  avatarUrl: string | null;
  onboardingCompleted: boolean;
}>("User");

UserType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),

    username: t.exposeString("username"),

    email: t.exposeString("email"),

    role: t.exposeString("role"),

    avatarUrl: t.exposeString(
      "avatarUrl",
      {
        nullable: true,
      }
    ),

    onboardingCompleted:
      t.exposeBoolean(
        "onboardingCompleted"
      ),

    emailVerifiedAt: t.expose(
      "emailVerifiedAt",
      {
        type: "DateTime",
        nullable: true,
      }
    ),
  }),
});

builder.queryField("me", (t) =>
  t.field({
    type: UserType,
    nullable: true,

    resolve: async (
      _,
      __,
      ctx
    ) => {
      if (!ctx.userId) {
        return null;
      }

      return ctx.prisma.user.findUnique({
        where: {
          id: ctx.userId,
        },
      });
    },
  })
);
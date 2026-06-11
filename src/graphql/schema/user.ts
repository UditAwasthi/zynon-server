import { builder } from "./builder";

export const UserType = builder.objectRef<{
  id: string;
  username: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
}>("User");

UserType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),

    username: t.exposeString("username"),

    email: t.exposeString("email"),

    role: t.exposeString("role"),

    emailVerifiedAt: t.expose("emailVerifiedAt", {
      type: "DateTime",
      nullable: true,
    }),
  }),
});

builder.queryField("me", (t) =>
  t.field({
    type: UserType,
    nullable: true,

    resolve: async (_, __, ctx) => {
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
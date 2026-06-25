import { Prisma } from "@prisma/client";
import { builder } from "./builder";
import { ProfileType } from "./profile";

export const UserType = builder.objectRef<{
  id: string;
  username: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  bio: string | null;
  avatarUrl: string | null;
  avatarKey: string | null;
  onboardingCompleted: boolean;
}>("User");

UserType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),

    username: t.exposeString("username"),

    email: t.exposeString("email"),

    role: t.exposeString("role"),

    bio: t.exposeString("bio", {
      nullable: true,
    }),

    avatarUrl: t.exposeString("avatarUrl", {
      nullable: true,
    }),

    avatarKey: t.exposeString("avatarKey", {
      nullable: true,
    }),

    onboardingCompleted: t.exposeBoolean(
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

// ---------- Me Type ----------

type MePayload = Prisma.UserGetPayload<{
  include: {
    profile: true;
  };
}>;

export const MeType = builder.objectRef<{
  user: MePayload;
  profile: NonNullable<MePayload["profile"]>;
}>("Me");

MeType.implement({
  fields: (t) => ({
    user: t.field({
      type: UserType,
      resolve: (parent) => parent.user,
    }),

    profile: t.field({
      type: ProfileType,
      resolve: (parent) => parent.profile,
    }),
  }),
});

// ---------- Me Query ----------

builder.queryField("me", (t) =>
  t.field({
    type: MeType,

    nullable: true,

    resolve: async (
      _,
      __,
      ctx
    ) => {
      if (!ctx.userId) {
        return null;
      }

      const user =
        await ctx.prisma.user.findUnique({
          where: {
            id: ctx.userId,
          },

          include: {
            profile: true,
          },
        });

      if (!user || !user.profile) {
        return null;
      }

      return {
        user,
        profile: user.profile,
      };
    },
  })
);
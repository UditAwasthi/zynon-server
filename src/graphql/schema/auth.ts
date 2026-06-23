import { builder } from "./builder";
import { UserType } from "./user";
import { authService } from "../../modules/auth/auth.service";

export const AuthPayloadType =
  builder.objectRef<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
      emailVerifiedAt: Date | null;

      avatarUrl: string | null;
      onboardingCompleted: boolean;
    };
  }>("AuthPayload");

AuthPayloadType.implement({
  fields: (t) => ({
    accessToken: t.exposeString(
      "accessToken"
    ),

    refreshToken: t.exposeString(
      "refreshToken"
    ),

    user: t.field({
      type: UserType,
      resolve: (parent) =>
        parent.user,
    }),
  }),
});

builder.mutationField(
  "register",
  (t) =>
    t.field({
      type: AuthPayloadType,

      args: {
        email: t.arg.string({
          required: true,
        }),

        username: t.arg.string({
          required: true,
        }),

        password: t.arg.string({
          required: true,
        }),

        fullName: t.arg.string({
          required: true,
        }),

        dateOfBirth: t.arg({
          type: "DateTime",
          required: true,
        }),
      },

      resolve: async (
        _,
        args
      ) => {
        return authService.register(
          args.email,
          args.username,
          args.password,
          args.fullName,
          args.dateOfBirth
        );
      },
    })
);
builder.mutationField(
  "login",
  (t) =>
    t.field({
      type: AuthPayloadType,

      args: {
        email: t.arg.string({
          required: true,
        }),

        password: t.arg.string({
          required: true,
        }),
      },

      resolve: async (
        _,
        args
      ) => {
        return authService.login(
          args.email,
          args.password
        );
      },
    })
);
builder.mutationField(
  "refreshToken",
  (t) =>
    t.field({
      type: AuthPayloadType,

      args: {
        refreshToken:
          t.arg.string({
            required: true,
          }),
      },

      resolve: (_, args) =>
        authService.refreshToken(
          args.refreshToken
        ),
    })
);
builder.mutationField(
  "logout",
  (t) =>
    t.boolean({
      args: {
        refreshToken:
          t.arg.string({
            required: true,
          }),
      },

      resolve: (_, args) =>
        authService.logout(
          args.refreshToken
        ),
    })
);

builder.mutationField(
  "logoutAllDevices",
  (t) =>
    t.boolean({
      resolve: async (
        _,
        __,
        ctx
      ) => {
        if (!ctx.userId) {
          throw new Error(
            "Unauthorized"
          );
        }

        return authService.logoutAllDevices(
          ctx.userId
        );
      },
    })
);
builder.mutationField(
  "sendVerificationEmail",
  (t) =>
    t.boolean({
      args: {
        email: t.arg.string({
          required: false,
        }),
      },
      resolve: async (
        _,
        args,
        ctx
      ) => {
        if (!ctx.userId && !args.email) {
          throw new Error(
            "Unauthorized"
          );
        }

        return authService.sendVerificationEmail(
          ctx.userId,
          args.email
        );
      },
    })
);
builder.mutationField(
  "verifyEmail",
  (t) =>
    t.boolean({
      args: {
        otp: t.arg.string({
          required: true,
        }),
      },

      resolve: async (
        _,
        args,
        ctx
      ) => {
        if (!ctx.userId) {
          throw new Error(
            "Unauthorized"
          );
        }

        return authService.verifyEmail(
          ctx.userId,
          args.otp
        );
      },
    })
);
builder.mutationField(
  "forgotPassword",
  (t) =>
    t.boolean({
      args: {
        email: t.arg.string({
          required: true,
        }),
      },

      resolve: (
        _,
        args
      ) =>
        authService.forgotPassword(
          args.email
        ),
    })
);
builder.mutationField(
  "resetPassword",
  (t) =>
    t.boolean({
      args: {
        email: t.arg.string({
          required: true,
        }),

        otp: t.arg.string({
          required: true,
        }),

        password: t.arg.string({
          required: true,
        }),
      },

      resolve: (
        _,
        args
      ) =>
        authService.resetPassword(
          args.email,
          args.otp,
          args.password
        ),
    })
);

builder.mutationField(
  "googleLogin",
  (t) =>
    t.field({
      type: AuthPayloadType,

      args: {
        token:
          t.arg.string({
            required: true,
          }),
      },

      resolve: (
        _,
        args
      ) =>
        authService.googleLogin(
          args.token
        ),
    })
);
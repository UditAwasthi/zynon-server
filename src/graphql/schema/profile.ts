import { builder } from "./builder";
import {
    Pronouns,
    AccountType,
    Niche,
} from "@prisma/client";
import { userService }
    from "../../modules/user/user.service";
import { UserType } from "./user";

import { Prisma } from "@prisma/client";



export const PronounsEnum =
    builder.enumType(
        Pronouns,
        {
            name: "Pronouns",
        }
    );

export const AccountTypeEnum =
    builder.enumType(
        AccountType,
        {
            name: "AccountType",
        }
    );

export const NicheEnum =
    builder.enumType(
        Niche,
        {
            name: "Niche",
        }
    );

const CreateAvatarUploadUrlType =
    builder.objectRef<{
        uploadToken: string;
        path: string;
        fileUrl: string;
    }>(
        "CreateAvatarUploadUrlResponse"
    );



CreateAvatarUploadUrlType.implement({
    fields: (t) => ({
        uploadToken:
            t.exposeString(
                "uploadToken"
            ),

        path: t.exposeString(
            "path"
        ),

        fileUrl:
            t.exposeString(
                "fileUrl"
            ),
    }),
});
export const ProfileType = builder.objectRef<{
    id: string;
    userId: string;
    fullName: string | null;
    dateOfBirth: Date | null;
    pronouns: string | null;
    location: string | null;
    accountType: string;
    niche: string | null;
    profileMusicUrl: string | null;
    showInGlobalSearch: boolean;
    postCount: number;
    followerCount: number;
    followingCount: number;
    createdAt: Date;
    updatedAt: Date;
}>("Profile");


ProfileType.implement({
    fields: (t) => ({
        id: t.exposeID("id"),
        userId: t.exposeID("userId"),
        fullName: t.exposeString(
            "fullName",
            {
                nullable: true,
            }
        ),
        dateOfBirth: t.expose(
            "dateOfBirth",
            {
                type: "DateTime",
                nullable: true,
            }
        ),
        pronouns: t.exposeString(
            "pronouns",
            {
                nullable: true,
            }
        ),

        location: t.exposeString(
            "location",
            {
                nullable: true,
            }
        ),

        accountType:
            t.exposeString(
                "accountType"
            ),

        niche: t.exposeString(
            "niche",
            {
                nullable: true,
            }
        ),

        profileMusicUrl:
            t.exposeString(
                "profileMusicUrl",
                {
                    nullable: true,
                }
            ),

        showInGlobalSearch:
            t.exposeBoolean(
                "showInGlobalSearch"
            ),

        postCount:
            t.exposeInt(
                "postCount"
            ),

        followerCount:
            t.exposeInt(
                "followerCount"
            ),

        followingCount:
            t.exposeInt(
                "followingCount"
            ),

        createdAt: t.expose(
            "createdAt",
            {
                type: "DateTime",
            }
        ),

        updatedAt: t.expose(
            "updatedAt",
            {
                type: "DateTime",
            }
        ),
    }),
});


builder.mutationField(
    "createAvatarUploadUrl",
    (t) =>
        t.field({
            type:
                CreateAvatarUploadUrlType,

            args: {
                contentType:
                    t.arg.string({
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

                return userService.createAvatarUploadUrl(
                    ctx.userId,
                    args.contentType
                );
            },
        })
);
builder.queryField(
    "myProfile",
    (t) =>
        t.field({
            type: ProfileType,

            nullable: true,

            resolve: async (
                _,
                __,
                ctx
            ) => {
                if (!ctx.userId) {
                    return null;
                }

                return ctx.prisma.profile.findUnique({
                    where: {
                        userId:
                            ctx.userId,
                    },
                });
            },
        })
);
// Complete onboarding mutation
builder.mutationField(
    "completeOnboarding",
    (t) =>
        t.field({
            type: ProfileType,

            args: {
                fullName: t.arg.string(),

                location: t.arg.string(),

                dateOfBirth: t.arg({
                    type: "DateTime",
                }),

                pronouns: t.arg({
                    type: PronounsEnum,
                }),

                accountType: t.arg({
                    type: AccountTypeEnum,
                }),

                niche: t.arg({
                    type: NicheEnum,
                }),

                showInGlobalSearch:
                    t.arg.boolean(),
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

                return userService.completeOnboarding(
                    ctx.userId,
                    {
                        fullName:
                            args.fullName ??
                            undefined,

                        location:
                            args.location ??
                            undefined,

                        dateOfBirth:
                            args.dateOfBirth ??
                            undefined,

                        pronouns:
                            args.pronouns ??
                            undefined,

                        accountType:
                            args.accountType ??
                            undefined,

                        niche:
                            args.niche ??
                            undefined,

                        showInGlobalSearch:
                            args.showInGlobalSearch ??
                            undefined,
                    }
                );
            },
        })
);

// Update avatar mutation
builder.mutationField(
    "updateAvatar",
    (t) =>
        t.field({
            type: UserType,

            args: {
                avatarUrl: t.arg.string({
                    required: true,
                }),

                avatarKey: t.arg.string({
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

                return userService.updateAvatar(
                    ctx.userId,
                    args.avatarUrl,
                    args.avatarKey
                );
            },
        })
);

// Update profile mutation
builder.mutationField(
    "updateProfile",
    (t) =>
        t.field({
            type: ProfileType,

            args: {
                fullName: t.arg.string(),

                bio: t.arg.string(),

                location: t.arg.string(),

                dateOfBirth: t.arg({
                    type: "DateTime",
                }),

                pronouns: t.arg({
                    type: PronounsEnum,
                }),

                accountType: t.arg({
                    type: AccountTypeEnum,
                }),

                niche: t.arg({
                    type: NicheEnum,
                }),

                profileMusicUrl: t.arg.string(),

                showInGlobalSearch:
                    t.arg.boolean(),
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

                return userService.updateProfile(
                    ctx.userId,
                    {
                        fullName:
                            args.fullName ??
                            undefined,

                        bio:
                            args.bio ??
                            undefined,

                        location:
                            args.location ??
                            undefined,

                        dateOfBirth:
                            args.dateOfBirth ??
                            undefined,

                        pronouns:
                            args.pronouns ??
                            undefined,

                        accountType:
                            args.accountType ??
                            undefined,

                        niche:
                            args.niche ??
                            undefined,

                        profileMusicUrl:
                            args.profileMusicUrl ??
                            undefined,

                        showInGlobalSearch:
                            args.showInGlobalSearch ??
                            undefined,
                    }
                );
            },
        })
);


//profile query


// Public user type

export const PublicUserType = builder.objectRef<{
  id: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
}>("PublicUser");

PublicUserType.implement({
  fields: (t) => ({
    id: t.exposeID("id"),

    username: t.exposeString("username"),

    bio: t.exposeString("bio", {
      nullable: true,
    }),

    avatarUrl: t.exposeString("avatarUrl", {
      nullable: true,
    }),
  }),
});

// Public profile payload

type PublicProfilePayload = Prisma.UserGetPayload<{
  include: {
    profile: true;
  };
}>;

export const PublicProfileType = builder.objectRef<{
  user: PublicProfilePayload;
  profile: NonNullable<PublicProfilePayload["profile"]>;
}>("PublicProfile");

PublicProfileType.implement({
  fields: (t) => ({
    user: t.field({
      type: PublicUserType,
      resolve: (parent) => parent.user,
    }),

    profile: t.field({
      type: ProfileType,
      resolve: (parent) => parent.profile,
    }),
  }),
});

// Public profile query

builder.queryField(
  "profile",
  (t) =>
    t.field({
      type: PublicProfileType,

      nullable: true,

      args: {
        username: t.arg.string({
          required: true,
        }),
      },

      resolve: async (_, args) => {
        return userService.getProfile(
          args.username
        );
      },
    })
);
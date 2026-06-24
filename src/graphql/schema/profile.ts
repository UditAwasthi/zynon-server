import { builder } from "./builder";
import {
    Pronouns,
    AccountType,
    Niche,
} from "@prisma/client";
import { userService }
    from "../../modules/user/user.service";

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
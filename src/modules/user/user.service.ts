import crypto from "crypto";
import { supabase } from "../../lib/supabase";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import type {
    CreateAvatarUploadUrlResponse,
} from "./user.types";

export class UserService {
    async createAvatarUploadUrl(
        userId: string,
        contentType: string
    ): Promise<CreateAvatarUploadUrlResponse> {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];

        if (
            !allowedTypes.includes(
                contentType
            )
        ) {
            throw new Error(
                "Unsupported file type"
            );
        }

        const extension =
            contentType.split("/")[1];

        const path =
            `avatars/${userId}/${crypto.randomUUID()}.${extension}`;

        const { data, error } =
            await supabase.storage
                .from(
                    env.SUPABASE_BUCKET
                )
                .createSignedUploadUrl(
                    path
                );

        if (error || !data) {
            throw new Error(
                error?.message ??
                "Failed to create upload URL"
            );
        }

        const {
            data: publicUrlData,
        } = supabase.storage
            .from(
                env.SUPABASE_BUCKET
            )
            .getPublicUrl(path);

        return {
            uploadToken:
                data.token,

            path,

            fileUrl:
                publicUrlData.publicUrl,
        };
    }

    //Onboarding yahan karunga
    async completeOnboarding(
        userId: string,
        input: {
            fullName?: string;
            location?: string;
            dateOfBirth?: Date;

            pronouns?:
            | "HE_HIM"
            | "SHE_HER"
            | "THEY_THEM"
            | "OTHER";

            accountType?:
            | "PERSONAL"
            | "CREATOR"
            | "BUSINESS";

            niche?:
            | "TECHNOLOGY"
            | "GAMING"
            | "FITNESS"
            | "ART"
            | "MUSIC"
            | "EDUCATION"
            | "BUSINESS"
            | "OTHER";

            showInGlobalSearch?: boolean;
        }
    ) {
        return prisma.$transaction(
            async (tx) => {
                const profile =
                    await tx.profile.update({
                        where: {
                            userId,
                        },

                        data: {
                            fullName:
                                input.fullName,

                            location:
                                input.location,

                            dateOfBirth:
                                input.dateOfBirth,

                            pronouns:
                                input.pronouns,

                            accountType:
                                input.accountType,

                            niche:
                                input.niche,

                            showInGlobalSearch:
                                input.showInGlobalSearch,
                        },
                    });

                await tx.user.update({
                    where: {
                        id: userId,
                    },

                    data: {
                        onboardingCompleted:
                            true,
                    },
                });

                return profile;
            }
        );
    }

    //PROFILE PICTURE UPDATE YAHAN KARUNGA
    async updateAvatar(
        userId: string,
        avatarUrl: string,
        avatarKey: string
    ) {
        return prisma.user.update({
            where: {
                id: userId,
            },

            data: {
                avatarUrl,
                avatarKey,
            },
        });
    }
    //Profile update yahan karunga
    async updateProfile(
        userId: string,
        input: {
            fullName?: string;
            bio?: string;
            location?: string;
            dateOfBirth?: Date;
            pronouns?: "HE_HIM" | "SHE_HER" | "THEY_THEM" | "OTHER";
            accountType?: "PERSONAL" | "CREATOR" | "BUSINESS";
            niche?:
            | "TECHNOLOGY"
            | "GAMING"
            | "FITNESS"
            | "ART"
            | "MUSIC"
            | "EDUCATION"
            | "BUSINESS"
            | "OTHER";
            profileMusicUrl?: string;
            showInGlobalSearch?: boolean;
        }
    ) {
        return prisma.$transaction(async (tx) => {
            if (input.bio !== undefined) {
                await tx.user.update({
                    where: { id: userId },
                    data: {
                        bio: input.bio,
                    },
                });
            }

            return tx.profile.update({
                where: {
                    userId,
                },

                data: {
                    ...(input.fullName !== undefined && {
                        fullName: input.fullName,
                    }),

                    ...(input.location !== undefined && {
                        location: input.location,
                    }),

                    ...(input.dateOfBirth !== undefined && {
                        dateOfBirth: input.dateOfBirth,
                    }),

                    ...(input.pronouns !== undefined && {
                        pronouns: input.pronouns,
                    }),

                    ...(input.accountType !== undefined && {
                        accountType: input.accountType,
                    }),

                    ...(input.niche !== undefined && {
                        niche: input.niche,
                    }),

                    ...(input.profileMusicUrl !== undefined && {
                        profileMusicUrl: input.profileMusicUrl,
                    }),

                    ...(input.showInGlobalSearch !== undefined && {
                        showInGlobalSearch:
                            input.showInGlobalSearch,
                    }),
                },
            });
        });
    }
    //Profile expose yahan karunga
    async getProfile(username: string) {
        const usernameLower = username.toLowerCase();

        const user = await prisma.user.findUnique({
            where: {
                usernameLower,
            },
            include: {
                profile: true,
            },
        });

        if (!user || !user.profile) {
            throw new Error("Profile not found");
        }

        return {
            user,
            profile: user.profile,
        };
    }
}


export const userService =
    new UserService();


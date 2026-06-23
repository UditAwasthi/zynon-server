import crypto from "crypto";
import { supabase } from "../../lib/supabase";
import { env } from "../../config/env";

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
}


export const userService =
    new UserService();


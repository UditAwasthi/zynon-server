-- DropIndex
DROP INDEX "password_reset_tokens_token_key";

-- AlterTable
ALTER TABLE "verification_tokens" ALTER COLUMN "token" SET DATA TYPE TEXT;

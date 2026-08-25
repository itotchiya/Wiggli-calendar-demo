-- DropIndex
DROP INDEX "RsvpTokenLog_token_key";

-- CreateIndex
CREATE INDEX "RsvpTokenLog_token_idx" ON "RsvpTokenLog"("token");

-- CreateIndex
CREATE INDEX "UserConv_apiId_idx" ON "UserConv"("apiId");

-- RenameIndex
ALTER INDEX "idx_UserConv" RENAME TO "UserConv_userId_idx";

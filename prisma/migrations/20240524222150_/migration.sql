-- AlterTable
ALTER TABLE "ChatHistory" ADD COLUMN     "filePath" TEXT;

-- AlterTable
ALTER TABLE "UserConv" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "UserConv_userId_apiId_idx" ON "UserConv"("userId", "apiId");

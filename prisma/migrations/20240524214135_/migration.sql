-- AlterTable
ALTER TABLE "UserConv" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "ChatHistory" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "apiId" TEXT NOT NULL,
    "sender" VARCHAR(10) NOT NULL,
    "msg" TEXT NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatHistory_createAt_idx" ON "ChatHistory"("createAt");

-- CreateIndex
CREATE INDEX "ChatHistory_userId_apiId_idx" ON "ChatHistory"("userId", "apiId");

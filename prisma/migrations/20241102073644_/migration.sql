/*
  Warnings:

  - A unique constraint covering the columns `[userId,apiId]` on the table `UserConv` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserConv_userId_apiId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "UserConv_userId_apiId_key" ON "UserConv"("userId", "apiId");

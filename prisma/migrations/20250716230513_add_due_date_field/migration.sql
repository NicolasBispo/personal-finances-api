/*
  Warnings:

  - You are about to drop the `Planner` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Planner" DROP CONSTRAINT "Planner_userId_fkey";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "dueDate" TIMESTAMP(3);

-- DropTable
DROP TABLE "Planner";

-- CreateIndex
CREATE INDEX "Transaction_userId_dueDate_idx" ON "Transaction"("userId", "dueDate");

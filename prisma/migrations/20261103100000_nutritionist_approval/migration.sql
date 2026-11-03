ALTER TABLE "User"
ADD COLUMN "requiresAdminApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "NutritionistApprovalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionistApprovalRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NutritionistApprovalRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NutritionistApprovalRequest_userId_key"
ON "NutritionistApprovalRequest"("userId");

CREATE INDEX "NutritionistApprovalRequest_status_createdAt_idx"
ON "NutritionistApprovalRequest"("status", "createdAt");

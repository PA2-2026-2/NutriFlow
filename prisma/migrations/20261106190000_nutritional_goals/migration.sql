CREATE TABLE "NutritionalGoal" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nutritionistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "customCategory" TEXT,
    "initialValue" DOUBLE PRECISION NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionalGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NutritionalGoalProgress" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,

    CONSTRAINT "NutritionalGoalProgress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NutritionalGoal_patientId_status_endDate_idx"
    ON "NutritionalGoal"("patientId", "status", "endDate");
CREATE INDEX "NutritionalGoal_nutritionistId_patientId_status_idx"
    ON "NutritionalGoal"("nutritionistId", "patientId", "status");
CREATE INDEX "NutritionalGoal_category_idx"
    ON "NutritionalGoal"("category");
CREATE INDEX "NutritionalGoalProgress_goalId_recordedAt_idx"
    ON "NutritionalGoalProgress"("goalId", "recordedAt");
CREATE INDEX "NutritionalGoalProgress_recordedById_recordedAt_idx"
    ON "NutritionalGoalProgress"("recordedById", "recordedAt");

ALTER TABLE "NutritionalGoal"
    ADD CONSTRAINT "NutritionalGoal_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionalGoal"
    ADD CONSTRAINT "NutritionalGoal_nutritionistId_fkey"
    FOREIGN KEY ("nutritionistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionalGoalProgress"
    ADD CONSTRAINT "NutritionalGoalProgress_goalId_fkey"
    FOREIGN KEY ("goalId") REFERENCES "NutritionalGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NutritionalGoalProgress"
    ADD CONSTRAINT "NutritionalGoalProgress_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

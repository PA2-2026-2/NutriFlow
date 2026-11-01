-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "nutritionistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "goalDescription" TEXT NOT NULL,
    "goalTarget" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGENDADO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Challenge_startDate_before_endDate_check" CHECK ("startDate" < "endDate")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'INSCRITO',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeCheckIn" (
    "id" TEXT NOT NULL,
    "participationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "checkInDate" DATE NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "recordedValue" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Challenge_nutritionistId_createdAt_idx"
ON "Challenge"("nutritionistId", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_startDate_endDate_idx"
ON "Challenge"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_challengeId_patientId_key"
ON "ChallengeParticipant"("challengeId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_id_patientId_key"
ON "ChallengeParticipant"("id", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeCheckIn_participationId_checkInDate_key"
ON "ChallengeCheckIn"("participationId", "checkInDate");

-- CreateIndex
CREATE INDEX "ChallengeCheckIn_patientId_checkInDate_idx"
ON "ChallengeCheckIn"("patientId", "checkInDate");

-- AddForeignKey
ALTER TABLE "Challenge"
ADD CONSTRAINT "Challenge_nutritionistId_fkey"
FOREIGN KEY ("nutritionistId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant"
ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey"
FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant"
ADD CONSTRAINT "ChallengeParticipant_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeCheckIn"
ADD CONSTRAINT "ChallengeCheckIn_participationId_patientId_fkey"
FOREIGN KEY ("participationId", "patientId") REFERENCES "ChallengeParticipant"("id", "patientId")
ON DELETE RESTRICT ON UPDATE CASCADE;

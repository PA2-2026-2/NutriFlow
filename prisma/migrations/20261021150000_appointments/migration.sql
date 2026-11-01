CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "AppointmentStatus" AS ENUM (
  'AGENDADA',
  'CONFIRMADA',
  'CANCELADA',
  'CONCLUIDA'
);

CREATE TABLE "Appointment" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "nutritionistId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'AGENDADA',
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Appointment_valid_interval_check" CHECK ("endAt" > "startAt"),
  CONSTRAINT "Appointment_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Appointment_nutritionistId_fkey"
    FOREIGN KEY ("nutritionistId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Appointment_patientId_startAt_idx"
  ON "Appointment"("patientId", "startAt");
CREATE INDEX "Appointment_nutritionistId_startAt_idx"
  ON "Appointment"("nutritionistId", "startAt");

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_nutritionist_schedule_excl"
  EXCLUDE USING gist (
    "nutritionistId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELADA');

ALTER TABLE "Appointment"
  ADD CONSTRAINT "Appointment_patient_schedule_excl"
  EXCLUDE USING gist (
    "patientId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELADA');

ALTER TABLE "User"
ADD COLUMN "authUserId" TEXT;

CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

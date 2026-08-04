-- AlterTable
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sentByUserId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_sentByUserId_idx" ON "messages"("sentByUserId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sentByUserId_fkey'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "messages_sentByUserId_fkey"
      FOREIGN KEY ("sentByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

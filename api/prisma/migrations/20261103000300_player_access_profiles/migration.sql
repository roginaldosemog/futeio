ALTER TABLE "access_sessions" ADD COLUMN "player_credential_id" UUID;
CREATE INDEX "access_sessions_player_credential_id_idx" ON "access_sessions"("player_credential_id");
ALTER TABLE "access_sessions" ADD CONSTRAINT "access_sessions_player_credential_id_fkey"
  FOREIGN KEY ("player_credential_id") REFERENCES "player_access_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "players" ADD COLUMN "photo_bytes" BYTEA;
ALTER TABLE "players" ADD CONSTRAINT "players_photo_size_check"
  CHECK ("photo_bytes" IS NULL OR octet_length("photo_bytes") <= 2097152);

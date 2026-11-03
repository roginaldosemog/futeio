CREATE TABLE "players" (
  "id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "identity_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "players_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "players_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 100),
  CONSTRAINT "players_group_id_identity_id_fkey" FOREIGN KEY ("group_id", "identity_id") REFERENCES "memberships"("group_id", "identity_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "players_group_id_identity_id_key" ON "players"("group_id", "identity_id");
CREATE UNIQUE INDEX "players_group_id_id_key" ON "players"("group_id", "id");

CREATE TABLE "evaluations" (
  "group_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "evaluator_identity_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evaluations_pkey" PRIMARY KEY ("group_id", "player_id", "evaluator_identity_id"),
  CONSTRAINT "evaluations_rating_check" CHECK ("rating" BETWEEN 0 AND 10),
  CONSTRAINT "evaluations_group_id_player_id_fkey" FOREIGN KEY ("group_id", "player_id") REFERENCES "players"("group_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "evaluations_group_id_evaluator_identity_id_fkey" FOREIGN KEY ("group_id", "evaluator_identity_id") REFERENCES "memberships"("group_id", "identity_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "evaluations_group_id_evaluator_identity_id_idx" ON "evaluations"("group_id", "evaluator_identity_id");

CREATE TABLE "player_access_credentials" (
  "id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "player_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_access_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_access_credentials_group_id_player_id_fkey" FOREIGN KEY ("group_id", "player_id") REFERENCES "players"("group_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "player_access_credentials_token_hash_key" ON "player_access_credentials"("token_hash");
CREATE INDEX "player_access_credentials_group_id_player_id_idx" ON "player_access_credentials"("group_id", "player_id");
CREATE UNIQUE INDEX "player_access_credentials_one_active_key" ON "player_access_credentials"("group_id", "player_id") WHERE "revoked_at" IS NULL;

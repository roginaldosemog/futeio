CREATE TABLE "draws" (
  "id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "seed" VARCHAR(64) NOT NULL,
  "algorithm_version" VARCHAR(64) NOT NULL,
  "calculation_version" VARCHAR(64) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "draws_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "draws_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "draws_group_id_created_at_idx" ON "draws"("group_id", "created_at");

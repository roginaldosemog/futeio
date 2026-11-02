CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "groups_slug_key" ON "groups"("slug");

-- Apenas o grupo piloto, sem contas, credenciais ou participantes fictícios.
INSERT INTO "groups" ("id", "slug", "name")
VALUES ('00000000-0000-4000-8000-000000000001', 'pelada-piloto', 'Pelada piloto');

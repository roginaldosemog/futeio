CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'PLAYER');
CREATE TYPE "SessionRole" AS ENUM ('ANONYMOUS', 'ADMIN', 'PLAYER');

CREATE TABLE "identities" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "identities_email_key" ON "identities"("email");

CREATE TABLE "memberships" (
  "group_id" UUID NOT NULL,
  "identity_id" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL,
  CONSTRAINT "memberships_pkey" PRIMARY KEY ("group_id", "identity_id"),
  CONSTRAINT "memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "memberships_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "access_sessions" (
  "id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "role" "SessionRole" NOT NULL,
  "group_id" UUID,
  "identity_id" UUID,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "access_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "access_sessions_context_check" CHECK (
    ("role" = 'ANONYMOUS' AND "group_id" IS NULL AND "identity_id" IS NULL)
    OR ("role" <> 'ANONYMOUS' AND "group_id" IS NOT NULL AND "identity_id" IS NOT NULL)
  ),
  CONSTRAINT "access_sessions_group_id_identity_id_fkey" FOREIGN KEY ("group_id", "identity_id") REFERENCES "memberships"("group_id", "identity_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "access_sessions_token_hash_key" ON "access_sessions"("token_hash");
CREATE INDEX "access_sessions_expires_at_idx" ON "access_sessions"("expires_at");

CREATE TABLE "admin_login_links" (
  "id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "group_id" UUID NOT NULL,
  "identity_id" UUID NOT NULL,
  "request_session_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_login_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_login_links_group_id_identity_id_fkey" FOREIGN KEY ("group_id", "identity_id") REFERENCES "memberships"("group_id", "identity_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admin_login_links_request_session_id_fkey" FOREIGN KEY ("request_session_id") REFERENCES "access_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_login_links_token_hash_key" ON "admin_login_links"("token_hash");
CREATE INDEX "admin_login_links_expires_at_idx" ON "admin_login_links"("expires_at");

CREATE TABLE "auth_rate_limits" (
  "id" CHAR(64) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_rate_limits_count_check" CHECK ("count" > 0)
);
CREATE INDEX "auth_rate_limits_expires_at_idx" ON "auth_rate_limits"("expires_at");

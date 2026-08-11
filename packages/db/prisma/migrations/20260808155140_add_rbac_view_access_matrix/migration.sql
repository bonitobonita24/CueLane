-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM ('dashboard', 'services', 'windows', 'users', 'media', 'settings', 'theme', 'usage', 'roles');

-- CreateEnum
CREATE TYPE "RolePreset" AS ENUM ('supervisor', 'operator', 'contributor', 'viewer');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "custom_role_id" TEXT;

-- CreateTable
CREATE TABLE "features" (
    "feature_key" "FeatureKey" NOT NULL,
    "surface" TEXT NOT NULL,

    CONSTRAINT "features_pkey" PRIMARY KEY ("feature_key")
);

-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preset" "RolePreset" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "custom_role_id" TEXT NOT NULL,
    "feature_key" "FeatureKey" NOT NULL,
    "view" BOOLEAN NOT NULL DEFAULT false,
    "write" BOOLEAN NOT NULL DEFAULT false,
    "update" BOOLEAN NOT NULL DEFAULT false,
    "delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_roles_tenant_id_idx" ON "custom_roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_tenant_id_name_key" ON "custom_roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_custom_role_id_feature_key_key" ON "role_permissions"("custom_role_id", "feature_key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_custom_role_id_fkey" FOREIGN KEY ("custom_role_id") REFERENCES "custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "features"("feature_key") ON DELETE RESTRICT ON UPDATE CASCADE;

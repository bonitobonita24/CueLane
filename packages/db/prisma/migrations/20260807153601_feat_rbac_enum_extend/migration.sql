ALTER TYPE "UserRole" RENAME VALUE 'admin' TO 'tenant_admin';
ALTER TYPE "UserRole" ADD VALUE 'tenant_superadmin';
ALTER TYPE "UserRole" ADD VALUE 'tenant_manager';

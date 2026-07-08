# CueLane — Kubernetes Scaffold (INACTIVE)

> **Status: INACTIVE placeholder — K8s is disabled by default (Rule 6).**
> Enable only when `deploy.k8s.enabled: true` is set in inputs.yml.

This directory is a placeholder for Kubernetes manifests. CueLane currently deploys
via Docker Compose + Komodo (see `deploy/compose/` and `.github/workflows/docker-publish.yml`).

## When to enable K8s

Set `deploy.k8s.enabled: true` in `inputs.yml` and trigger a Phase 7 Feature Update
to scaffold the full K8s manifests (Deployments, Services, Ingress, ConfigMaps, Secrets,
HPA, PodDisruptionBudgets).

## What would be scaffolded

- `deploy/k8s-scaffold/base/` — Kustomize base (web, worker, db, cache, storage)
- `deploy/k8s-scaffold/overlays/staging/` — staging env patches + image tags
- `deploy/k8s-scaffold/overlays/prod/` — production env patches + image tags
- Horizontal Pod Autoscaler for web (min 2, max 10 replicas)
- PodDisruptionBudget (minAvailable: 1) for zero-downtime rolling updates
- Ingress with TLS (cert-manager) → equivalent of the Traefik labels in Compose
- Sealed Secrets or External Secrets Operator for credential injection

## References

- `inputs.yml` → `deploy.k8s.enabled`
- Framework Rule 6: K8s inactive by default
- `CLAUDE.md` → Phase Menu → Phase 7 Feature Update

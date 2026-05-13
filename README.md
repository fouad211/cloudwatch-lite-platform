# CloudWatch Lite Platform

Cloud infrastructure monitoring and cost optimization platform built with Node.js, Docker, Kubernetes, GitOps, and monitoring stack integrations.

## Features

- Dockerized Node.js application
- GitHub Actions CI/CD pipeline
- Trivy security scanning
- GitOps deployment workflow
- Kubernetes deployment with Helm
- ArgoCD automated sync
- Prometheus monitoring
- Grafana dashboards
- HPA autoscaling
- ConfigMaps and Secrets
- Ingress routing

---

# Architecture

```text
Developer Push
↓
GitHub Actions
↓
Docker Build
↓
Image Test
↓
Trivy Scan
↓
Push to GHCR
↓
Update GitOps Repo
↓
ArgoCD Sync
↓
Kubernetes Deployment
↓
Prometheus Monitoring
↓
Grafana Dashboards
```

---

# Technologies Used

- Node.js
- Docker
- GitHub Actions
- GitHub Container Registry
- Kubernetes
- Helm
- ArgoCD
- Prometheus
- Grafana
- Trivy

---

# Kubernetes Resources

- Deployment
- Service
- Ingress
- ConfigMap
- Secret
- Horizontal Pod Autoscaler

---

# CI/CD Pipeline

The GitHub Actions workflow automatically:

1. Builds Docker image
2. Saves image as `.tar`
3. Tests container
4. Scans image with Trivy
5. Pushes image to GHCR
6. Updates GitOps Helm values
7. Triggers ArgoCD sync

---

# Monitoring Stack

Prometheus scrapes metrics from the application.

Grafana provides dashboards for:

- CPU usage
- Memory usage
- Service availability
- Kubernetes resources

---

# Future Improvements

- Loki centralized logging
- Terraform infrastructure provisioning
- AWS EKS deployment
- SonarQube code analysis
- Istio service mesh

# 🚀 CloudWatch Lite Platform

A full-stack cloud infrastructure monitoring and cost optimization platform built using modern DevOps technologies.

---

## 📌 Overview

CloudWatch Lite is a Dockerized monitoring system that simulates cloud infrastructure management.  
It allows users to track server performance, generate alerts, and estimate infrastructure costs in real time.

---

## ✨ Features

- 🔐 JWT Authentication (Register / Login / Reset Password)
- 🖥️ Server Management (Add / View Servers)
- 📊 Real-time Monitoring (CPU, Memory, Disk, Network)
- 🚨 Alert System (Critical / High / Medium / Low)
- 💰 Cost Estimation (Daily & Monthly)
- 📈 Live Dashboard (Auto refresh every 5 seconds)
- ⚡ Redis Caching
- 🐳 Fully Dockerized Architecture
- 🌐 Nginx Reverse Proxy

---

## 🧱 Tech Stack

- **Backend:** Node.js (Express)
- **Database:** MongoDB
- **Cache:** Redis
- **Containerization:** Docker & Docker Compose
- **Web Server:** Nginx
- **Frontend:** HTML, CSS, JavaScript

---

## 🏗️ Architecture

```text
User → Nginx → Node.js API → MongoDB
                     ↓
                   Redis

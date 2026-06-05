# Cloud Deployment Guide

This document describes how to deploy the **Comparative Analysis of Real-Time Animal Detection Models Using Deep Learning Smart Wildlife Monitoring System** in the cloud.

---

## Method 1: Local Containerization (Docker)

To run the application inside a local container:

1. Make sure you have **Docker** and **Docker Compose** installed.
2. Build and start the container:
   ```bash
   docker-compose up --build -d
   ```
3. Access the application at `http://localhost:5000`.

---

## Method 2: Deploying to Render.com (Recommended for Student Demos)

Render is a free-tier hosting platform that supports Python Flask out of the box.

1. **GitHub Repository**: Push your code to a public/private GitHub repository.
2. **Create a Web Service**:
   - Go to Render Dashboard -> **New +** -> **Web Service**.
   - Connect your GitHub repository.
3. **Environment Configurations**:
   - **Environment**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py` (or `gunicorn app:app` for production).
4. **Important**: Since YOLO model files (`yolov8n.pt`) are automatically downloaded by Ultralytics on first run, the initial start command might take a minute as it fetches the weights from the internet. Render has a disk limit, but the lightweight Nano model fits easily.

---

## Method 3: Deploying to AWS EC2 (Enterprise Production)

To deploy on a virtual server in Amazon Web Services:

1. **Launch EC2 Instance**:
   - Select an **Ubuntu Server** AMI (minimum instance size: `t3.medium` to handle YOLO inference latency).
   - In Security Groups, allow inbound traffic on **Port 80** (HTTP) and **Port 5000** (Flask backend).
2. **Install Docker and Docker Compose** on the EC2 instance:
   ```bash
   sudo apt update
   sudo apt install -y docker.io docker-compose
   ```
3. **Clone and Start**:
   - Clone your project code onto the EC2 host.
   - Run the Docker Compose stack:
     ```bash
     sudo docker-compose up --build -d
     ```
4. Access via your EC2 public IP or domain name at `http://your-ec2-ip:5000`.

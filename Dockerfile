# Use standard lightweight python base image
FROM python:3.11-slim

# Set environment variable to run python in unbuffered mode
ENV PYTHONUNBUFFERED=1

# Set active working directory
WORKDIR /app

# Install OS libraries required for image operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy python dependencies file and install packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source files
COPY . .

# Expose local Flask listening port
EXPOSE 5000

# Execute server boot command
CMD ["python", "app.py"]

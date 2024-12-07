# Use the official Node.js image as the base image
FROM node:latest

# Install supervisor
RUN apt-get update && apt-get install -y supervisor

# Create a directory for supervisor logs
RUN mkdir -p /var/log/supervisor

# Set the working directory inside the container
WORKDIR /usr/src/

# Copy the application code and supervisor config into the container
COPY . .
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install dependencies for each app
RUN cd ./app1 && npm install
RUN cd ./app2 && npm install

# Expose port 8000 to be accessible from the host
EXPOSE 8000 8001

# Run supervisord as the container's entry point
CMD ["/usr/bin/supervisord"]
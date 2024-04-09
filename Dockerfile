# syntax=docker/dockerfile:1.7-labs
# Use an official Node.js image as the base
FROM node:20

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./
COPY *.sh ./
COPY .stub.env ./.env

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY --exclude=.env --exclude=.deno.env --exclude=var.env . .

RUN npm run compile

# Expose the port your application runs on
EXPOSE 4000

# Start your application
CMD ["npm", "run", "start"]

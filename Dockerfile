# syntax=docker/dockerfile:1.7-labs
FROM python:3.9 as build

WORKDIR /usr/src/app
COPY requirements.txt .
RUN python -m venv /opt/app/venv
ENV PATH="/usr/src/app/venv/bin:$PATH"
RUN pip install -r requirements.txt

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
COPY ./src ./src
COPY ./tsconfig.json .

RUN npm run node:compile

# Expose the port your application runs on
EXPOSE 4000

# Start your application
CMD ["npm", "run", "node:run"]

# Plate Patrol AWS Central Server

## Overview

Plate Patrol is a crowdsourced Automatic License Plate Recognition (ALPR) system designed to enhance public safety by leveraging everyday dash cams. The Central Server is a critical backend component that processes incoming license plate detections, matches them against law enforcement watchlists, and alerts officers in real time.

This repository contains the backend implementation for the Plate Patrol Central Server, including its API endpoints, database schemas, and cloud deployment details.

### Central Server Block Diagram 
![Capstone Block Diagram - New Central Server](https://github.com/user-attachments/assets/91c02207-999e-41b4-81b7-e66fc978ca04)

### Authors

- Christine Li
- Vicky Liu
- Andy Zhao

### Affiliation

Electrical and Computer Engineering, Carnegie Mellon University

## Features

- **Real-Time ALPR Matching**: Processes incoming license plate detections from dash cams and checks against the law enforcement watchlist.
- **Secure Watchlist Management**: Officers can add/remove plates to track specific vehicles.
- **Automated Notification**s: Sends real-time alerts to officers when a tracked plate is detected.
- **Scalability**: Uses AWS services (Lambda, DynamoDB, RDS, S3, SNS, SQS) for high-throughput, low-latency processing.
- **Web App Integration**: Provides RESTful APIs for the Plate Patrol web app.

## Technology Stack

- **Cloud Infrastructure**: AWS services (Lambda, DynamoDB, RDS, S3, SNS, SQS)
- **Programming Language**: TypeScript, JavaScript
- **Infrastructure as Code**: AWS CDK (Cloud Development Kit)
- **Testing**: Jest for unit testing
- **CI/CD**: GitHub Actions for automated testing & deployment

## Getting Started

### Prerequisites

- AWS Account
- Node.js and npm installed
- AWS CLI configured

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/BingchengLi/plate-patrol-aws-central-server.git
   cd plate-patrol-aws-central-server
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Deploy the application using AWS CDK:
   ```
   cdk deploy
   ```

### Deployment Stages

The project utilizes different environments in the AWS CDK stack for deployment:

- **Development (`dev`)**: The default environment for local development and testing. This environment is used for ongoing feature development and initial testing.
- **Staging (`staging`)**: This environment is used for integration testing and validation. It simulates the production environment to ensure all features work correctly before going live.
- **Production (`prod`)**: The final environment where the application is deployed for end-users. Only thoroughly tested and approved changes should be deployed here.

Note: When you run `cdk deploy`, the default environment is set to development (`dev`). You can specify a different environment by passing in the context:

```
cdk deploy --context stage=staging
```

### Testing
#### Jest Tests (Automated)
This project includes unit tests using Jest. To run the tests, use:
```
npm test
```

Jest test files are located in the `tests/jest/` directory. For example, `detections.test.ts` runs tests for the `/detections` API endpoint.

#### Manual Testing
For manual testing, shell scripts are available in the `tests/manual/` directory.

## Usage

Once deployed, the central server will:

1. **Receive license plate detections** from dash cams.
2. **Process and check the plates** against the law enforcement watchlist.
3. **Trigger notifications** via AWS SNS if a match is found.
4. **Store historical detections** in Amazon RDS for future reference.
5. **Provide API endpoints** for the Plate Patrol web app, where officers can manage watchlists and retrieve match history.

# Endpoint Monitor

## Overview

Endpoint Monitor is a Node.js application that monitors the health of specified endpoints. It checks the status of each endpoint and attempts to restart any failed endpoints using PM2. The application also provides a retry mechanism for restarting endpoints.

## Features

- Monitor the health of specified endpoints
- Restart failed endpoints using PM2
- Retry mechanism for restarting endpoints
- Update status dashboard

## Installation

1. Clone the repository:
    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. Install dependencies:
    ```sh
    npm install
    ```

## Configuration

Create a configuration file (e.g., `config.json`) with the following structure:

```json
{
    "endpoints": [
        {
            "name": "service1",
            "url": "http://localhost:3000/health",
            "method": "GET",
            "timeout": 5000,
            "expectedStatus": 200,
            "headers": {},
            "body": null
        },
        {
            "name": "service2",
            "url": "http://localhost:4000/health",
            "method": "GET",
            "timeout": 5000,
            "expectedStatus": 200,
            "headers": {},
            "body": null
        }
    ]
}
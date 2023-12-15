# MongoDB to SQL translator Node.js App

Welcome to My  MongoDB to SQL translator App This is a command-line application built with Node.js.

## Getting Started

To run this app on your local machine, please follow these steps:

### Prerequisites

- Node.js (version 20.3.1 or higher)

### Installation
1. Clone the repository to your local machine
2. Navigate to the project directory
3. Install the dependencies: `npm install`

### Running the App

To run the app, use the following command:

`npm start`

This will start the CLI Node.js app and display the available options.

## Usage

Once the app starts running with the `npm start` command, the console will request to type a MongoDB query to translate it to SQL. if you want to close CLI just type 'exit'

Input: MongoDB query as a string.
Output: SQL query as a string.

Additional Notes
- Ensure the MongoDB query string begins with 'db.' to match the expected format.
- Supported MongoDB methods: find().

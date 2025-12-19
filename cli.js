#!/usr/bin/env node

const { MongoClient } = require('mongodb');
const inquirer = require('inquirer');
const open = require('open');
const { spawn } = require('child_process');
const path = require('path');

const DEFAULT_CONNECTION = 'mongodb://localhost:27017';

async function main() {
    console.log('\n🔍 MongoDB ERD Generator\n');

    // Step 1: Get connection string
    const { connectionString } = await inquirer.prompt([
        {
            type: 'input',
            name: 'connectionString',
            message: 'Enter MongoDB connection string:',
            default: DEFAULT_CONNECTION,
            validate: (input) => {
                if (!input || input.trim() === '') {
                    return 'Connection string cannot be empty';
                }
                return true;
            }
        }
    ]);

    // Step 2: Connect and list databases
    console.log('\n📡 Connecting to MongoDB...');
    const client = new MongoClient(connectionString);

    let selectedDb;

    try {
        await client.connect();
        console.log('✅ Connected successfully\n');

        const adminDb = client.db().admin();
        const { databases } = await adminDb.listDatabases();

        // Filter out system databases and create choices
        const dbChoices = databases
            .filter(db => !['admin', 'local', 'config'].includes(db.name))
            .map(db => ({
                name: `${db.name} (${formatBytes(db.sizeOnDisk)})`,
                value: db.name
            }));

        if (dbChoices.length === 0) {
            console.log('❌ No databases found. Please check your connection string.');
            process.exit(1);
        }

        // Step 3: Select database
        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedDb',
                message: 'Select a database to generate ERD:',
                choices: dbChoices,
                pageSize: 10
            }
        ]);
        selectedDb = answer.selectedDb;

        console.log(`\n✅ Selected database: ${selectedDb}`);

    } catch (error) {
        console.error('\n❌ Error connecting to MongoDB:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }

    // Step 4: Generate ERD immediately
    console.log('\n📊 Generating ERD... This may take a moment.\n');
    let mermaidCode;
    try {
        const { generateMermaidERD } = require('./generate-erd');
        mermaidCode = await generateMermaidERD({ url: connectionString, dbName: selectedDb });
    } catch (err) {
        console.error('\n❌ Error generating ERD:', err.message);
        process.exit(1);
    }

    // Step 5: Start server (silent)
    const express = require('express');
    const app = express();
    const port = await findAvailablePort(3333);

    app.use(express.static(path.join(__dirname, 'public')));
    app.get('/erd', (req, res) => res.send(mermaidCode));

    const server = app.listen(port, () => {
        const url = `http://localhost:${port}`;
        console.log(`\n🌐 Opening browser at ${url}`);
        console.log('💡 Press Ctrl+C to stop the server\n');

        // Open browser
        open(url).catch(err => {
            console.log(`⚠️  Could not open browser automatically. Please navigate to ${url}`);
        });
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down...');
        server.close();
        process.exit(0);
    });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort) {
    const net = require('net');

    return new Promise((resolve) => {
        const server = net.createServer();

        server.listen(startPort, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });

        server.on('error', () => {
            // Port is busy, try next one
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the CLI
main().catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
});

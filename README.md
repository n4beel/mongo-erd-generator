# 🍃 Mongo ERD Generator

> **Instantly visualize your MongoDB schema relations with zero configuration.**

[![npm version](https://img.shields.io/npm/v/mongo-erd-generator.svg)](https://www.npmjs.com/package/mongo-erd-generator)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**Mongo ERD Generator** is a CLI tool that reverse-engineers your MongoDB database to create beautiful, interactive Entity Relationship Diagrams (ERDs). It uses advanced schema analysis to deduce relationships between collections without requiring any manual schema definition.

## ✨ Features

- 🔮 **Automatic Relationship Detection**: Intelligent analysis of `ObjectId` references to infer relations.
- 🖼️ **Interactive Visualization**: Powered by [Mermaid.js](https://mermaid.js.org/) and ELK layout engine for clean diagrams.
- 🚀 **Zero Config**: Just connect and go. No schema files needed.
- 🔍 **Deep Inspection**: Detects field types, embedded documents, and junction tables.
- 🌐 **Web-Based Viewer**: Zooms, pans, and exports to PNG directly from your browser.
- 🖥️ **Cross-Platform**: Works seamlessly on macOS, Windows, and Linux.

## 📦 Installation

Install globally via npm:

```bash
npm install -g mongo-erd-generator
```

## 🚀 Usage

Simply run the command in your terminal:

```bash
mongo-erd
```

### Interactive Mode (Recommended)
1. Enter your MongoDB connection string (default: `mongodb://localhost:27017`)
2. Select the database you want to visualize from the list.
3. The tool will generate the ERD and open it in your default browser.

### Non-Interactive Options
You can also pass arguments directly for CI/CD or quick access:

```bash
mongo-erd --url "mongodb://localhost:27017" --db "my_database" --port 8080
```

## 🛠️ How it Works

1. **Connects** to your MongoDB instance using the provided credentials.
2. **Samples** documents from each collection to infer schema structure and types.
3. **Indexes** all `ObjectId` fields to cross-reference collections.
4. **Deduces** relationships (1:1, 1:Many, Many:Many) based on reference matching.
5. **Generates** a Mermaid.js diagram and serves it locally.

## 🤝 Contributing

We love contributions! This is a passion project aimed at making MongoDB visualization accessible to everyone.

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started.

## 📝 License

This project is licensed under the [ISC License](LICENSE). 

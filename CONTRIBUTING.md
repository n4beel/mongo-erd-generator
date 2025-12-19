# Contributing to Mongo ERD Generator

First off, thanks for taking the time to contribute! 🎉

This is a passion project, and we want to make it as easy as possible for you to join in. Whether you're fixing a bug, improving the documentation, or adding a cool new feature, your help is welcome.

## 💻 Developing Locally

To get started with the code, follow these steps:

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mongo-erd-generator.git
   cd mongo-erd-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Link for local testing**
   This allows you to run the `mongo-erd` command globally while pointing to your local code.
   ```bash
   npm link
   ```

4. **Run the tool**
   ```bash
   mongo-erd
   ```

5. **Make your changes**
   Edit the files in your favorite editor. `server.js` contains the server logic, `cli.js` handles the CLI interaction, and `generate-erd.js` contains the core analysis engine.

## 🧪 Testing

We currently rely on manual verification.
- Run the tool against a local MongoDB instance with known data.
- Verify that relationships are detected correctly.
- Check that the UI renders properly in the browser.

##  pull Request Process

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure the test suite passes (if available).
4. Update the documentation with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
5. Issue that pull request!

## 🐛 Reporting Bugs

Found a bug? Go ahead and submit an issue on the GitHub repository. Include as much detail as possible:
- OS & Version
- Node.js Version
- MongoDB Version
- Steps to reproduce

## 💡 Feature Requests

Have an idea? We'd love to hear it. Submit an issue with the label `enhancement`.

## 📜 Code of Conduct

Be respectful and kind to one another. We are all here to learn and build something cool together.

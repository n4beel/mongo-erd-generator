const express = require('express');
const { generateMermaidERD } = require('./generate-erd');
const path = require('path');

// --- CONFIGURATION ---
// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (flag) => {
    const index = args.indexOf(flag);
    return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

// Priority: CLI args > Environment variables > Hardcoded defaults
const url = getArg('--url') ||
    process.env.MONGO_URL ||
    'mongodb://localhost:27017';

const dbName = getArg('--db') ||
    process.env.MONGO_DB ||
    'test';

const PORT = parseInt(getArg('--port') || process.env.PORT || '3333');
// ---------------------

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/erd', async (req, res) => {
    try {
        const mermaidCode = await generateMermaidERD({ url, dbName });
        res.send(mermaidCode);
    } catch (err) {
        res.status(500).send('Error generating ERD');
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

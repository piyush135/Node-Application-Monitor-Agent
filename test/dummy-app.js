const express = require('express');
const app = express();

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

app.get('/db/health', (req, res) => {
    res.status(200).json({ status: 'connected' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Dummy app listening on port ${PORT}`);
});
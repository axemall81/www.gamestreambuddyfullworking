const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 8080;

// Setup multer for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// ---------- PATHS & CONSTANTS (Adjust as needed) ----------
const SUNSHINE_APPS_JSON = 'C:\\Program Files\\Sunshine\\config\\apps.json';
const SUNSHINE_IMAGE_DIR = 'C:\\Program Files\\Sunshine\\images';
const SUNSHINE_EXE = '"C:\\Program Files\\Sunshine\\sunshine.exe"';
const MOONLIGHT_EXE = '"C:\\Program Files\\Moonlight Game Streaming\\Moonlight.exe"';

// Ensure the image directory exists
if (!fs.existsSync(SUNSHINE_IMAGE_DIR)) {
    fs.mkdirSync(SUNSHINE_IMAGE_DIR, { recursive: true });
}

// ---------- UTILITIES: LAUNCHING APPLICATIONS ----------

// Launch Steam
app.post('/launch-steam', (req, res) => {
    exec('start steam://open/main', (error) => {
        if (error) {
            return res.status(500).send(`Error launching Steam: ${error.message}`);
        }
        res.send('Steam launched successfully!');
    });
});

// Launch Moonlight
app.post('/launch-moonlight', (req, res) => {
    exec(`start "" ${MOONLIGHT_EXE}`, (err) => {
        if (err) {
            return res.status(500).send(`Error launching Moonlight: ${err.message}`);
        }
        res.send('Moonlight launched successfully!');
    });
});

// Restart Sunshine
app.post('/restart-sunshine', (req, res) => {
    exec('taskkill /IM sunshine.exe /F', (error) => {
        if (error) {
            return res.status(500).send(`Error stopping Sunshine: ${error.message}`);
        }
        // Wait 8 seconds before restarting
        setTimeout(() => {
            exec(`start "" ${SUNSHINE_EXE}`, (startErr) => {
                if (startErr) {
                    return res.status(500).send(`Error starting Sunshine: ${startErr.message}`);
                }
                res.send('Sunshine restarted successfully!');
            });
        }, 8000);
    });
});

// ---------- GAME MANAGEMENT ----------

// Helper to read Sunshine apps.json
function readSunshineConfig() {
    if (!fs.existsSync(SUNSHINE_APPS_JSON)) {
        return { apps: [] };
    }
    const raw = fs.readFileSync(SUNSHINE_APPS_JSON, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.apps) parsed.apps = [];
    return parsed;
}

// Helper to write Sunshine apps.json
function writeSunshineConfig(config) {
    fs.writeFileSync(SUNSHINE_APPS_JSON, JSON.stringify(config, null, 2), 'utf8');
}

// List current games
app.get('/api/games', (req, res) => {
    try {
        const config = readSunshineConfig();
        return res.json(config.apps);
    } catch (err) {
        return res.status(500).send(`Error reading config: ${err.message}`);
    }
});

// Add Steam Game with image upload
app.post('/api/add-steam-game', upload.single('steamImage'), (req, res) => {
    const { steamCommand, steamAppName } = req.body;
    const steamImage = req.file;

    if (!steamCommand || !steamAppName) {
        return res.status(400).send('Missing steamCommand or steamAppName');
    }

    try {
        const config = readSunshineConfig();
        const existing = config.apps.find(a => a.name === steamAppName || a.cmd === steamCommand);
        if (existing) {
            return res.status(400).send('This Steam game is already in Sunshine config');
        }

        let imagePath = '';
        if (steamImage) {
            const destPath = path.join(SUNSHINE_IMAGE_DIR, steamImage.originalname);
            fs.renameSync(steamImage.path, destPath);
            imagePath = destPath;
        }

        // Create the new app entry according to Sunshine's configuration format
        config.apps.push({
            name: steamAppName,
            cmd: steamCommand,
            'image-path': imagePath,
            'working-directory': '',
            detached: true
        });
        writeSunshineConfig(config);
        res.send(`Steam game "${steamAppName}" added successfully!`);
    } catch (err) {
        res.status(500).send(`Error adding Steam game: ${err.message}`);
    }
});

// Add Executable Game with image upload
app.post('/api/add-exe-game', upload.single('exeImage'), (req, res) => {
    const { exePath, exeName } = req.body;
    const exeImage = req.file;

    if (!exePath || !exeName) {
        return res.status(400).send('Missing exePath or exeName');
    }

    try {
        const config = readSunshineConfig();
        const existing = config.apps.find(a => a.name === exeName || a.cmd === exePath);
        if (existing) {
            return res.status(400).send('That .exe game is already in Sunshine config');
        }

        let imagePath = '';
        if (exeImage) {
            const destPath = path.join(SUNSHINE_IMAGE_DIR, exeImage.originalname);
            fs.renameSync(exeImage.path, destPath);
            imagePath = destPath;
        }

        // Create the new app entry according to Sunshine's configuration format
        config.apps.push({
            name: exeName,
            cmd: exePath,
            'image-path': imagePath,
            'working-directory': '',
            detached: true
        });
        writeSunshineConfig(config);
        res.send(`Executable game "${exeName}" added successfully!`);
    } catch (err) {
        res.status(500).send(`Error adding exe game: ${err.message}`);
    }
});

// Remove a game by name
app.post('/api/remove-game', (req, res) => {
    const { gameName } = req.body;
    if (!gameName) {
        return res.status(400).send('Missing gameName');
    }

    try {
        const config = readSunshineConfig();
        const oldCount = config.apps.length;
        config.apps = config.apps.filter(a => a.name !== gameName);
        const newCount = config.apps.length;

        if (newCount === oldCount) {
            return res.status(404).send(`No game named "${gameName}" found in Sunshine config`);
        }
        writeSunshineConfig(config);
        res.send(`Game "${gameName}" removed from Sunshine!`);
    } catch (err) {
        res.status(500).send(`Error removing game: ${err.message}`);
    }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
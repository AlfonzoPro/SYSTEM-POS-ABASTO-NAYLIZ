const { app, BrowserWindow } = require('electron');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

let mainWindow;
const PORT = 3456;

// Configuración de rutas de datos
const DATA_DIR = app.isPackaged 
    ? path.join(app.getPath('userData'), 'data') 
    : path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
    inventario: path.join(DATA_DIR, 'inventario.json'),
    ventas: path.join(DATA_DIR, 'ventas.json'),
    config: path.join(DATA_DIR, 'config.json')
};

// Utilidad para leer/escribir
const db = {
    read: (key) => {
        if (!fs.existsSync(FILES[key])) return key === 'config' ? { precioDolar: 36.5 } : [];
        try { return JSON.parse(fs.readFileSync(FILES[key], 'utf8')); } 
        catch (e) { return []; }
    },
    save: (key, data) => fs.writeFileSync(FILES[key], JSON.stringify(data, null, 2))
};

// --- SERVIDOR ---
const server = express();
server.use(cors());
server.use(bodyParser.json());
server.use(express.static(__dirname)); // Sirve HTML/JS/CSS desde la raíz

server.get('/api/:file', (req, res) => res.json(db.read(req.params.file)));
server.post('/api/:file', (req, res) => {
    db.save(req.params.file, req.body);
    res.json({ success: true });
});

server.listen(PORT, () => console.log(`Backend listo en puerto ${PORT}`));

// --- VENTANA ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300, height: 850,
        backgroundColor: '#1a1a1a',
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    mainWindow.loadURL(`http://localhost:${PORT}/index.html`);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
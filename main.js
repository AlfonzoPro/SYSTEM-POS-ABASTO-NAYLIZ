/**
 * MAIN.JS — Backend Electron 11 + sql.js
 * Sistema de Ventas Nayliz FP
 */

const { app, BrowserWindow } = require('electron');
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const path       = require('path');
const NaylizDB   = require('./database');

let mainWindow;
let naylizDB;
const PORT = 3456;

const DATA_DIR = app.isPackaged
    ? path.join(app.getPath('userData'), 'data')
    : path.join(__dirname, 'data');

const server = express();
server.use(cors());
server.use(bodyParser.json({ limit: '10mb' }));
server.use(express.static(__dirname));

// ── CONFIGURACIÓN ─────────────────────────────────────────────
server.get('/api/config', (req, res) => {
    try { res.json({ precioDolar: naylizDB.getConfig().precioDolar || 36.5 }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
server.post('/api/config', (req, res) => {
    try {
        if (req.body.precioDolar !== undefined) naylizDB.setConfig('precioDolar', req.body.precioDolar);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── INVENTARIO ────────────────────────────────────────────────
server.get('/api/inventario', (req, res) => {
    try { res.json(naylizDB.getInventario()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
server.post('/api/inventario', (req, res) => {
    try {
        if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Se esperaba un array' });
        naylizDB.guardarInventario(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── VENTAS ────────────────────────────────────────────────────
server.get('/api/ventas', (req, res) => {
    try { res.json(naylizDB.getVentas()); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
server.post('/api/ventas', (req, res) => {
    try {
        if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Se esperaba un array' });
        naylizDB.guardarVentas(req.body);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EXTRAS ────────────────────────────────────────────────────
server.post('/api/backup', (req, res) => {
    try { naylizDB.hacerBackup('manual'); res.json({ success: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
server.get('/api/estadisticas', (req, res) => {
    try { res.json(naylizDB.getEstadisticas(req.query.desde||null, req.query.hasta||null)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});
server.get('/api/salud', (req, res) => {
    try { res.json({ estado: 'OK', motor: 'sql.js 1.6.2', tasaDolar: naylizDB.getConfig().precioDolar }); }
    catch (e) { res.status(500).json({ estado: 'ERROR', error: e.message }); }
});

// ── ARRANQUE ──────────────────────────────────────────────────
app.whenReady().then(async () => {
    // 1. Inicializar BD (sql.js es async)
    naylizDB = new NaylizDB(DATA_DIR);
    await naylizDB.init();

    // 2. Iniciar servidor
    await new Promise(resolve => server.listen(PORT, () => {
        console.log('✅ Servidor listo en puerto ' + PORT);
        resolve();
    }));

    // 3. Abrir ventana
    mainWindow = new BrowserWindow({
        width: 1300, height: 850,
        backgroundColor: '#1a1a1a',
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    mainWindow.loadURL(`http://localhost:${PORT}/index.html`);
});

// ── CIERRE LIMPIO ─────────────────────────────────────────────
app.on('window-all-closed', () => {
    if (naylizDB) naylizDB.cerrar();
    setTimeout(() => {
        if (process.platform !== 'darwin') app.quit();
    }, 2000);
});

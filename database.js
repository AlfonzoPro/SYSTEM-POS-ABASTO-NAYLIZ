/**
 * DATABASE.JS — Base de Datos Relacional SQLite
 * Sistema de Ventas Nayliz FP
 * Motor: sql.js v1.6.2 (JavaScript puro, sin compilar)
 */

const fs   = require('fs');
const path = require('path');

class NaylizDB {
    constructor(dataDir) {
        this.dataDir   = dataDir;
        this.backupDir = path.join(dataDir, 'backups');
        this.dbPath    = path.join(dataDir, 'nayliz.db');
        this.db        = null;

        [dataDir, this.backupDir].forEach(dir => {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        });
    }

    async init() {
        const initSqlJs = require('sql.js');
        const SQL = await initSqlJs();

        if (fs.existsSync(this.dbPath)) {
            this.db = new SQL.Database(fs.readFileSync(this.dbPath));
            console.log('✅ BD cargada desde disco');
        } else {
            this.db = new SQL.Database();
            console.log('✅ Nueva BD creada');
        }

        this._crearTablas();
        this._guardar();
        this._migrarJSON();
        this._iniciarGuardadoAuto();
        this._iniciarBackupAuto();

        console.log('📁 BD en: ' + this.dbPath);
        return this;
    }

    // ── PERSISTENCIA ──────────────────────────────────────────
    _guardar() {
        try {
            fs.writeFileSync(this.dbPath, Buffer.from(this.db.export()));
        } catch (e) { console.error('Error guardando BD:', e.message); }
    }

    _iniciarGuardadoAuto() {
        setInterval(() => this._guardar(), 30000); // cada 30 segundos
    }

    // ── ESQUEMA ───────────────────────────────────────────────
    _crearTablas() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS configuracion (
                clave TEXT PRIMARY KEY,
                valor TEXT NOT NULL,
                actualizado TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS productos (
                codigo           INTEGER PRIMARY KEY,
                nombre           TEXT NOT NULL,
                precio_costo     REAL NOT NULL DEFAULT 0,
                precio_venta     REAL NOT NULL,
                activo           INTEGER NOT NULL DEFAULT 1,
                fecha_registro   TEXT DEFAULT (datetime('now')),
                fecha_modificado TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS ventas (
                id              INTEGER PRIMARY KEY,
                fecha           TEXT NOT NULL DEFAULT (datetime('now')),
                total_dolares   REAL NOT NULL DEFAULT 0,
                total_bolivares REAL NOT NULL DEFAULT 0,
                tasa_dolar      REAL NOT NULL DEFAULT 36.5,
                anulada         INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS ventas_detalle (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id        INTEGER NOT NULL,
                producto_codigo INTEGER NOT NULL,
                producto_nombre TEXT NOT NULL,
                precio_venta    REAL NOT NULL,
                precio_costo    REAL NOT NULL DEFAULT 0,
                cantidad        REAL NOT NULL,
                total_usd       REAL NOT NULL,
                total_bs        REAL NOT NULL,
                FOREIGN KEY (venta_id) REFERENCES ventas(id)
            );
            CREATE TABLE IF NOT EXISTS ventas_pagos (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id  INTEGER NOT NULL,
                metodo    TEXT NOT NULL,
                monto     REAL NOT NULL,
                monto_usd REAL NOT NULL,
                monto_bs  REAL NOT NULL,
                moneda    TEXT NOT NULL DEFAULT 'USD',
                FOREIGN KEY (venta_id) REFERENCES ventas(id)
            );
            CREATE TABLE IF NOT EXISTS ventas_cambio (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id     INTEGER NOT NULL,
                cambio_usd   REAL DEFAULT 0,
                cambio_bs    REAL DEFAULT 0,
                cambio_total REAL DEFAULT 0,
                FOREIGN KEY (venta_id) REFERENCES ventas(id)
            );
            CREATE TABLE IF NOT EXISTS auditoria (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha       TEXT DEFAULT (datetime('now')),
                accion      TEXT NOT NULL,
                tabla       TEXT NOT NULL,
                registro_id TEXT,
                detalle     TEXT
            );
        `);
        this.db.run(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('precioDolar', '36.5')`);
    }

    // ── HELPERS ───────────────────────────────────────────────
    _q(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            const rows = [];
            while (stmt.step()) rows.push(stmt.getAsObject());
            stmt.free();
            return rows;
        } catch (e) { console.error('Query error:', e.message, sql); return []; }
    }

    _q1(sql, params = []) {
        const r = this._q(sql, params);
        return r.length ? r[0] : null;
    }

    _r(sql, params = []) {
        try { this.db.run(sql, params); return true; }
        catch (e) { console.error('Run error:', e.message, sql); return false; }
    }

    // ── MIGRACIÓN DESDE JSON ──────────────────────────────────
    _migrarJSON() {
        if (this._q1(`SELECT valor FROM configuracion WHERE clave='migracion_completada'`)) return;

        const invPath = path.join(this.dataDir, 'inventario.json');
        if (fs.existsSync(invPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(invPath, 'utf8'));
                for (const p of (Array.isArray(data) ? data : [])) {
                    this._r(`INSERT OR IGNORE INTO productos (codigo,nombre,precio_costo,precio_venta) VALUES (?,?,?,?)`,
                        [p.codigo, p.nombre, p.precioCosto||0, p.precioVenta]);
                }
                fs.renameSync(invPath, invPath + '.migrated');
                console.log('📦 Inventario migrado');
            } catch (e) { console.error('Error migrando inventario:', e.message); }
        }

        const ventasPath = path.join(this.dataDir, 'ventas.json');
        if (fs.existsSync(ventasPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(ventasPath, 'utf8'));
                for (const v of (Array.isArray(data) ? data : [])) {
                    const f = v.fecha ? new Date(v.fecha).toISOString() : new Date().toISOString();
                    this._r(`INSERT OR IGNORE INTO ventas (id,fecha,total_dolares,total_bolivares,tasa_dolar) VALUES (?,?,?,?,?)`,
                        [v.id, f, v.totalDolares||0, v.totalBolivares||0, v.precioDolarUsado||36.5]);
                    for (const p of (v.productos||[])) {
                        this._r(`INSERT INTO ventas_detalle (venta_id,producto_codigo,producto_nombre,precio_venta,precio_costo,cantidad,total_usd,total_bs) VALUES (?,?,?,?,?,?,?,?)`,
                            [v.id, p.codigo, p.nombre, p.precioVenta||0, p.precioCosto||0, p.cantidad||1,
                             (p.precioVenta||0)*(p.cantidad||1),
                             (p.precioVenta||0)*(p.cantidad||1)*(v.precioDolarUsado||36.5)]);
                    }
                    for (const p of (v.mediosPago||[])) {
                        this._r(`INSERT INTO ventas_pagos (venta_id,metodo,monto,monto_usd,monto_bs,moneda) VALUES (?,?,?,?,?,?)`,
                            [v.id, p.metodo, p.monto||0, p.montoUSD||0, p.montoBs||0, p.moneda||'USD']);
                    }
                    if (v.cambio) this._r(`INSERT INTO ventas_cambio (venta_id,cambio_usd,cambio_bs,cambio_total) VALUES (?,?,?,?)`,
                        [v.id, v.cambio.cambioUSD||0, v.cambio.cambioBs||0, v.cambio.cambioTotal||0]);
                }
                fs.renameSync(ventasPath, ventasPath + '.migrated');
                console.log('📦 Ventas migradas');
            } catch (e) { console.error('Error migrando ventas:', e.message); }
        }

        const cfgPath = path.join(this.dataDir, 'config.json');
        if (fs.existsSync(cfgPath)) {
            try {
                const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                if (cfg.precioDolar) this._r(`UPDATE configuracion SET valor=? WHERE clave='precioDolar'`, [String(cfg.precioDolar)]);
                fs.renameSync(cfgPath, cfgPath + '.migrated');
            } catch (e) {}
        }

        this._r(`INSERT OR IGNORE INTO configuracion (clave,valor) VALUES ('migracion_completada','true')`);
        this._guardar();
        console.log('✅ Migración completada');
    }

    // ── BACKUPS ───────────────────────────────────────────────
    _iniciarBackupAuto() {
        this._backupSiEsNecesario();
        setInterval(() => this.hacerBackup('automatico'), 6 * 60 * 60 * 1000);
    }

    _backupSiEsNecesario() {
        const hoy = new Date().toISOString().slice(0, 10);
        const hay = fs.readdirSync(this.backupDir).some(f => f.includes(hoy));
        if (!hay) this.hacerBackup('diario');
    }

    hacerBackup(tipo = 'manual') {
        try {
            this._guardar();
            const ts   = new Date();
            const f    = ts.toISOString().slice(0,10);
            const h    = ts.toTimeString().slice(0,8).replace(/:/g,'-');
            const dest = path.join(this.backupDir, `backup_${f}_${h}_${tipo}.db`);
            fs.copyFileSync(this.dbPath, dest);
            console.log('📦 Backup: ' + path.basename(dest));
            this._limpiarViejos();
        } catch (e) { console.error('Error en backup:', e.message); }
    }

    _limpiarViejos() {
        try {
            const ahora = Date.now();
            const lista = fs.readdirSync(this.backupDir)
                .filter(f => f.endsWith('.db'))
                .map(f => ({ f, ruta: path.join(this.backupDir,f), mt: fs.statSync(path.join(this.backupDir,f)).mtimeMs }))
                .sort((a,b) => a.mt - b.mt);
            const viejos = lista.filter(x => (ahora - x.mt) > 30*86400000);
            if (lista.length - viejos.length < 5) return;
            viejos.forEach(x => fs.unlinkSync(x.ruta));
        } catch(e) {}
    }

    // ── CONFIGURACIÓN ─────────────────────────────────────────
    getConfig() {
        const cfg = {};
        this._q(`SELECT clave,valor FROM configuracion`).forEach(r => {
            cfg[r.clave] = isNaN(r.valor) ? r.valor : parseFloat(r.valor);
        });
        return cfg;
    }

    setConfig(clave, valor) {
        this._r(`INSERT INTO configuracion (clave,valor) VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor=excluded.valor`,
            [clave, String(valor)]);
        this._guardar();
        return { success: true };
    }

    // ── INVENTARIO ────────────────────────────────────────────
    getInventario() {
        return this._q(`SELECT codigo, nombre, precio_costo AS precioCosto, precio_venta AS precioVenta, fecha_registro AS fechaRegistro FROM productos WHERE activo=1 ORDER BY nombre ASC`);
    }

    guardarInventario(productos) {
        for (const p of productos) {
            this._r(`INSERT INTO productos (codigo,nombre,precio_costo,precio_venta) VALUES (?,?,?,?)
                     ON CONFLICT(codigo) DO UPDATE SET nombre=excluded.nombre, precio_costo=excluded.precio_costo, precio_venta=excluded.precio_venta, fecha_modificado=datetime('now')`,
                [p.codigo, p.nombre, p.precioCosto||0, p.precioVenta]);
        }
        const nuevos = productos.map(p => p.codigo);
        this._q(`SELECT codigo FROM productos WHERE activo=1`).forEach(r => {
            if (!nuevos.includes(r.codigo)) this._r(`UPDATE productos SET activo=0 WHERE codigo=?`, [r.codigo]);
        });
        this._guardar();
        return { success: true };
    }

    // ── VENTAS ────────────────────────────────────────────────
    getVentas() {
        return this._q(`SELECT id, fecha, total_dolares AS totalDolares, total_bolivares AS totalBolivares, tasa_dolar AS precioDolarUsado, anulada FROM ventas ORDER BY fecha DESC`)
            .map(v => ({
                ...v,
                productos:  this._q(`SELECT producto_codigo AS codigo, producto_nombre AS nombre, precio_venta AS precioVenta, precio_costo AS precioCosto, cantidad FROM ventas_detalle WHERE venta_id=?`, [v.id]),
                mediosPago: this._q(`SELECT metodo, monto, monto_usd AS montoUSD, monto_bs AS montoBs, moneda FROM ventas_pagos WHERE venta_id=?`, [v.id]),
                cambio:     this._q1(`SELECT cambio_usd AS cambioUSD, cambio_bs AS cambioBs, cambio_total AS cambioTotal FROM ventas_cambio WHERE venta_id=?`, [v.id])
            }));
    }

    guardarVentas(ventas) {
        const existentes = new Set(this._q(`SELECT id FROM ventas`).map(r => r.id));
        for (const v of ventas) {
            if (existentes.has(v.id)) continue;
            const f = v.fecha ? new Date(v.fecha).toISOString() : new Date().toISOString();
            this._r(`INSERT OR IGNORE INTO ventas (id,fecha,total_dolares,total_bolivares,tasa_dolar) VALUES (?,?,?,?,?)`,
                [v.id, f, v.totalDolares||0, v.totalBolivares||0, v.precioDolarUsado||36.5]);
            for (const p of (v.productos||[])) {
                this._r(`INSERT INTO ventas_detalle (venta_id,producto_codigo,producto_nombre,precio_venta,precio_costo,cantidad,total_usd,total_bs) VALUES (?,?,?,?,?,?,?,?)`,
                    [v.id, p.codigo, p.nombre, p.precioVenta||0, p.precioCosto||0, p.cantidad||1,
                     (p.precioVenta||0)*(p.cantidad||1),
                     (p.precioVenta||0)*(p.cantidad||1)*(v.precioDolarUsado||36.5)]);
            }
            for (const p of (v.mediosPago||[])) {
                this._r(`INSERT INTO ventas_pagos (venta_id,metodo,monto,monto_usd,monto_bs,moneda) VALUES (?,?,?,?,?,?)`,
                    [v.id, p.metodo, p.monto||0, p.montoUSD||0, p.montoBs||0, p.moneda||'USD']);
            }
            if (v.cambio) this._r(`INSERT INTO ventas_cambio (venta_id,cambio_usd,cambio_bs,cambio_total) VALUES (?,?,?,?)`,
                [v.id, v.cambio.cambioUSD||0, v.cambio.cambioBs||0, v.cambio.cambioTotal||0]);
        }
        this._guardar();
        return { success: true };
    }

    // ── ESTADÍSTICAS ──────────────────────────────────────────
    getEstadisticas(desde, hasta) {
        const hoy = new Date().toISOString().slice(0,10);
        desde = desde || hoy; hasta = hasta || hoy;
        return {
            resumen: this._q1(`SELECT COUNT(*) as totalVentas, SUM(total_dolares) as totalUSD, SUM(total_bolivares) as totalBs FROM ventas WHERE date(fecha) BETWEEN ? AND ? AND anulada=0`, [desde, hasta]) || {},
            porMetodo: this._q(`SELECT vp.metodo, SUM(vp.monto_usd) as totalUSD, COUNT(*) as cantidad FROM ventas_pagos vp JOIN ventas v ON v.id=vp.venta_id WHERE date(v.fecha) BETWEEN ? AND ? AND v.anulada=0 GROUP BY vp.metodo`, [desde, hasta]),
            periodo: { desde, hasta }
        };
    }

    // ── CERRAR ────────────────────────────────────────────────
    cerrar() {
        this.hacerBackup('cierre');
        this._guardar();
        try { this.db.close(); } catch(e) {}
        console.log('🔒 BD cerrada correctamente');
    }
}

module.exports = NaylizDB;

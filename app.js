// ==========================================
// VARIABLES GLOBALES
// ==========================================
let tasaDolar = 36.50;
let inventario = [];
let carrito = [];
let ventasDelDia = [];
let productoEnEdicion = null;
let indiceSeleccionado = -1;
let productosPOS = [];
let productoEnCantidad = null;
let pagosAgregados = [];
let totalVentaActual = 0;
let indiceCarritoEdicion = -1;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracion();
    
    if (document.body.classList.contains('pos-fullpage')) {
        await cargarInventario();
        actualizarInterfazCarrito();
        actualizarTasaEnPOS();
    }
    else if (document.getElementById('contenedor-dinamico')) {
        await cargarVentasDelDia();
        actualizarResumenDelDia();
    }
});

async function cargarConfiguracion() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        tasaDolar = config.precioDolar || 36.50;
        
        const displayTasa = document.getElementById('tasaDolarDisplay');
        if (displayTasa) displayTasa.textContent = tasaDolar.toFixed(2);
        
        const tasaPOS = document.getElementById('tasaDolarPOS');
        if (tasaPOS) tasaPOS.textContent = `Bs ${tasaDolar.toFixed(2)}`;
    } catch (e) {
        console.error("Error cargando configuración", e);
    }
}

async function cargarVentasDelDia() {
    try {
        const res = await fetch('/api/ventas');
        const todasLasVentas = await res.json();
        const hoy = new Date().toDateString();
        ventasDelDia = todasLasVentas.filter(v => {
            const fechaVenta = new Date(v.fecha).toDateString();
            return fechaVenta === hoy;
        });
        const facturasHoy = document.getElementById('facturasHoy');
        if (facturasHoy) facturasHoy.textContent = ventasDelDia.length;
    } catch (e) {
        console.error("Error cargando ventas del día", e);
    }
}

function actualizarResumenDelDia() {
    let efectivoSoloDolares = 0;
    let efectivoSoloBolivares = 0;
    let totalBiopago = 0;
    let totalPuntoVenta = 0;
    let totalPagoMovil = 0;
    let totalNotaCredito = 0;
    
    ventasDelDia.forEach(venta => {
        if (venta.mediosPago && Array.isArray(venta.mediosPago)) {
            venta.mediosPago.forEach(pago => {
                switch(pago.metodo) {
                    case 'EFECTIVO_USD': efectivoSoloDolares += pago.montoUSD; break;
                    case 'EFECTIVO_BS': efectivoSoloBolivares += (pago.montoBs || (pago.montoUSD * venta.precioDolarUsado)); break;
                    case 'BIOPAGO': totalBiopago += pago.montoUSD; break;
                    case 'PUNTO_VENTA': totalPuntoVenta += pago.montoUSD; break;
                    case 'PAGO_MOVIL': case 'TRANSFERENCIA': totalPagoMovil += pago.montoUSD; break;
                    case 'NOTA_CREDITO': totalNotaCredito += pago.montoUSD; break;
                }
            });
        }
    });
    
    const totalGeneralUSD = efectivoSoloDolares + (efectivoSoloBolivares / tasaDolar) + 
                          totalBiopago + totalPuntoVenta + totalPagoMovil + totalNotaCredito;

    document.getElementById('efectivoDolares').textContent = `$${efectivoSoloDolares.toFixed(2)}`;
    document.getElementById('efectivoBolivares').textContent = `Bs ${efectivoSoloBolivares.toFixed(2)}`;
    document.getElementById('biopago').textContent = `$${totalBiopago.toFixed(2)}`;
    document.getElementById('puntoVenta').textContent = `$${totalPuntoVenta.toFixed(2)}`;
    document.getElementById('pagoMovil').textContent = `$${totalPagoMovil.toFixed(2)}`;
    document.getElementById('notaCredito').textContent = `$${totalNotaCredito.toFixed(2)}`;
    document.getElementById('totalPagos').textContent = `$${totalGeneralUSD.toFixed(2)}`;
}

// ==========================================
// NAVEGACIÓN
// ==========================================
function abrirPOS() { window.location.href = 'pos.html'; }
function volverAlMenu() { window.location.href = 'index.html'; }

async function cargarPlantilla(nombre) {
    if (nombre === 'pos') { abrirPOS(); return; }
    const contenedor = document.getElementById('contenedor-dinamico');
    try {
        const respuesta = await fetch(`${nombre}.html`);
        if (!respuesta.ok) throw new Error("No se pudo encontrar la plantilla");
        const html = await respuesta.text();
        contenedor.innerHTML = html;
        if (nombre === 'inventario') { await cargarInventario(); renderizarTablaInventario(); }
    } catch (error) {
        contenedor.innerHTML = `<div class="error">Error al cargar el módulo: ${nombre}</div>`;
    }
}

function actualizarTasaEnPOS() {
    const tasaPOS = document.getElementById('tasaDolarPOS');
    if (tasaPOS) tasaPOS.textContent = `Bs ${tasaDolar.toFixed(2)}`;
}

// ==========================================
// LÓGICA DE INVENTARIO
// ==========================================
async function cargarInventario() {
    const res = await fetch('/api/inventario');
    inventario = await res.json();
}

function renderizarTablaInventario(mostrarTodos = false) {
    const tbody = document.querySelector('#listaProductos');
    if (!tbody) return;
    if (!mostrarTodos) {
        tbody.innerHTML = '<tr><td colspan="7" class="sin-productos">Usa el buscador para encontrar productos</td></tr>';
        return;
    }
    if (inventario.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="sin-productos">No hay productos registrados</td></tr>';
        return;
    }
    tbody.innerHTML = inventario.map(p => {
        const ganancia = p.precioVenta - (p.precioCosto || 0);
        const gananciaPorcentaje = p.precioCosto ? ((ganancia / p.precioCosto) * 100) : 0;
        return `<tr>
            <td>${p.codigo}</td><td>${p.nombre}</td><td>$${(p.precioCosto || 0).toFixed(2)}</td>
            <td>$${p.precioVenta.toFixed(2)}</td><td>$${ganancia.toFixed(2)}</td><td>${gananciaPorcentaje.toFixed(1)}%</td>
            <td><button class="btn-modificar" onclick="abrirModalModificar(${p.codigo})">✏️ Modificar</button></td>
        </tr>`;
    }).join('');
}

function filtrarInventario(valor) {
    const tbody = document.querySelector('#listaProductos');
    if (!tbody) return;
    if (!valor) {
        tbody.innerHTML = '<tr><td colspan="7" class="sin-productos">Usa el buscador para encontrar productos</td></tr>';
        return;
    }
    const esBusquedaLibre = valor.startsWith('*');
    const busquedaLimpiada = esBusquedaLibre ? valor.substring(1).toUpperCase() : valor.toUpperCase();
    if (esBusquedaLibre && busquedaLimpiada === "") return;

    const filtrado = inventario.filter(p => {
        const nombre = p.nombre.toUpperCase();
        const codigo = p.codigo.toString();
        return esBusquedaLibre ? (nombre.includes(busquedaLimpiada) || codigo.includes(busquedaLimpiada)) : (nombre.startsWith(busquedaLimpiada) || codigo.startsWith(busquedaLimpiada));
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    if (filtrado.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="sin-productos">No se encontraron productos</td></tr>';
        return;
    }
    tbody.innerHTML = filtrado.map(p => {
        const ganancia = p.precioVenta - (p.precioCosto || 0);
        const gananciaPorcentaje = p.precioCosto ? ((ganancia / p.precioCosto) * 100) : 0;
        return `<tr>
            <td>${p.codigo}</td><td>${p.nombre}</td><td>$${(p.precioCosto || 0).toFixed(2)}</td>
            <td>$${p.precioVenta.toFixed(2)}</td><td>$${ganancia.toFixed(2)}</td><td>${gananciaPorcentaje.toFixed(1)}%</td>
            <td><button class="btn-modificar" onclick="abrirModalModificar(${p.codigo})">✏️</button></td>
        </tr>`;
    }).join('');
}

async function guardarEnInventario(e) {
    e.preventDefault();
    const nombre = document.getElementById('inv-nombre').value.toUpperCase();
    const costo = parseFloat(document.getElementById('inv-costo').value);
    const precio = parseFloat(document.getElementById('inv-precio').value);
    if (precio <= costo && !confirm("El precio de venta es menor o igual al costo. ¿Desea continuar?")) return;

    const nuevoProducto = {
        codigo: Date.now(),
        nombre: nombre,
        precioCosto: costo,
        precioVenta: precio,
        fechaRegistro: new Date()
    };
    inventario.push(nuevoProducto);
    await fetch('/api/inventario', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(inventario)
    });
    e.target.reset();
    document.getElementById('buscarProducto').value = '';
    renderizarTablaInventario(false);
    alert('Producto agregado correctamente');
}

function abrirModalModificar(codigo) {
    const producto = inventario.find(p => p.codigo === codigo);
    if (!producto) return;
    productoEnEdicion = producto;
    document.getElementById('mod-codigo').value = producto.codigo;
    document.getElementById('mod-nombre').value = producto.nombre;
    document.getElementById('mod-costo').value = (producto.precioCosto || 0).toFixed(2);
    document.getElementById('mod-precio').value = producto.precioVenta.toFixed(2);
    actualizarGananciaModal();
    document.getElementById('mod-costo').addEventListener('input', actualizarGananciaModal);
    document.getElementById('mod-precio').addEventListener('input', actualizarGananciaModal);
    document.getElementById('modalModificar').style.display = 'flex';
}

function actualizarGananciaModal() {
    const costo = parseFloat(document.getElementById('mod-costo').value) || 0;
    const precio = parseFloat(document.getElementById('mod-precio').value) || 0;
    const ganancia = precio - costo;
    const gananciaPorcentaje = costo > 0 ? ((ganancia / costo) * 100) : 0;
    document.getElementById('mod-ganancia-valor').textContent = `$${ganancia.toFixed(2)}`;
    document.getElementById('mod-ganancia-porcentaje').textContent = `${gananciaPorcentaje.toFixed(1)}%`;
    const valorElemento = document.getElementById('mod-ganancia-valor');
    if (ganancia < 0) valorElemento.style.color = '#f44336';
    else if (ganancia === 0) valorElemento.style.color = '#ff9800';
    else valorElemento.style.color = '#4caf50';
}

function cerrarModalModificar() {
    document.getElementById('modalModificar').style.display = 'none';
    productoEnEdicion = null;
}

async function confirmarModificacion() {
    if (!productoEnEdicion) return;
    const nombre = document.getElementById('mod-nombre').value.toUpperCase();
    const costo = parseFloat(document.getElementById('mod-costo').value);
    const precio = parseFloat(document.getElementById('mod-precio').value);
    if (!nombre || isNaN(costo) || isNaN(precio)) { alert('Campos inválidos'); return; }
    if (precio <= costo && !confirm("Precio menor o igual al costo. ¿Continuar?")) return;
    
    const index = inventario.findIndex(p => p.codigo === productoEnEdicion.codigo);
    if (index !== -1) {
        inventario[index].nombre = nombre;
        inventario[index].precioCosto = costo;
        inventario[index].precioVenta = precio;
        await fetch('/api/inventario', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(inventario) });
        renderizarTablaInventario();
        cerrarModalModificar();
        alert('Producto modificado');
    }
}

async function eliminarProductoDesdeModal() {
    if (!productoEnEdicion) return;
    if (!confirm(`¿Eliminar "${productoEnEdicion.nombre}"?`)) return;
    inventario = inventario.filter(p => p.codigo !== productoEnEdicion.codigo);
    await fetch('/api/inventario', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(inventario) });
    renderizarTablaInventario();
    cerrarModalModificar();
    alert('Producto eliminado');
}

// ==========================================
// LÓGICA POS
// ==========================================
function buscarEnPOS(valor) {
    const divResultados = document.getElementById('resultados-busqueda');
    if (!divResultados) return;
    indiceSeleccionado = -1;
    if (!valor) { divResultados.innerHTML = '<div class="no-products">Busca un producto...</div>'; return; }

    const esBusquedaLibre = valor.startsWith('*');
    const busquedaLimpiada = esBusquedaLibre ? valor.substring(1).toUpperCase() : valor.toUpperCase();
    if (esBusquedaLibre && busquedaLimpiada === "") return;

    const filtrados = inventario.filter(p => {
        const nombre = p.nombre.toUpperCase();
        const codigo = p.codigo.toString();
        return esBusquedaLibre ? (nombre.includes(busquedaLimpiada) || codigo.includes(busquedaLimpiada)) : (nombre.startsWith(busquedaLimpiada) || codigo.startsWith(busquedaLimpiada));
    }).sort((a, b) => a.nombre.localeCompare(b.nombre)).slice(0, 15);

    if (filtrados.length === 0) { divResultados.innerHTML = '<div class="no-products">No se encontraron productos</div>'; return; }

    // CORRECCIÓN CLAVE: Agregadas comillas simples '${p.codigo}' para evitar errores si el código es string
    divResultados.innerHTML = filtrados.map(p => `
        <div class="resultado-item" onclick="abrirModalCantidad('${p.codigo}')">
            <div class="resultado-info">
                <span class="resultado-nombre">${p.nombre}</span>
                <span class="resultado-codigo">Cód: ${p.codigo}</span>
            </div>
            <div class="resultado-precios">
                <span class="precio-usd">$${p.precioVenta.toFixed(2)}</span>
                <span class="precio-bs">Bs ${(p.precioVenta * tasaDolar).toFixed(2)}</span>
            </div>
        </div>
    `).join('');
}

function actualizarInterfazCarrito() {
    const tbody = document.querySelector('#carritoProductos');
    if (!tbody) return;
    if (carrito.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="carrito-vacio">Carrito vacío</td></tr>';
        document.getElementById('total-usd').textContent = '$0.00';
        document.getElementById('total-bs').textContent = 'Bs 0.00';
        return;
    }
    let totalUsd = 0;
    tbody.innerHTML = carrito.map((item, index) => {
        const subtotalUsd = item.precioVenta * item.cantidad;
        totalUsd += subtotalUsd;
        // CORRECCIÓN CLAVE: Agregadas comillas simples '${item.codigo}'
        return `
            <tr class="fila-carrito-clicable">
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})">${index + 1}</td>
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})">${item.codigo}</td>
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})">${item.nombre}</td>
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})" class="col-cantidad-fija"><span class="badge-cantidad">${item.cantidad}</span></td>
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})">$${item.precioVenta.toFixed(2)}</td>
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})">Bs ${(item.precioVenta * tasaDolar).toFixed(2)}</td>
                <td onclick="abrirModalCantidad('${item.codigo}', ${index})">Bs ${(subtotalUsd * tasaDolar).toFixed(2)}</td>
                <td><button class="btn-eliminar-item" onclick="quitarDelCarrito(${index})">❌</button></td>
            </tr>`;
    }).join('');
    document.getElementById('total-usd').textContent = `$${totalUsd.toFixed(2)}`;
    document.getElementById('total-bs').textContent = `Bs ${(totalUsd * tasaDolar).toFixed(2)}`;
}

function quitarDelCarrito(index) { carrito.splice(index, 1); actualizarInterfazCarrito(); }
function limpiarCarrito() { if (carrito.length > 0 && confirm("¿Limpiar carrito?")) { carrito = []; actualizarInterfazCarrito(); } }

async function actualizarTasa(valor) {
    tasaDolar = parseFloat(valor) || 0;
    await fetch('/api/config', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ precioDolar: tasaDolar }) });
    document.getElementById('tasaDolarDisplay').textContent = tasaDolar.toFixed(2);
    const tasaPOS = document.getElementById('tasaDolarPOS');
    if (tasaPOS) tasaPOS.textContent = `Bs ${tasaDolar.toFixed(2)}`;
    actualizarInterfazCarrito();
}

// ==========================================
// MODAL TASA
// ==========================================
function abrirModalTasa() {
    const modal = document.getElementById('modalEditarTasa');
    document.getElementById('tasaActualModal').textContent = `Bs ${tasaDolar.toFixed(2)}`;
    const input = document.getElementById('inputNuevaTasa');
    input.value = tasaDolar.toFixed(2);
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
    input.onkeydown = (e) => { if (e.key === 'Enter') guardarNuevaTasa(); if (e.key === 'Escape') cerrarModalTasa(); };
}
function cerrarModalTasa() { document.getElementById('modalEditarTasa').style.display = 'none'; }
async function guardarNuevaTasa() {
    const nueva = parseFloat(document.getElementById('inputNuevaTasa').value);
    if (!isNaN(nueva) && nueva > 0) { tasaDolar = nueva; await actualizarTasa(nueva); cerrarModalTasa(); }
}

// ==========================================
// NAVEGACIÓN TECLADO
// ==========================================
function manejarTeclasBusqueda(event) {
    const resultados = document.querySelectorAll('.resultado-item');
    if (resultados.length === 0) return;
    if (event.key === 'ArrowDown') {
        event.preventDefault(); indiceSeleccionado++;
        if (indiceSeleccionado >= resultados.length) indiceSeleccionado = 0;
        actualizarSeleccion(resultados);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault(); indiceSeleccionado--;
        if (indiceSeleccionado < 0) indiceSeleccionado = resultados.length - 1;
        actualizarSeleccion(resultados);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (indiceSeleccionado >= 0 && indiceSeleccionado < resultados.length) resultados[indiceSeleccionado].click();
    }
}
function actualizarSeleccion(resultados) {
    resultados.forEach((item, index) => {
        if (index === indiceSeleccionado) { item.classList.add('seleccionado'); item.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        else item.classList.remove('seleccionado');
    });
}

// ==========================================
// MODAL CANTIDAD
// ==========================================
function abrirModalCantidad(codigo, indexEnCarrito = -1) {
    // CORRECCIÓN CLAVE: Usamos String() para asegurar comparación
    const producto = inventario.find(p => String(p.codigo) === String(codigo));
    if (!producto) return;
    productoEnCantidad = producto;
    indiceCarritoEdicion = indexEnCarrito;
    
    document.getElementById('nombreProductoCantidad').textContent = producto.nombre;
    document.getElementById('codigoProductoCantidad').textContent = `Cód: ${producto.codigo}`;
    document.getElementById('precioDolarCantidad').textContent = `$${producto.precioVenta.toFixed(2)}`;
    document.getElementById('precioBsCantidad').textContent = `Bs ${(producto.precioVenta * tasaDolar).toFixed(2)}`;
    
    const input = document.getElementById('inputCantidadProducto');
    input.value = indiceCarritoEdicion > -1 ? carrito[indiceCarritoEdicion].cantidad : '1';
    actualizarTotalCantidad();
    document.getElementById('modalCantidadProducto').style.display = 'flex';
    setTimeout(() => { input.focus(); input.select(); }, 100);
    input.oninput = actualizarTotalCantidad;
    input.onkeydown = (e) => { if (e.key === 'Enter') confirmarCantidadProducto(); if (e.key === 'Escape') cancelarCantidadProducto(); };
}

function actualizarTotalCantidad() {
    const cant = parseFloat(document.getElementById('inputCantidadProducto').value) || 0;
    if (productoEnCantidad) {
        const total = productoEnCantidad.precioVenta * cant;
        document.getElementById('totalDolarCantidad').textContent = `$${total.toFixed(2)}`;
        document.getElementById('totalBsCantidad').textContent = `Bs ${(total * tasaDolar).toFixed(2)}`;
    }
}

function confirmarCantidadProducto() {
    const cant = parseFloat(document.getElementById('inputCantidadProducto').value);
    if (!cant || cant <= 0) { alert('Cantidad inválida'); return; }
    if (indiceCarritoEdicion > -1) carrito[indiceCarritoEdicion].cantidad = cant;
    else {
        // CORRECCIÓN CLAVE: Usamos String()
        const existente = carrito.find(c => String(c.codigo) === String(productoEnCantidad.codigo));
        if (existente) existente.cantidad += cant;
        else carrito.push({ ...productoEnCantidad, cantidad: cant });
    }
    actualizarInterfazCarrito();
    cancelarCantidadProducto();
    document.getElementById('buscarProductoPOS').value = '';
    document.getElementById('buscarProductoPOS').focus();
    document.getElementById('resultados-busqueda').innerHTML = '<div class="no-products">Busca un producto...</div>';
}

function cancelarCantidadProducto() {
    document.getElementById('modalCantidadProducto').style.display = 'none';
    productoEnCantidad = null;
    document.getElementById('buscarProductoPOS').focus();
}

// ==========================================
// PAGOS MIXTOS Y TICKET
// ==========================================
function abrirModalPagos() {
    if (carrito.length === 0) { alert("Carrito vacío"); return; }
    totalVentaActual = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
    pagosAgregados = [];
    document.getElementById('totalVentaUSD').textContent = `$${totalVentaActual.toFixed(2)}`;
    document.getElementById('totalVentaBS').textContent = `Bs ${(totalVentaActual * tasaDolar).toFixed(2)}`;
    renderizarPagosAgregados();
    actualizarEstadoPagos();
    document.getElementById('modalPagosMixtos').style.display = 'flex';
    const select = document.getElementById('metodoPago');
    select.value = 'EFECTIVO_USD';
    seleccionarMetodoPago('EFECTIVO_USD');
    setTimeout(() => select.focus(), 100);
}

function seleccionarMetodoPago(metodo) {
    const input = document.getElementById('montoPago');
    document.getElementById('metodoPago').value = metodo;
    const pagado = pagosAgregados.reduce((sum, p) => sum + p.montoUSD, 0);
    const faltante = totalVentaActual - pagado;
    if (metodo === 'EFECTIVO_USD') {
        input.value = faltante > 0 ? faltante.toFixed(2) : "0.00";
        document.getElementById('labelMonedaInput').textContent = "Monto en $:";
    } else {
        input.value = (faltante > 0 ? faltante * tasaDolar : 0).toFixed(2);
        document.getElementById('labelMonedaInput').textContent = "Monto en Bs:";
    }
    input.focus(); setTimeout(() => input.select(), 10);
}

window.addEventListener('keydown', (e) => {
    if (document.getElementById('modalPagosMixtos').style.display === 'flex') {
        const map = {'F4':'EFECTIVO_USD', 'F5':'EFECTIVO_BS', 'F6':'BIOPAGO', 'F7':'PUNTO_VENTA', 'F8':'PAGO_MOVIL', 'F9':'NOTA_CREDITO'};
        if (map[e.key]) { e.preventDefault(); seleccionarMetodoPago(map[e.key]); }
        if (e.key === 'Enter' && (document.activeElement.id === 'montoPago' || document.activeElement.id === 'metodoPago')) {
            e.preventDefault(); agregarMetodoPago();
        }
    }
});

function cerrarModalPagos() { document.getElementById('modalPagosMixtos').style.display = 'none'; pagosAgregados = []; }

function agregarMetodoPago() {
    const metodo = document.getElementById('metodoPago').value;
    const monto = parseFloat(document.getElementById('montoPago').value);
    if (!monto || monto <= 0) { alert('Monto inválido'); return; }
    let usd = 0, bs = 0, mon = '';
    if (metodo === 'EFECTIVO_USD') { usd = monto; bs = monto * tasaDolar; mon = 'USD'; }
    else { bs = monto; usd = monto / tasaDolar; mon = 'Bs'; }
    pagosAgregados.push({ metodo, monto, montoUSD: usd, montoBs: bs, moneda: mon });
    renderizarPagosAgregados();
    actualizarEstadoPagos();
    document.getElementById('montoPago').value = '';
    document.getElementById('montoPago').focus();
}

function renderizarPagosAgregados() {
    const tbody = document.getElementById('listaPagosAgregados');
    if (pagosAgregados.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="sin-pagos">Sin pagos</td></tr>'; return; }
    tbody.innerHTML = pagosAgregados.map((p, i) => `
        <tr><td>${getNombreMetodo(p.metodo)}</td><td>${p.moneda === 'Bs' ? 'Bs' : '$'} ${p.monto.toFixed(2)}</td>
        <td><button class="btn-eliminar-pago" onclick="eliminarPago(${i})">❌</button></td></tr>
    `).join('');
}

function getNombreMetodo(m) {
    const map = {'EFECTIVO_USD':'💵 Efec. USD', 'EFECTIVO_BS':'💵 Efec. Bs', 'BIOPAGO':'💳 Biopago', 'PUNTO_VENTA':'💳 Punto', 'PAGO_MOVIL':'📱 P. Móvil', 'NOTA_CREDITO':'📄 Nota'};
    return map[m] || m;
}

function eliminarPago(i) { pagosAgregados.splice(i, 1); renderizarPagosAgregados(); actualizarEstadoPagos(); }

function actualizarEstadoPagos() {
    const pagadoUSD = pagosAgregados.reduce((s, p) => s + p.montoUSD, 0);
    const pagadoBS = pagadoUSD * tasaDolar;
    const faltante = totalVentaActual - pagadoUSD;
    const cambio = pagadoUSD - totalVentaActual;
    const cambioBS = cambio * tasaDolar;

    document.getElementById('totalPagado').textContent = `$${pagadoUSD.toFixed(2)} (Bs ${pagadoBS.toFixed(2)})`;
    document.getElementById('faltantePago').textContent = `$${(faltante > 0 ? faltante : 0).toFixed(2)} (Bs ${(faltante > 0 ? faltante * tasaDolar : 0).toFixed(2)})`;
    
    const pct = totalVentaActual > 0 ? Math.min((pagadoUSD / totalVentaActual) * 100, 100) : 0;
    const bar = document.getElementById('barraProgresoPago');
    bar.style.width = `${pct}%`;
    document.getElementById('porcentajePago').textContent = `${pct.toFixed(1)}%`;
    if (pct >= 100) { bar.className = 'barra-relleno-mini completo'; document.getElementById('porcentajePago').style.color = '#4caf50'; }
    else { bar.className = 'barra-relleno-mini parcial'; document.getElementById('porcentajePago').style.color = '#ff9800'; }

    const secCambio = document.getElementById('cambioSection');
    const opCambio = document.getElementById('opcionesCambio');
    if (cambio > 0.01) {
        secCambio.style.display = 'flex'; opCambio.style.display = 'block';
        document.getElementById('cambioPago').textContent = `$${cambio.toFixed(2)} (Bs ${cambioBS.toFixed(2)})`;
    } else {
        secCambio.style.display = 'none'; opCambio.style.display = 'none';
    }

    // LÓGICA BOTONES NUEVOS
    let habilitar = false;
    if (cambio > 0.01) {
        const cUSD = parseFloat(document.getElementById('cambioUSD').value) || 0;
        const cBS = parseFloat(document.getElementById('cambioBS').value) || 0;
        habilitar = Math.abs((cUSD + (cBS / tasaDolar)) - cambio) <= 0.01;
    } else {
        habilitar = faltante <= 0.01;
    }
    
    // Habilitar ambos botones
    const btnSin = document.getElementById('btnFinalizarSinTicket');
    const btnCon = document.getElementById('btnFinalizarConTicket');
    if(btnSin) btnSin.disabled = !habilitar;
    if(btnCon) btnCon.disabled = !habilitar;
}

function calcularCambioBs() {
    const cUSD = parseFloat(document.getElementById('cambioUSD').value) || 0;
    const pagado = pagosAgregados.reduce((s, p) => s + p.montoUSD, 0);
    const cambioTotal = pagado - totalVentaActual;
    const cBS = (cambioTotal - cUSD) * tasaDolar;
    document.getElementById('cambioBS').value = cBS > 0 ? cBS.toFixed(2) : '0.00';
    actualizarEstadoPagos();
}

async function finalizarVentaConPagos(imprimir = false) {
    const totalPagadoUSD = pagosAgregados.reduce((sum, pago) => sum + pago.montoUSD, 0);
    const cambio = totalPagadoUSD - totalVentaActual;
    
    // Preparar información de cambio
    let infoCambio = null;
    if (cambio > 0.01) {
        const cambioUSD = parseFloat(document.getElementById('cambioUSD').value) || 0;
        const cambioBs = parseFloat(document.getElementById('cambioBS').value) || 0;
        
        infoCambio = {
            cambioUSD: cambioUSD,
            cambioBs: cambioBs,
            cambioTotal: cambio
        };
    }
    
    // Preparar objeto de venta (USAR JSON.parse/stringify para romper referencias)
    const nuevaVenta = {
        id: Date.now(),
        fecha: new Date(),
        productos: JSON.parse(JSON.stringify(carrito)),
        totalDolares: totalVentaActual,
        totalBolivares: totalVentaActual * tasaDolar,
        precioDolarUsado: tasaDolar,
        mediosPago: JSON.parse(JSON.stringify(pagosAgregados)),
        cambio: infoCambio
    };
    
    try {
        // Guardar en base de datos
        const resVentas = await fetch('/api/ventas');
        const ventasExistentes = await resVentas.json();
        ventasExistentes.push(nuevaVenta);
        
        await fetch('/api/ventas', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(ventasExistentes)
        });

        // LÓGICA DE IMPRESIÓN CORREGIDA
        if (imprimir) {
            // 1. Generar el HTML primero
            generarTicketHTML(nuevaVenta);
            
            // 2. Esperar 500ms para asegurar que el navegador renderizó el ticket en el DOM oculto
            setTimeout(() => {
                // 3. Abrir diálogo de impresión
                window.print();
                
                // 4. Limpiar SOLO después de imprimir (o cancelar impresión)
                // Le damos un pequeño delay extra para no borrar mientras se cierra el diálogo
                setTimeout(() => {
                    limpiarSistemaDespuesDeVenta();
                }, 500);
            }, 500);
        } else {
            alert("✅ Venta registrada correctamente.");
            limpiarSistemaDespuesDeVenta();
        }

    } catch (error) {
        console.error("Error guardando venta:", error);
        alert("Error al guardar la venta: " + error.message);
    }
}

function limpiarSistemaDespuesDeVenta() {
    carrito = [];
    pagosAgregados = [];
    actualizarInterfazCarrito();
    cerrarModalPagos();
    document.getElementById('buscarProductoPOS').value = '';
    document.getElementById('buscarProductoPOS').focus();
    document.getElementById('resultados-busqueda').innerHTML = '<div class="no-products">Busca un producto...</div>';
}

function generarTicketHTML(venta) {
    const cont = document.getElementById('ticket-impresion');
    if (!cont) return;

    // Formato Fecha
    const fecha = new Date(venta.fecha);
    const fechaStr = `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}/${String(fecha.getFullYear()).slice(-2)}`;
    const horaStr = `${String(fecha.getHours()).padStart(2,'0')}:${String(fecha.getMinutes()).padStart(2,'0')}`;

    // Generar Productos
    let prodsHTML = '';
    venta.productos.forEach(p => {
        const precioBs = p.precioVenta * venta.precioDolarUsado;
        const totalBs = precioBs * p.cantidad;
        
        // Formato simplificado para ahorrar espacio horizontal
        prodsHTML += `
            <div class="ticket-prod-row">
                <span class="ticket-prod-nombre">${p.nombre}</span>
                <div class="ticket-prod-detalle">
                    <span>(${p.cantidad}) x ${precioBs.toFixed(2)}Bs </span>
                    <span>${totalBs.toFixed(2)}Bs </span>
                </div>
            </div>`;
    });

    // Generar Pagos
    let pagosHTML = '';
    venta.mediosPago.forEach(p => {
        let label = '', val = '';
        if (p.moneda === 'USD') { 
            label = 'EFECTIVO $'; 
            val = `${p.monto.toFixed(2)}$`; 
        } else {
            const map = {'PUNTO_VENTA':'P.VENTA', 'PAGO_MOVIL':'P.MOVIL', 'BIOPAGO':'BIOPAGO', 'EFECTIVO_BS': 'EFEC. BS'};
            label = map[p.metodo] || 'OTRO';
            val = `${p.monto.toFixed(2)}Bs`;
        }
        pagosHTML += `<div style="display:flex;justify-content:flex-end;gap:5px;"><span>${label}:</span> <span>${val}</span></div>`;
    });

    // LÍNEA SEPARADORA (32 Caracteres es el ancho máximo seguro en 58mm con letra normal)
    const linea = '--------------------------------';
    const linea2 = '================================';
    const linea3 = '********************************';

    cont.innerHTML = `
        <div class="ticket-linea">${linea3}</div>

        <div class="ticket-centrado" style="font-size: 12px;">
            ABASTO E INVERSIONES<br>
            NAYLIZ, FP<br>
            V-13063751-1
        </div>
        
        <div class="ticket-linea">${linea3}</div>
        
        <div style="display:flex; justify-content:space-between;">
            <span>FECHA: ${fechaStr}</span>
            <span>HORA: ${horaStr}</span>
        </div>
        
        <div class="ticket-centrado" style="margin: 8px 0; font-weight:bold; font-size: 12px;">
            NOTA DE ENTREGA
        </div>
        
        <div class="ticket-linea">${linea2}</div>
        
        <div style="margin-top:2px;">
            ${prodsHTML}
        </div>
        
        <div class="ticket-linea">${linea}</div>
        
        <div class="ticket-doble-columna">
            <span>TOTAL Bs:</span>
            <span>${venta.totalBolivares.toFixed(2)}</span>
        </div>
        <div class="ticket-doble-columna">
            <span>TOTAL $:</span>
            <span>${venta.totalDolares.toFixed(2)}</span>
        </div>
        
        <div class="ticket-linea">${linea}</div>
        
        <div class="ticket-centrado" style="margin:2px 0; font-weight:bold;">PAGOS REGISTRADOS</div>
        <div class="ticket-pagos-bloque">
            ${pagosHTML}
        </div>

        <div class="ticket-centrado" style="margin-top:30px; margin-bottom:80px;">
            GRACIAS POR TU COMPRA...!!
        </div>
        <div style="margin-top: 80px; color: white;">.</div>
        <br>
    `;
}
// ==========================================
// CALENDARIO - BUSCAR DÍAS ANTERIORES
// ==========================================
let calMes = new Date().getMonth();
let calAnio = new Date().getFullYear();
let todasLasVentas = [];

async function abrirBuscadorFechas() {
    if (todasLasVentas.length === 0) {
        const res = await fetch('/api/ventas');
        todasLasVentas = await res.json();
    }
    calMes  = new Date().getMonth();
    calAnio = new Date().getFullYear();
    document.getElementById('resumenDiaSeleccionado').style.display = 'none';

    // Poblar selector de años dinámicamente según las ventas registradas
    const anioActual = new Date().getFullYear();
    let anioMinimo = anioActual;
    if (todasLasVentas.length > 0) {
        anioMinimo = todasLasVentas.reduce((min, v) => {
            const y = new Date(v.fecha).getFullYear();
            return y < min ? y : min;
        }, anioActual);
    }
    const selectAnio = document.getElementById('calSelectAnio');
    if (selectAnio) {
        selectAnio.innerHTML = '';
        for (let y = anioActual; y >= anioMinimo; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            selectAnio.appendChild(opt);
        }
    }

    renderizarCalendario();
    document.getElementById('modalCalendario').style.display = 'flex';
}

function cerrarCalendario() {
    document.getElementById('modalCalendario').style.display = 'none';
}

function cambiarMesCalendario(dir) {
    calMes += dir;
    if (calMes > 11) { calMes = 0; calAnio++; }
    if (calMes < 0)  { calMes = 11; calAnio--; }
    document.getElementById('resumenDiaSeleccionado').style.display = 'none';
    renderizarCalendario();
}

function irAMesAnio() {
    const selMes  = document.getElementById('calSelectMes');
    const selAnio = document.getElementById('calSelectAnio');
    if (!selMes || !selAnio) return;
    calMes  = parseInt(selMes.value);
    calAnio = parseInt(selAnio.value);
    document.getElementById('resumenDiaSeleccionado').style.display = 'none';
    renderizarCalendario();
}

function renderizarCalendario() {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('calTituloMes').textContent = `${meses[calMes]} ${calAnio}`;

    // Sincronizar los selectores con el mes/año navegado
    const selMes  = document.getElementById('calSelectMes');
    const selAnio = document.getElementById('calSelectAnio');
    if (selMes)  selMes.value  = calMes;
    if (selAnio) selAnio.value = calAnio;

    // Fechas con ventas en este mes
    const fechasConVentas = new Set(
        todasLasVentas.map(v => {
            const f = new Date(v.fecha);
            return `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`;
        })
    );

    const primerDia = new Date(calAnio, calMes, 1).getDay();
    const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();
    const hoy = new Date();

    let html = '';
    // Celdas vacías antes del primer día
    for (let i = 0; i < primerDia; i++) html += '<div class="cal-dia vacio"></div>';

    for (let d = 1; d <= diasEnMes; d++) {
        const clave = `${calAnio}-${calMes}-${d}`;
        const tieneVentas = fechasConVentas.has(clave);
        const esHoy = (d === hoy.getDate() && calMes === hoy.getMonth() && calAnio === hoy.getFullYear());
        const esFuturo = new Date(calAnio, calMes, d) > hoy;

        let clases = 'cal-dia';
        if (esHoy) clases += ' hoy';
        if (tieneVentas) clases += ' con-ventas';
        if (esFuturo) clases += ' futuro';

        const onclick = tieneVentas && !esFuturo
            ? `onclick="seleccionarDiaCalendario(${d})"`
            : '';

        html += `<div class="${clases}" ${onclick}>${d}${tieneVentas ? '<span class="cal-punto"></span>' : ''}</div>`;
    }

    document.getElementById('calGrid').innerHTML = html;
}

function seleccionarDiaCalendario(dia) {
    const fechaSelStr = `${calAnio}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const ventasDia = todasLasVentas.filter(v => {
        const f = new Date(v.fecha);
        const fStr = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`;
        return fStr === fechaSelStr;
    });

    if (ventasDia.length === 0) return;

    // Calcular resumen igual que actualizarResumenDelDia
    let efectivoUSD = 0, efectivoBs = 0, biopago = 0, puntoVenta = 0, pagoMovil = 0, notaCredito = 0;
    ventasDia.forEach(v => {
        (v.mediosPago || []).forEach(p => {
            switch(p.metodo) {
                case 'EFECTIVO_USD':  efectivoUSD  += p.montoUSD; break;
                case 'EFECTIVO_BS':   efectivoBs   += (p.montoBs || p.montoUSD * v.precioDolarUsado); break;
                case 'BIOPAGO':       biopago      += p.montoUSD; break;
                case 'PUNTO_VENTA':   puntoVenta   += p.montoUSD; break;
                case 'PAGO_MOVIL':    pagoMovil    += p.montoUSD; break;
                case 'NOTA_CREDITO':  notaCredito  += p.montoUSD; break;
            }
        });
    });
    const totalUSD = efectivoUSD + (efectivoBs / tasaDolar) + biopago + puntoVenta + pagoMovil + notaCredito;

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const fechaLabel = `${dia} ${meses[calMes]} ${calAnio}`;

    const div = document.getElementById('resumenDiaSeleccionado');
    div.style.display = 'block';
    div.innerHTML = `
        <div class="cal-resumen-titulo">📊 Resumen — ${fechaLabel} (${ventasDia.length} facturas)</div>
        <div class="cal-resumen-grid">
            <div class="cal-res-item"><span>💵 Efectivo $</span><b>$${efectivoUSD.toFixed(2)}</b></div>
            <div class="cal-res-item"><span>💵 Efectivo Bs</span><b>Bs ${efectivoBs.toFixed(2)}</b></div>
            <div class="cal-res-item"><span>💳 Biopago</span><b>$${biopago.toFixed(2)}</b></div>
            <div class="cal-res-item"><span>💳 Punto Venta</span><b>$${puntoVenta.toFixed(2)}</b></div>
            <div class="cal-res-item"><span>📱 Pago Móvil</span><b>$${pagoMovil.toFixed(2)}</b></div>
            <div class="cal-res-item"><span>📄 Nota Crédito</span><b>$${notaCredito.toFixed(2)}</b></div>
        </div>
        <div class="cal-resumen-total">TOTAL: $${totalUSD.toFixed(2)}</div>
    `;

    // Marcar día seleccionado visualmente
    document.querySelectorAll('.cal-dia').forEach(el => el.classList.remove('seleccionado'));
    event.currentTarget.classList.add('seleccionado');
}

// ==========================================
// VENTAS DEL DÍA - LISTA DE FACTURAS
// ==========================================
async function abrirVentasDelDia() {
    if (todasLasVentas.length === 0) {
        const res = await fetch('/api/ventas');
        todasLasVentas = await res.json();
    }

    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;

    const ventasHoy = todasLasVentas.filter(v => {
        const f = new Date(v.fecha);
        const fStr = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-${String(f.getDate()).padStart(2,'0')}`;
        return fStr === hoyStr;
    }).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    document.getElementById('tituloFechaVentas').textContent =
        `${hoy.getDate()} ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;

    const lista = document.getElementById('listaFacturas');
    if (ventasHoy.length === 0) {
        lista.innerHTML = '<div class="factura-vacia">No hay ventas registradas hoy</div>';
    } else {
        lista.innerHTML = ventasHoy.map((v, i) => {
            const f = new Date(v.fecha);
            const hora = `${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}`;
            const metodos = [...new Set((v.mediosPago || []).map(p => getNombreMetodoCorto(p.metodo)))].join(' + ');
            return `
                <div class="factura-item" onclick="verDetalleFactura(${i})" id="factura-item-${i}">
                    <div class="factura-item-top">
                        <span class="factura-num">#${ventasHoy.length - i}</span>
                        <span class="factura-hora">${hora}</span>
                    </div>
                    <div class="factura-item-bot">
                        <span class="factura-total">$${v.totalDolares.toFixed(2)}</span>
                        <span class="factura-metodos">${metodos}</span>
                    </div>
                </div>`;
        }).join('');
    }

    // Guardar ventas de hoy en variable accesible
    window._ventasHoyModal = ventasHoy;
    document.getElementById('detalleFacturaPanel').innerHTML = '<div class="detalle-vacio">← Selecciona una factura</div>';
    document.getElementById('modalVentasDia').style.display = 'flex';
}

function cerrarVentasDia() {
    document.getElementById('modalVentasDia').style.display = 'none';
}

function getNombreMetodoCorto(m) {
    const map = {'EFECTIVO_USD':'Efec$','EFECTIVO_BS':'EfecBs','BIOPAGO':'Bio','PUNTO_VENTA':'PV','PAGO_MOVIL':'PM','NOTA_CREDITO':'NC'};
    return map[m] || m;
}

function verDetalleFactura(index) {
    const v = window._ventasHoyModal[index];
    if (!v) return;

    // Resaltar seleccionado
    document.querySelectorAll('.factura-item').forEach(el => el.classList.remove('activa'));
    const el = document.getElementById(`factura-item-${index}`);
    if (el) el.classList.add('activa');

    const f = new Date(v.fecha);
    const fechaStr = `${String(f.getDate()).padStart(2,'0')}/${String(f.getMonth()+1).padStart(2,'0')}/${f.getFullYear()}`;
    const horaStr  = `${String(f.getHours()).padStart(2,'0')}:${String(f.getMinutes()).padStart(2,'0')}`;

    const productosHTML = (v.productos || []).map(p => `
        <tr>
            <td>${p.nombre}</td>
            <td class="td-center">${p.cantidad}</td>
            <td class="td-right">$${p.precioVenta.toFixed(2)}</td>
            <td class="td-right">$${(p.precioVenta * p.cantidad).toFixed(2)}</td>
        </tr>`).join('');

    const pagosHTML = (v.mediosPago || []).map(p => {
        const val = p.moneda === 'USD' ? `$${p.monto.toFixed(2)}` : `Bs ${p.monto.toFixed(2)}`;
        return `<div class="detalle-pago-row"><span>${getNombreMetodo(p.metodo)}</span><b>${val}</b></div>`;
    }).join('');

    document.getElementById('detalleFacturaPanel').innerHTML = `
        <div class="detalle-factura-contenido">
            <div class="detalle-header-fact">
                <span>📅 ${fechaStr} — ${horaStr}</span>
                <button class="btn-reimprimir" onclick="reimprimirTicket(${index})">🖨️ Reimprimir</button>
            </div>
            <div class="detalle-seccion-titulo">PRODUCTOS</div>
            <table class="detalle-tabla-prods">
                <thead><tr><th>Producto</th><th>Cant</th><th>P/U</th><th>Total</th></tr></thead>
                <tbody>${productosHTML}</tbody>
            </table>
            <div class="detalle-seccion-titulo">TOTALES</div>
            <div class="detalle-totales">
                <div class="detalle-pago-row"><span>Total Bs:</span><b>Bs ${v.totalBolivares.toFixed(2)}</b></div>
                <div class="detalle-pago-row"><span>Total $:</span><b>$${v.totalDolares.toFixed(2)}</b></div>
                <div class="detalle-pago-row"><span>Tasa:</span><b>Bs ${v.precioDolarUsado.toFixed(2)}</b></div>
            </div>
            <div class="detalle-seccion-titulo">PAGOS</div>
            <div class="detalle-pagos">${pagosHTML}</div>
        </div>`;
}

function reimprimirTicket(index) {
    const v = window._ventasHoyModal[index];
    if (!v) return;

    // Crear contenedor temporal si no existe (cuando se llama desde index.html)
    let cont = document.getElementById('ticket-impresion');
    let contCreado = false;
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'ticket-impresion';
        cont.className = 'ticket-oculto';
        document.body.appendChild(cont);
        contCreado = true;
    }

    // Reutilizar exactamente la misma función que usa el POS al cobrar e imprimir
    generarTicketHTML(v);

    setTimeout(() => {
        window.print();
        setTimeout(() => {
            if (contCreado) {
                cont.remove();
            } else {
                cont.innerHTML = '';
            }
        }, 500);
    }, 300);
}

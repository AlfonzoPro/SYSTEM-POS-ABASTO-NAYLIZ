// ==========================================
// VARIABLES GLOBALES
// ==========================================
let tasaDolar = 36.50;
let inventario = [];
let carrito = [];
let ventasDelDia = [];
let productoEnEdicion = null; // Para el modal de modificación
let indiceSeleccionado = -1; // Para navegación con teclado
let productosPOS = [];
let productoEnCantidad = null; // Para el modal de cantidad
let pagosAgregados = []; // Para el sistema de pagos mixtos
let totalVentaActual = 0; // Total de la venta actual en USD
let indiceCarritoEdicion = -1; // Nueva variable global

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarConfiguracion();
    
    // Si estamos en la página POS
    if (document.body.classList.contains('pos-fullpage')) {
        await cargarInventario();
        actualizarInterfazCarrito();
        actualizarTasaEnPOS();
    }
    // Si estamos en la página principal
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
        
        // Actualizar display en sidebar
        const displayTasa = document.getElementById('tasaDolarDisplay');
        if (displayTasa) displayTasa.textContent = tasaDolar.toFixed(2);
        
        // Actualizar en POS si está abierto
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
        
        // Filtrar ventas del día actual
        const hoy = new Date().toDateString();
        ventasDelDia = todasLasVentas.filter(v => {
            const fechaVenta = new Date(v.fecha).toDateString();
            return fechaVenta === hoy;
        });
        
        // Actualizar contador de facturas
        const facturasHoy = document.getElementById('facturasHoy');
        if (facturasHoy) facturasHoy.textContent = ventasDelDia.length;
    } catch (e) {
        console.error("Error cargando ventas del día", e);
    }
}

function actualizarResumenDelDia() {
    let efectivoSoloDolares = 0;   // Monto de pagos EFECTIVO_USD
    let efectivoSoloBolivares = 0; // Monto de pagos EFECTIVO_BS
    let totalBiopago = 0;
    let totalPuntoVenta = 0;
    let totalPagoMovil = 0;
    let totalNotaCredito = 0;
    
    ventasDelDia.forEach(venta => {
        if (venta.mediosPago && Array.isArray(venta.mediosPago)) {
            venta.mediosPago.forEach(pago => {
                switch(pago.metodo) {
                    case 'EFECTIVO_USD':
                        efectivoSoloDolares += pago.montoUSD;
                        break;
                    case 'EFECTIVO_BS':
                        // Aquí sumamos los Bolívares reales registrados
                        efectivoSoloBolivares += (pago.montoBs || (pago.montoUSD * venta.precioDolarUsado));
                        break;
                    case 'BIOPAGO':
                        totalBiopago += pago.montoUSD;
                        break;
                    case 'PUNTO_VENTA':
                        totalPuntoVenta += pago.montoUSD;
                        break;
                    case 'PAGO_MOVIL':
                    case 'TRANSFERENCIA':
                        totalPagoMovil += pago.montoUSD;
                        break;
                    case 'NOTA_CREDITO':
                        totalNotaCredito += pago.montoUSD;
                        break;
                }
            });
        }
    });
    
    // Calcular total general convertido a dólares para el balance
    const totalGeneralUSD = efectivoSoloDolares + (efectivoSoloBolivares / tasaDolar) + 
                          totalBiopago + totalPuntoVenta + totalPagoMovil + totalNotaCredito;

    // Mostrar en pantalla
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
function abrirPOS() {
    window.location.href = 'pos.html';
}

function volverAlMenu() {
    window.location.href = 'index.html';
}

// Gestor de plantillas para inventario (se carga dentro del index)
async function cargarPlantilla(nombre) {
    if (nombre === 'pos') {
        // Redirigir a la página completa de POS
        abrirPOS();
        return;
    }
    
    const contenedor = document.getElementById('contenedor-dinamico');
    
    try {
        const respuesta = await fetch(`${nombre}.html`);
        if (!respuesta.ok) throw new Error("No se pudo encontrar la plantilla");
        
        const html = await respuesta.text();
        contenedor.innerHTML = html;

        if (nombre === 'inventario') {
            await cargarInventario();
            renderizarTablaInventario();
        }
    } catch (error) {
        contenedor.innerHTML = `<div class="error">Error al cargar el módulo: ${nombre}</div>`;
        console.error(error);
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
        
        return `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td>$${(p.precioCosto || 0).toFixed(2)}</td>
            <td>$${p.precioVenta.toFixed(2)}</td>
            <td>$${ganancia.toFixed(2)}</td>
            <td>${gananciaPorcentaje.toFixed(1)}%</td>
            <td>
                <button class="btn-modificar" onclick="abrirModalModificar(${p.codigo})">
                    ✏️ Modificar
                </button>
            </td>
        </tr>
    `}).join('');
}

function filtrarInventario(valor) {
    const tbody = document.querySelector('#listaProductos');
    if (!tbody) return;
    
    if (!valor) {
        // Si no hay búsqueda, mostrar mensaje
        tbody.innerHTML = '<tr><td colspan="7" class="sin-productos">Usa el buscador para encontrar productos</td></tr>';
        return;
    }
    
    const valorUpper = valor.toUpperCase();
    const filtrado = inventario
        .filter(p => 
            p.nombre.toUpperCase().startsWith(valorUpper) ||
            p.codigo.toString().startsWith(valor)
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    if (filtrado.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="sin-productos">No se encontraron productos</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtrado.map(p => {
        const ganancia = p.precioVenta - (p.precioCosto || 0);
        const gananciaPorcentaje = p.precioCosto ? ((ganancia / p.precioCosto) * 100) : 0;
        
        return `
        <tr>
            <td>${p.codigo}</td>
            <td>${p.nombre}</td>
            <td>$${(p.precioCosto || 0).toFixed(2)}</td>
            <td>$${p.precioVenta.toFixed(2)}</td>
            <td>$${ganancia.toFixed(2)}</td>
            <td>${gananciaPorcentaje.toFixed(1)}%</td>
            <td>
                <button class="btn-modificar" onclick="abrirModalModificar(${p.codigo})">
                    ✏️ Modificar
                </button>
            </td>
        </tr>
    `}).join('');
}

async function guardarEnInventario(e) {
    e.preventDefault();
    const nombre = document.getElementById('inv-nombre').value.toUpperCase();
    const costo = parseFloat(document.getElementById('inv-costo').value);
    const precio = parseFloat(document.getElementById('inv-precio').value);

    if (precio <= costo) {
        if (!confirm("El precio de venta es menor o igual al costo. ¿Desea continuar?")) {
            return;
        }
    }

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
    
    // Limpiar búsqueda y mantener tabla vacía
    const buscarInput = document.getElementById('buscarProducto');
    if (buscarInput) buscarInput.value = '';
    
    renderizarTablaInventario(false); // false = no mostrar todos
    alert('Producto agregado correctamente');
}

// ==========================================
// MODAL DE MODIFICACIÓN
// ==========================================
function abrirModalModificar(codigo) {
    const producto = inventario.find(p => p.codigo === codigo);
    if (!producto) return;
    
    productoEnEdicion = producto;
    
    // Llenar los campos del modal
    document.getElementById('mod-codigo').value = producto.codigo;
    document.getElementById('mod-nombre').value = producto.nombre;
    document.getElementById('mod-costo').value = (producto.precioCosto || 0).toFixed(2);
    document.getElementById('mod-precio').value = producto.precioVenta.toFixed(2);
    
    // Calcular y mostrar ganancia
    actualizarGananciaModal();
    
    // Agregar listeners para actualizar ganancia en tiempo real
    document.getElementById('mod-costo').addEventListener('input', actualizarGananciaModal);
    document.getElementById('mod-precio').addEventListener('input', actualizarGananciaModal);
    
    // Mostrar modal
    document.getElementById('modalModificar').style.display = 'flex';
}

function actualizarGananciaModal() {
    const costo = parseFloat(document.getElementById('mod-costo').value) || 0;
    const precio = parseFloat(document.getElementById('mod-precio').value) || 0;
    
    const ganancia = precio - costo;
    const gananciaPorcentaje = costo > 0 ? ((ganancia / costo) * 100) : 0;
    
    document.getElementById('mod-ganancia-valor').textContent = `$${ganancia.toFixed(2)}`;
    document.getElementById('mod-ganancia-porcentaje').textContent = `${gananciaPorcentaje.toFixed(1)}%`;
    
    // Colorear según la ganancia
    const valorElemento = document.getElementById('mod-ganancia-valor');
    if (ganancia < 0) {
        valorElemento.style.color = '#f44336';
    } else if (ganancia === 0) {
        valorElemento.style.color = '#ff9800';
    } else {
        valorElemento.style.color = '#4caf50';
    }
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
    
    if (!nombre || isNaN(costo) || isNaN(precio)) {
        alert('Por favor complete todos los campos correctamente');
        return;
    }
    
    if (precio <= costo) {
        if (!confirm("El precio de venta es menor o igual al costo. ¿Desea continuar?")) {
            return;
        }
    }
    
    // Actualizar el producto
    const index = inventario.findIndex(p => p.codigo === productoEnEdicion.codigo);
    if (index !== -1) {
        inventario[index].nombre = nombre;
        inventario[index].precioCosto = costo;
        inventario[index].precioVenta = precio;
        
        await fetch('/api/inventario', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(inventario)
        });
        
        renderizarTablaInventario();
        cerrarModalModificar();
        alert('Producto modificado correctamente');
    }
}

async function eliminarProductoDesdeModal() {
    if (!productoEnEdicion) return;
    
    if (!confirm(`¿Está seguro de eliminar el producto "${productoEnEdicion.nombre}"?`)) {
        return;
    }
    
    inventario = inventario.filter(p => p.codigo !== productoEnEdicion.codigo);
    
    await fetch('/api/inventario', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(inventario)
    });
    
    renderizarTablaInventario();
    cerrarModalModificar();
    alert('Producto eliminado correctamente');
}

// ==========================================
// LÓGICA DEL PUNTO DE VENTA (POS)
// ==========================================
function buscarEnPOS(valor) {
    const divResultados = document.getElementById('resultados-busqueda');
    if (!divResultados) return;
    
    indiceSeleccionado = -1; // Resetear índice
    
    if (!valor) { 
        divResultados.innerHTML = '<div class="no-products">Busca un producto para agregar a la venta</div>'; 
        return; 
    }

    // Filtrar productos que empiecen con el texto buscado (orden alfabético)
    const valorUpper = valor.toUpperCase();
    const filtrados = inventario
        .filter(p => 
            p.nombre.toUpperCase().startsWith(valorUpper) ||
            p.codigo.toString().startsWith(valor)
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .slice(0, 10);

    if (filtrados.length === 0) {
        divResultados.innerHTML = '<div class="no-products">No se encontraron productos</div>';
        return;
    }

    divResultados.innerHTML = filtrados.map(p => `
        <div class="resultado-item" onclick="abrirModalCantidad(${p.codigo})">
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

function agregarAlCarrito(codigo) {
    const prod = inventario.find(p => p.codigo === codigo);
    if (!prod) return;
    
    const itemEnCarrito = carrito.find(c => c.codigo === codigo);

    if (itemEnCarrito) {
        itemEnCarrito.cantidad++;
    } else {
        carrito.push({ ...prod, cantidad: 1 });
    }

    const buscarInput = document.getElementById('buscarProductoPOS');
    if (buscarInput) buscarInput.value = '';
    
    const resultados = document.getElementById('resultados-busqueda');
    if (resultados) resultados.innerHTML = '<div class="no-products">Busca un producto para agregar a la venta</div>';
    
    actualizarInterfazCarrito();
}

function actualizarInterfazCarrito() {
    const tbody = document.querySelector('#carritoProductos');
    if (!tbody) return;

    if (carrito.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="carrito-vacio">No hay productos en el carrito</td></tr>';
        document.getElementById('total-usd').textContent = '$0.00';
        document.getElementById('total-bs').textContent = 'Bs 0.00';
        return;
    }

    let totalUsd = 0;

    tbody.innerHTML = carrito.map((item, index) => {
        const subtotalUsd = item.precioVenta * item.cantidad;
        const precioBs = item.precioVenta * tasaDolar;
        const subtotalBs = subtotalUsd * tasaDolar;
        totalUsd += subtotalUsd;
        
        return `
            <tr class="fila-carrito-clicable">
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})">${index + 1}</td>
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})">${item.codigo}</td>
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})">${item.nombre}</td>
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})" class="col-cantidad-fija">
                    <span class="badge-cantidad">${item.cantidad}</span>
                </td>
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})">$${item.precioVenta.toFixed(2)}</td>
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})">Bs ${precioBs.toFixed(2)}</td>
                <td onclick="abrirModalCantidad(${item.codigo}, ${index})">Bs ${subtotalBs.toFixed(2)}</td>
                <td>
                    <button class="btn-eliminar-item" onclick="quitarDelCarrito(${index})">
                        ❌
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('total-usd').textContent = `$${totalUsd.toFixed(2)}`;
    document.getElementById('total-bs').textContent = `Bs ${(totalUsd * tasaDolar).toFixed(2)}`;
}

function cambiarCantidad(index, valor) {
    const cantidad = parseInt(valor);
    if (cantidad < 1) return;
    carrito[index].cantidad = cantidad;
    actualizarInterfazCarrito();
}

function quitarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarInterfazCarrito();
}

function limpiarCarrito() {
    if (carrito.length === 0) return;
    if (!confirm("¿Limpiar todos los productos del carrito?")) return;
    carrito = [];
    actualizarInterfazCarrito();
}

async function actualizarTasa(valor) {
    tasaDolar = parseFloat(valor) || 0;
    await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ precioDolar: tasaDolar })
    });
    
    // Actualizar displays
    const displayTasa = document.getElementById('tasaDolarDisplay');
    if (displayTasa) displayTasa.textContent = tasaDolar.toFixed(2);
    
    const tasaPOS = document.getElementById('tasaDolarPOS');
    if (tasaPOS) tasaPOS.textContent = `Bs ${tasaDolar.toFixed(2)}`;
    
    // Actualizar totales en el carrito
    actualizarInterfazCarrito();
    
    // Actualizar tabla de inventario si está abierta
    if (document.getElementById('listaProductos')) {
        renderizarTablaInventario();
    }
}

async function procesarVenta() {
    if (carrito.length === 0) {
        alert("El carrito está vacío");
        return;
    }

    const totalUsd = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
    
    const nuevaVenta = {
        id: Date.now(),
        fecha: new Date(),
        productos: carrito,
        totalDolares: totalUsd,
        totalBolivares: totalUsd * tasaDolar,
        precioDolarUsado: tasaDolar
    };

    // Obtener ventas actuales y guardar la nueva
    const resVentas = await fetch('/api/ventas');
    const ventasExistentes = await resVentas.json();
    ventasExistentes.push(nuevaVenta);

    await fetch('/api/ventas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(ventasExistentes)
    });

    alert(`¡Venta realizada con éxito!\n\nTotal: $${totalUsd.toFixed(2)} / Bs ${(totalUsd * tasaDolar).toFixed(2)}`);
    
    carrito = [];
    actualizarInterfazCarrito();
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================
function editarTasaDolar() {
    const nuevoValor = prompt("Ingrese la nueva tasa del dólar (Bs/$):", tasaDolar);
    if (nuevoValor && !isNaN(nuevoValor)) {
        const input = document.getElementById('tasa-input');
        if (input) {
            input.value = nuevoValor;
            actualizarTasa(nuevoValor);
        }
    }
}

function abrirBuscadorFechas() {
    alert("Funcionalidad de búsqueda por fechas en desarrollo");
}

// ==========================================
// MODAL DE TASA DEL DÓLAR
// ==========================================
function abrirModalTasa() {
    const modal = document.getElementById('modalEditarTasa');
    const tasaActual = document.getElementById('tasaActualModal');
    const inputTasa = document.getElementById('inputNuevaTasa');
    
    if (tasaActual) tasaActual.textContent = `Bs ${tasaDolar.toFixed(2)}`;
    if (inputTasa) {
        inputTasa.value = tasaDolar.toFixed(2);
        modal.style.display = 'flex';
        setTimeout(() => inputTasa.focus(), 100);
        
        // Permitir confirmar con Enter
        inputTasa.onkeydown = (e) => {
            if (e.key === 'Enter') guardarNuevaTasa();
            if (e.key === 'Escape') cerrarModalTasa();
        };
    }
}

function cerrarModalTasa() {
    const modal = document.getElementById('modalEditarTasa');
    if (modal) modal.style.display = 'none';
}

async function guardarNuevaTasa() {
    const inputTasa = document.getElementById('inputNuevaTasa');
    const nuevaTasa = parseFloat(inputTasa.value);
    
    if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
        alert('Por favor ingrese una tasa válida');
        return;
    }
    
    tasaDolar = nuevaTasa;
    
    // Guardar en el servidor
    await fetch('/api/config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ precioDolar: tasaDolar })
    });
    
    // Actualizar todos los displays
    const displayTasa = document.getElementById('tasaDolarDisplay');
    if (displayTasa) displayTasa.textContent = tasaDolar.toFixed(2);
    
    const tasaPOS = document.getElementById('tasaDolarPOS');
    if (tasaPOS) tasaPOS.textContent = `Bs ${tasaDolar.toFixed(2)}`;
    
    // Actualizar totales y tablas
    actualizarInterfazCarrito();
    if (document.getElementById('listaProductos')) {
        renderizarTablaInventario();
    }
    
    cerrarModalTasa();
}

// ==========================================
// NAVEGACIÓN CON TECLADO EN BÚSQUEDA POS
// ==========================================
function manejarTeclasBusqueda(event) {
    const resultados = document.querySelectorAll('.resultado-item');
    
    if (resultados.length === 0) return;
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        indiceSeleccionado++;
        if (indiceSeleccionado >= resultados.length) indiceSeleccionado = 0;
        actualizarSeleccion(resultados);
    } 
    else if (event.key === 'ArrowUp') {
        event.preventDefault();
        indiceSeleccionado--;
        if (indiceSeleccionado < 0) indiceSeleccionado = resultados.length - 1;
        actualizarSeleccion(resultados);
    }
    else if (event.key === 'Enter') {
        event.preventDefault();
        if (indiceSeleccionado >= 0 && indiceSeleccionado < resultados.length) {
            resultados[indiceSeleccionado].click();
        }
    }
}

function actualizarSeleccion(resultados) {
    resultados.forEach((item, index) => {
        if (index === indiceSeleccionado) {
            item.classList.add('seleccionado');
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            item.classList.remove('seleccionado');
        }
    });
}

// ==========================================
// MODAL DE CANTIDAD DE PRODUCTO
// ==========================================
function abrirModalCantidad(codigo, indexEnCarrito = -1) {
    const producto = inventario.find(p => p.codigo === codigo);
    if (!producto) return;
    
    productoEnCantidad = producto;
    indiceCarritoEdicion = indexEnCarrito; // Guardamos si es una edición
    
    document.getElementById('nombreProductoCantidad').textContent = producto.nombre;
    document.getElementById('codigoProductoCantidad').textContent = `Cód: ${producto.codigo}`;
    document.getElementById('precioDolarCantidad').textContent = `$${producto.precioVenta.toFixed(2)}`;
    document.getElementById('precioBsCantidad').textContent = `Bs ${(producto.precioVenta * tasaDolar).toFixed(2)}`;
    
    // Si estamos editando, ponemos la cantidad que ya tiene el carrito
    const inputCantidad = document.getElementById('inputCantidadProducto');
    if (indiceCarritoEdicion > -1) {
        inputCantidad.value = carrito[indiceCarritoEdicion].cantidad;
    } else {
        inputCantidad.value = '1';
    }
    
    actualizarTotalCantidad();
    document.getElementById('modalCantidadProducto').style.display = 'flex';
    
    setTimeout(() => {
        inputCantidad.focus();
        inputCantidad.select();
    }, 100);

    inputCantidad.oninput = actualizarTotalCantidad;
    inputCantidad.onkeydown = (e) => {
        if (e.key === 'Enter') confirmarCantidadProducto();
        if (e.key === 'Escape') cancelarCantidadProducto();
    };
}

function actualizarTotalCantidad() {
    const cantidad = parseFloat(document.getElementById('inputCantidadProducto').value) || 0;
    
    if (productoEnCantidad) {
        const totalDolar = productoEnCantidad.precioVenta * cantidad;
        const totalBs = totalDolar * tasaDolar;
        
        document.getElementById('totalDolarCantidad').textContent = `$${totalDolar.toFixed(2)}`;
        document.getElementById('totalBsCantidad').textContent = `Bs ${totalBs.toFixed(2)}`;
    }
}

function confirmarCantidadProducto() {
    const cantidad = parseFloat(document.getElementById('inputCantidadProducto').value);
    
    if (!cantidad || cantidad <= 0) {
        alert('Por favor ingrese una cantidad válida');
        return;
    }
    
    if (!productoEnCantidad) return;
    
    if (indiceCarritoEdicion > -1) {
        // CASO 1: Estamos EDITANDO un producto que ya estaba en el carrito
        carrito[indiceCarritoEdicion].cantidad = cantidad;
    } else {
        // CASO 2: Estamos AGREGANDO uno nuevo desde el buscador
        const itemEnCarrito = carrito.find(c => c.codigo === productoEnCantidad.codigo);
        if (itemEnCarrito) {
            itemEnCarrito.cantidad += cantidad;
        } else {
            carrito.push({ ...productoEnCantidad, cantidad: cantidad });
        }
    }
    
    actualizarInterfazCarrito();
    cancelarCantidadProducto();
    
    // Limpiar buscador si veníamos de allí
    const buscarInput = document.getElementById('buscarProductoPOS');
    if (buscarInput) {
        buscarInput.value = '';
        buscarInput.focus();
    }
    const resultados = document.getElementById('resultados-busqueda');
    if (resultados) resultados.innerHTML = '<div class="no-products">Busca un producto para agregar a la venta</div>';
}

function cancelarCantidadProducto() {
    document.getElementById('modalCantidadProducto').style.display = 'none';
    productoEnCantidad = null;
    
    // Volver focus al buscador
    const buscarInput = document.getElementById('buscarProductoPOS');
    if (buscarInput) buscarInput.focus();
}

// ==========================================
// SISTEMA DE PAGOS MIXTOS
// ==========================================
function abrirModalPagos() {
    if (carrito.length === 0) {
        alert("El carrito está vacío");
        return;
    }
    
    totalVentaActual = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
    pagosAgregados = [];
    
    // Llenar montos de cabecera
    document.getElementById('totalVentaUSD').textContent = `$${totalVentaActual.toFixed(2)}`;
    document.getElementById('totalVentaBS').textContent = `Bs ${(totalVentaActual * tasaDolar).toFixed(2)}`;
    
    renderizarPagosAgregados();
    actualizarEstadoPagos();
    
    const modal = document.getElementById('modalPagosMixtos');
    modal.style.display = 'flex';

    // Seleccionamos el método por defecto (USD) y calculamos el monto
    const selectMetodo = document.getElementById('metodoPago');
    selectMetodo.value = 'EFECTIVO_USD';
    seleccionarMetodoPago('EFECTIVO_USD');

    // Foco automático al menú para poder usar flechas del teclado de una vez
    setTimeout(() => selectMetodo.focus(), 100);
}

function seleccionarMetodoPago(metodo) {
    const inputMonto = document.getElementById('montoPago');
    const labelMoneda = document.getElementById('labelMonedaInput');
    const selectMetodo = document.getElementById('metodoPago');

    selectMetodo.value = metodo;

    const totalPagadoUSD = pagosAgregados.reduce((sum, pago) => sum + pago.montoUSD, 0);
    const faltanteUSD = totalVentaActual - totalPagadoUSD;

    if (metodo === 'EFECTIVO_USD') {
        inputMonto.value = faltanteUSD > 0 ? faltanteUSD.toFixed(2) : "0.00";
        labelMoneda.textContent = "Monto en $:";
    } else {
        const faltanteBS = (faltanteUSD > 0 ? faltanteUSD : 0) * tasaDolar;
        inputMonto.value = faltanteBS.toFixed(2);
        labelMoneda.textContent = "Monto en Bs:";
    }

    inputMonto.focus();
    setTimeout(() => inputMonto.select(), 10);
}

// Escuchar teclas F4-F9 y Enter
window.addEventListener('keydown', (e) => {
    const modalPagos = document.getElementById('modalPagosMixtos');
    if (modalPagos && modalPagos.style.display === 'flex') {
        const atajos = {
            'F4': 'EFECTIVO_USD',
            'F5': 'EFECTIVO_BS',
            'F6': 'BIOPAGO',
            'F7': 'PUNTO_VENTA',
            'F8': 'PAGO_MOVIL',
            'F9': 'NOTA_CREDITO'
        };

        if (atajos[e.key]) {
            e.preventDefault();
            seleccionarMetodoPago(atajos[e.key]);
        }

        if (e.key === 'Enter') {
            // Si el foco está en el monto, agrega el pago
            if (document.activeElement.id === 'montoPago' || document.activeElement.id === 'metodoPago') {
                e.preventDefault();
                agregarMetodoPago();
            }
        }
    }
});

function cerrarModalPagos() {
    document.getElementById('modalPagosMixtos').style.display = 'none';
    pagosAgregados = [];
}

function agregarMetodoPago() {
    const metodo = document.getElementById('metodoPago').value;
    const monto = parseFloat(document.getElementById('montoPago').value);
    
    if (!monto || monto <= 0) {
        alert('Por favor ingrese un monto válido');
        return;
    }
    
    let montoUSD = 0;
    let montoBs = 0;
    let moneda = '';

    // LÓGICA INVERTIDA: Solo EFECTIVO_USD es Dólares. Todo lo demás es Bolívares.
    if (metodo === 'EFECTIVO_USD') {
        montoUSD = monto;
        montoBs = monto * tasaDolar;
        moneda = 'USD';
    } else {
        // BIOPAGO, PUNTO_VENTA, PAGO_MOVIL, EFECTIVO_BS, etc.
        montoBs = monto;
        montoUSD = monto / tasaDolar; // Convertimos el monto ingresado en Bs a su equivalente en USD
        moneda = 'Bs';
    }
    
    // Agregar al array de pagos
    pagosAgregados.push({
        metodo: metodo,
        monto: monto,      // El monto tal cual lo escribió el usuario
        montoUSD: montoUSD, // El valor real en dólares para cálculos internos
        montoBs: montoBs,   // El valor real en bolívares para cálculos internos
        moneda: moneda      // Para saber qué símbolo mostrar en la tabla ($ o Bs)
    });
    
    // Actualizar interfaz
    renderizarPagosAgregados();
    actualizarEstadoPagos();
    
    // Limpiar input y devolver el foco
    document.getElementById('montoPago').value = '';
    document.getElementById('montoPago').focus();
}

function renderizarPagosAgregados() {
    const tbody = document.getElementById('listaPagosAgregados');
    if (!tbody) return; // Seguridad
    
    if (pagosAgregados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="sin-pagos">No hay pagos registrados</td></tr>';
        return;
    }
    
    tbody.innerHTML = pagosAgregados.map((pago, index) => {
        const nombreMetodo = getNombreMetodo(pago.metodo);
        const simbolo = pago.moneda === 'Bs' ? 'Bs ' : '$';
        
        return `
            <tr>
                <td>${nombreMetodo}</td>
                <td>${simbolo}${pago.monto.toFixed(2)}</td>
                <td>
                    <button class="btn-eliminar-pago" onclick="eliminarPago(${index})">❌</button>
                </td>
            </tr>
        `;
    }).join('');
}

function getNombreMetodo(metodo) {
    const nombres = {
        'EFECTIVO_USD': '💵 Efectivo USD',
        'EFECTIVO_BS': '💵 Efectivo Bs',
        'BIOPAGO': '💳 Biopago',
        'PUNTO_VENTA': '💳 Punto de Venta',
        'PAGO_MOVIL': '📱 Pago Móvil',
        'TRANSFERENCIA': '🏦 Transferencia',
        'NOTA_CREDITO': '📄 Nota Crédito'
    };
    return nombres[metodo] || metodo;
}

function eliminarPago(index) {
    pagosAgregados.splice(index, 1);
    renderizarPagosAgregados();
    actualizarEstadoPagos();
}

function actualizarEstadoPagos() {
    // Calcular total pagado en USD y Bs
    const totalPagadoUSD = pagosAgregados.reduce((sum, pago) => sum + pago.montoUSD, 0);
    const totalPagadoBS = totalPagadoUSD * tasaDolar;
    
    // Calcular faltante
    const faltante = totalVentaActual - totalPagadoUSD;
    const faltanteBS = Math.abs(faltante) * tasaDolar;
    
    // Calcular cambio
    const cambio = totalPagadoUSD - totalVentaActual;
    const cambioBS = cambio * tasaDolar;
    
    // 1. Actualizar Total Pagado Unificado
    document.getElementById('totalPagado').textContent = `$${totalPagadoUSD.toFixed(2)} (Bs ${totalPagadoBS.toFixed(2)})`;
    
    // 2. Actualizar Faltante Unificado (si hay cambio, el faltante es 0)
    const faltanteMostrarUSD = faltante > 0 ? faltante : 0;
    const faltanteMostrarBS = faltante > 0 ? faltanteBS : 0;
    document.getElementById('faltantePago').textContent = `$${faltanteMostrarUSD.toFixed(2)} (Bs ${faltanteMostrarBS.toFixed(2)})`;
    
    // 3. Actualizar barra de progreso
    const barraProgreso = document.getElementById('barraProgresoPago');
    const porcentajePago = document.getElementById('porcentajePago');
    
    if (barraProgreso && porcentajePago) {
        let porcentaje = 0;
        if (totalVentaActual > 0) {
            porcentaje = Math.min((totalPagadoUSD / totalVentaActual) * 100, 100);
        }
        
        barraProgreso.style.width = `${porcentaje}%`;
        porcentajePago.textContent = `${porcentaje.toFixed(1)}%`;
        
        // Cambiar color según el progreso
        barraProgreso.classList.remove('parcial', 'completo');
        if (porcentaje >= 100) {
            barraProgreso.classList.add('completo');
            porcentajePago.style.color = '#4caf50';
        } else if (porcentaje > 0) {
            barraProgreso.classList.add('parcial');
            porcentajePago.style.color = '#ff9800';
        } else {
            porcentajePago.style.color = '#888';
        }
    }
    
    // 4. Mostrar/ocultar secciones según el estado (Cambio)
    const cambioSection = document.getElementById('cambioSection');
    const opcionesCambio = document.getElementById('opcionesCambio');
    const btnFinalizar = document.getElementById('btnFinalizarPago');
    
    if (cambio > 0.01) {
        // Hay cambio a devolver
        cambioSection.style.display = 'flex';
        opcionesCambio.style.display = 'block';
        
        // Mostrar cambio unificado
        document.getElementById('cambioPago').textContent = `$${cambio.toFixed(2)} (Bs ${cambioBS.toFixed(2)})`;
        
        // Validar si el desglose del cambio coincide con el cambio total
        const cambioInputUSD = parseFloat(document.getElementById('cambioUSD').value) || 0;
        const cambioInputBs = parseFloat(document.getElementById('cambioBS').value) || 0;
        const totalCambioEspecificado = cambioInputUSD + (cambioInputBs / tasaDolar);
        
        btnFinalizar.disabled = Math.abs(totalCambioEspecificado - cambio) > 0.01;
    } else {
        // No hay cambio
        cambioSection.style.display = 'none';
        opcionesCambio.style.display = 'none';
        
        // Habilitar botón si está completamente pagado
        btnFinalizar.disabled = faltante > 0.01;
    }
}

function calcularCambioBs() {
    const cambioUSD = parseFloat(document.getElementById('cambioUSD').value) || 0;
    const totalPagadoUSD = pagosAgregados.reduce((sum, pago) => sum + pago.montoUSD, 0);
    const cambioTotal = totalPagadoUSD - totalVentaActual;
    const cambioBs = (cambioTotal - cambioUSD) * tasaDolar;
    
    document.getElementById('cambioBS').value = cambioBs > 0 ? cambioBs.toFixed(2) : '0.00';
    actualizarEstadoPagos();
}

async function finalizarVentaConPagos() {
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
    
    // Preparar objeto de venta
    const nuevaVenta = {
        id: Date.now(),
        fecha: new Date(),
        productos: carrito,
        totalDolares: totalVentaActual,
        totalBolivares: totalVentaActual * tasaDolar,
        precioDolarUsado: tasaDolar,
        mediosPago: pagosAgregados,
        cambio: infoCambio
    };
    
    // Guardar venta
    const resVentas = await fetch('/api/ventas');
    const ventasExistentes = await resVentas.json();
    ventasExistentes.push(nuevaVenta);
    
    await fetch('/api/ventas', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(ventasExistentes)
    });
    
    // Mensaje de confirmación
    let mensaje = `¡Venta realizada con éxito!\n\nTotal: $${totalVentaActual.toFixed(2)} / Bs ${(totalVentaActual * tasaDolar).toFixed(2)}`;
    
    if (infoCambio) {
        mensaje += `\n\nCambio:`;
        if (infoCambio.cambioUSD > 0) mensaje += `\nEfectivo USD: $${infoCambio.cambioUSD.toFixed(2)}`;
        if (infoCambio.cambioBs > 0) mensaje += `\nEfectivo Bs: Bs ${infoCambio.cambioBs.toFixed(2)}`;
    }
    
    alert(mensaje);
    
    // Limpiar todo
    carrito = [];
    pagosAgregados = [];
    actualizarInterfazCarrito();
    cerrarModalPagos();
}

// Cambiar el texto de ayuda según el método de pago seleccionado
document.getElementById('metodoPago').addEventListener('change', function(e) {
    const inputMonto = document.getElementById('montoPago');
    if (e.target.value === 'EFECTIVO_USD') {
        inputMonto.placeholder = "Monto en $";
    } else {
        inputMonto.placeholder = "Monto en Bolívares (Bs)";
    }
});

// --- LÓGICA DE TECLADO PARA EL MODAL DE PAGOS ---
window.addEventListener('keydown', (e) => {
    const modalPagos = document.getElementById('modalPagosMixtos');
    if (modalPagos.style.display === 'flex') {
        // Mapeo de teclas F a métodos
        const atajos = {
            'F4': 'EFECTIVO_USD',
            'F5': 'EFECTIVO_BS',
            'F6': 'BIOPAGO',
            'F7': 'PUNTO_VENTA',
            'F8': 'PAGO_MOVIL',
            'F9': 'NOTA_CREDITO'
        };

        if (atajos[e.key]) {
            e.preventDefault();
            seleccionarMetodoPago(atajos[e.key]);
        }

        // Si presiona Enter dentro del input de monto, agrega el pago
        if (e.key === 'Enter' && document.activeElement.id === 'montoPago') {
            agregarMetodoPago();
        }
    }
});


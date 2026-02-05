// ==========================================
// VARIABLES GLOBALES
// ==========================================
let tasaDolar = 36.50;
let inventario = [];
let carrito = [];
let ventasDelDia = [];
let productoEnEdicion = null; // Para el modal de modificación

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
        const inputTasa = document.getElementById('tasa-input');
        if (inputTasa) inputTasa.value = tasaDolar;
        
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
    let totalEfectivoDolares = 0;
    
    ventasDelDia.forEach(venta => {
        totalEfectivoDolares += venta.totalDolares || 0;
    });
    
    const efectivoDolares = document.getElementById('efectivoDolares');
    const efectivoBolivares = document.getElementById('efectivoBolivares');
    const totalPagos = document.getElementById('totalPagos');
    
    if (efectivoDolares) efectivoDolares.textContent = `$${totalEfectivoDolares.toFixed(2)}`;
    if (efectivoBolivares) efectivoBolivares.textContent = `Bs ${(totalEfectivoDolares * tasaDolar).toFixed(2)}`;
    if (totalPagos) totalPagos.textContent = `Bs ${(totalEfectivoDolares * tasaDolar).toFixed(2)}`;
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

function renderizarTablaInventario() {
    const tbody = document.querySelector('#listaProductos');
    if (!tbody) return;

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
    
    const filtrado = inventario.filter(p => 
        p.nombre.toLowerCase().includes(valor.toLowerCase()) ||
        p.codigo.toString().includes(valor)
    );
    
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
    renderizarTablaInventario();
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
    
    if (!valor) { 
        divResultados.innerHTML = '<div class="no-products">Busca un producto para agregar a la venta</div>'; 
        return; 
    }

    const filtrados = inventario.filter(p => 
        p.nombre.toLowerCase().includes(valor.toLowerCase()) ||
        p.codigo.toString().includes(valor)
    ).slice(0, 10);

    if (filtrados.length === 0) {
        divResultados.innerHTML = '<div class="no-products">No se encontraron productos</div>';
        return;
    }

    divResultados.innerHTML = filtrados.map(p => `
        <div class="resultado-item" onclick="agregarAlCarrito(${p.codigo})">
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
            <tr>
                <td>${index + 1}</td>
                <td>${item.codigo}</td>
                <td>${item.nombre}</td>
                <td>
                    <input type="number" value="${item.cantidad}" min="1" 
                           class="input-cantidad-carrito"
                           onchange="cambiarCantidad(${index}, this.value)">
                </td>
                <td>$${item.precioVenta.toFixed(2)}</td>
                <td>Bs ${precioBs.toFixed(2)}</td>
                <td>Bs ${subtotalBs.toFixed(2)}</td>
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

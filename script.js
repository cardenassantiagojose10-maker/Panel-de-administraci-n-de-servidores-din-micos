const API_BASE = 'http://127.0.0.1:8000';

const el = {
  apiDot: document.getElementById('api-dot'),
  apiText: document.getElementById('api-text'),
  themeToggle: document.getElementById('theme-toggle'),
  statTotal: document.getElementById('stat-total'),
  statConfigurados: document.getElementById('stat-configurados'),
  statConfiguradosFoot: document.getElementById('stat-configurados-foot'),
  statUltimo: document.getElementById('stat-ultimo'),
  statUltimoFoot: document.getElementById('stat-ultimo-foot'),
  tablaServidores: document.getElementById('tabla-servidores'),
  btnActualizar: document.getElementById('btn-actualizar'),
  btnSolicitar: document.getElementById('btn-solicitar'),
  resultadoSolicitud: document.getElementById('resultado-solicitud'),
  statBarTotal: document.getElementById('stat-bar-total'),
  barrasServidores: document.getElementById('barras-servidores'),
  logMensajes: document.getElementById('log-mensajes'),
};

function formatearNumero(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function horaActual() {
  return new Date().toLocaleTimeString('es-CO', { hour12: false });
}

function agregarMensaje(tipo, titulo, detalle) {
  const claseMap = { ok: 'nx-alert--ok', warn: 'nx-alert--warn', error: 'nx-alert--error', info: '' };
  const iconoMap = { ok: '✓', warn: '!', error: '×', info: 'i' };
  const div = document.createElement('div');
  div.className = `nx-alert ${claseMap[tipo] || ''}`.trim();
  div.innerHTML = `<span class="nx-alert__icon">${iconoMap[tipo] || 'i'}</span><div><span class="nx-alert__title">${titulo}</span> ${detalle}</div><span class="nx-alert__time">${horaActual()}</span>`;
  el.logMensajes.prepend(div);
  while (el.logMensajes.children.length > 8) {
    el.logMensajes.removeChild(el.logMensajes.lastChild);
  }
}

function marcarApiConectada(conectada) {
  el.apiDot.classList.toggle('nx-dot--on', conectada);
  el.apiDot.classList.toggle('nx-dot--live', conectada);
  el.apiDot.classList.toggle('nx-dot--off', !conectada);
  el.apiText.textContent = conectada ? 'conectada' : 'desconectada';
}

let firmaEstadoServidores = null;
let apiReportadaCaida = false;
let ultimosConteos = null;

function reportarEstadoServidores(servidores, forzar) {
  const firma = servidores.map((s) => `${s.nombre}:${s.estado}`).join('|');
  if (!forzar && firma === firmaEstadoServidores) return;
  firmaEstadoServidores = firma;

  if (!servidores.length) {
    agregarMensaje('warn', 'No hay servidores configurados.', 'El balanceador no tiene servidores en su lista.');
    return;
  }

  const activos = servidores.filter((s) => s.estado === 'activo');
  const inactivos = servidores.filter((s) => s.estado !== 'activo');
  const listaInactivos = inactivos.map((s) => `${s.nombre} (:${s.puerto})`).join(', ');

  if (!inactivos.length) {
    agregarMensaje('ok', 'Todos los servidores están en línea.', `${activos.length} de ${servidores.length} activos: ${activos.map((s) => `:${s.puerto}`).join(', ')}.`);
  } else if (!activos.length) {
    agregarMensaje('error', 'Ningún servidor está en línea.', `Sin respuesta de: ${listaInactivos}.`);
  } else {
    agregarMensaje('warn', 'Hay servidores fuera de línea.', `${activos.length} de ${servidores.length} activos · sin respuesta: ${listaInactivos}.`);
  }
}

function renderTablaServidores(servidores, conteos) {
  if (!servidores.length) {
    el.tablaServidores.innerHTML = '<tr><td colspan="4" class="nx-empty">No hay servidores configurados.</td></tr>';
    el.statConfigurados.textContent = '0';
    el.statConfiguradosFoot.textContent = 'Sin servidores';
    return;
  }

  const mapaConteos = conteos || {};
  el.tablaServidores.innerHTML = servidores.map((s) => {
    const activo = s.estado === 'activo';
    const solicitudes = mapaConteos[s.nombre] ?? '—';
    return `
      <tr class="${activo ? '' : 'is-off'}">
        <td>${s.nombre}</td>
        <td class="nx-port">:<b>${s.puerto}</b></td>
        <td><span class="nx-status ${activo ? 'nx-status--on' : 'nx-status--off'}"><span class="nx-dot ${activo ? 'nx-dot--on' : 'nx-dot--off'}"></span>${activo ? 'Activo' : 'Inactivo'}</span></td>
        <td class="num nx-mono">${solicitudes}</td>
      </tr>`;
  }).join('');

  const activos = servidores.filter((s) => s.estado === 'activo').length;
  const inactivos = servidores.length - activos;
  el.statConfigurados.textContent = servidores.length;
  el.statConfiguradosFoot.textContent = `${activos} activo${activos === 1 ? '' : 's'} · ${inactivos} inactivo${inactivos === 1 ? '' : 's'}`;
}

function renderEstadisticas(data) {
  el.statTotal.textContent = formatearNumero(data.total_solicitudes);
  el.statBarTotal.textContent = `Total ${formatearNumero(data.total_solicitudes)}`;

  if (data.ultimo_servidor) {
    el.statUltimo.textContent = data.ultimo_servidor.servidor.replace('Servidor ', 'S‑');
    el.statUltimoFoot.textContent = `Puerto ${data.ultimo_servidor.puerto}`;
  } else {
    el.statUltimo.textContent = '—';
    el.statUltimoFoot.textContent = 'Aún sin solicitudes';
  }

  if (!data.por_servidor.length) {
    el.barrasServidores.innerHTML = '<span class="nx-empty">No hay servidores configurados.</span>';
    return;
  }

  el.barrasServidores.innerHTML = data.por_servidor.map((s) => `
    <div class="nx-bar${data.total_solicitudes === 0 ? ' is-off' : ''}">
      <span class="nx-bar__name">${s.servidor}<small>:${s.puerto}</small></span>
      <div class="nx-bar__track"><div class="nx-bar__fill" style="width:${s.porcentaje}%"></div></div>
      <span class="nx-bar__count">${s.solicitudes} <span>${s.porcentaje}%</span></span>
    </div>`).join('');
}

async function cargarServidores(forzarReporte) {
  try {
    const res = await fetch(`${API_BASE}/servidores`);
    if (!res.ok) throw new Error('estado ' + res.status);
    const data = await res.json();
    marcarApiConectada(true);
    apiReportadaCaida = false;
    const servidores = data.Servidores || [];
    renderTablaServidores(servidores, ultimosConteos);
    reportarEstadoServidores(servidores, forzarReporte);
    return data;
  } catch (err) {
    marcarApiConectada(false);
    firmaEstadoServidores = null;
    el.tablaServidores.innerHTML = '<tr><td colspan="4" class="nx-empty">No se pudo cargar el listado de servidores.</td></tr>';
    if (!apiReportadaCaida || forzarReporte) {
      apiReportadaCaida = true;
      agregarMensaje('error', 'La API no responde.', 'Verifica que el balanceador esté en ejecución.');
    }
    return null;
  }
}

async function cargarEstadisticas() {
  try {
    const res = await fetch(`${API_BASE}/estadisticas`);
    if (!res.ok) throw new Error('estado ' + res.status);
    const data = await res.json();
    renderEstadisticas(data);
    const conteos = data.por_servidor.reduce((acc, s) => {
      acc[s.servidor] = s.solicitudes;
      return acc;
    }, {});
    ultimosConteos = conteos;
    return { data, conteos };
  } catch (err) {
    el.barrasServidores.innerHTML = '<span class="nx-empty">No se pudieron cargar las estadísticas.</span>';
    el.statTotal.textContent = '—';
    el.statBarTotal.textContent = 'Total —';
    agregarMensaje('error', 'No se pueden consultar las estadísticas.', 'Verifica el endpoint /estadisticas del balanceador.');
    return null;
  }
}

async function actualizarTodo(forzarReporte) {
  const servidoresData = await cargarServidores(forzarReporte);
  const stats = await cargarEstadisticas();
  if (servidoresData && stats) {
    renderTablaServidores(servidoresData.Servidores || [], stats.conteos);
  }
}

function renderResultadoSolicitud(data, status) {
  const numero = data.servidor.replace(/\D/g, '');
  const hora = horaActual();
  el.resultadoSolicitud.innerHTML = `
    <div class="nx-result nx-result--fresh">
      <div class="nx-result__top">
        <div><span class="nx-label">Atendida por</span><p class="nx-result__server">Servidor <span>${numero}</span></p></div>
        <div class="nx-result__meta">puerto ${data.puerto}<br>${status} OK<br><b>${hora}</b></div>
      </div>
      <pre class="nx-code">{ <span class="k">"servidor"</span>: <span class="s">"${data.servidor}"</span>, <span class="k">"puerto"</span>: <span class="n">${data.puerto}</span>, <span class="k">"mensaje"</span>: <span class="s">"${data.mensaje}"</span> }</pre>
    </div>`;
}

async function enviarSolicitud() {
  el.btnSolicitar.disabled = true;
  el.btnSolicitar.classList.add('is-loading');
  const textoOriginal = el.btnSolicitar.innerHTML;
  el.btnSolicitar.innerHTML = '<span class="nx-spin"></span>Enviando…';

  try {
    const res = await fetch(`${API_BASE}/solicitar`);
    const data = await res.json();
    marcarApiConectada(true);

    if (res.status === 503) {
      agregarMensaje('warn', 'No hay servidores disponibles.', data.detail || 'El balanceador no encontró servidores activos.');
      return;
    }

    if (!res.ok) {
      agregarMensaje('error', 'Ocurre un error durante la petición.', data.detail || `El balanceador respondió con estado ${res.status}.`);
      return;
    }

    renderResultadoSolicitud(data, res.status);
    agregarMensaje('ok', 'Solicitud procesada.', `Atendida por ${data.servidor}.`);
    await actualizarTodo();
  } catch (err) {
    marcarApiConectada(false);
    agregarMensaje('error', 'La API no responde.', 'Verifica que el balanceador esté en ejecución.');
  } finally {
    el.btnSolicitar.disabled = false;
    el.btnSolicitar.classList.remove('is-loading');
    el.btnSolicitar.innerHTML = textoOriginal;
  }
}

function alternarTema() {
  const actual = document.documentElement.getAttribute('data-theme');
  const siguiente = actual === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', siguiente);
  el.themeToggle.textContent = siguiente === 'light' ? 'Tema oscuro' : 'Tema claro';
  try { localStorage.setItem('nx-theme', siguiente); } catch (ignorado) {}
}

function iniciarTema() {
  let guardado = null;
  try { guardado = localStorage.getItem('nx-theme'); } catch (ignorado) {}
  const tema = guardado === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', tema);
  el.themeToggle.textContent = tema === 'light' ? 'Tema oscuro' : 'Tema claro';
}

el.btnActualizar.addEventListener('click', () => {
  actualizarTodo(true);
});
el.btnSolicitar.addEventListener('click', enviarSolicitud);
el.themeToggle.addEventListener('click', alternarTema);

iniciarTema();
actualizarTodo(true);

// Vigila el estado de los servidores y solo avisa cuando cambia.
setInterval(() => cargarServidores(false), 5000);

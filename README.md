# Mis Gastos — PWA de control de gastos

Aplicación web progresiva (PWA) mobile-first para llevar el control de gastos
fijos, temporales, variables e ingresos, con proyección automática de meses
futuros y exportación/importación de datos.

## Características

- **Mobile first**: diseño táctil optimizado para teléfonos, con bottom nav,
  modales tipo bottom-sheet y FAB para añadir.
- **Funciona offline**: Service Worker que cachea la app entera. Se puede
  instalar como aplicación nativa (Android/iOS/desktop).
- **LocalStorage**: todos los datos viven en tu navegador, no se envía nada
  a ningún servidor.
- **Exportar / Importar JSON**: mueve tus datos entre dispositivos o haz
  copia de seguridad con un clic.
- **Tipos de gasto / ingreso**:
  - **Fijo**: se repite cada mes (ej. alquiler, Netflix).
  - **Temporal**: tiene fecha de inicio y fin (ej. un crédito que acaba en
    octubre, una prueba de IA de 3 meses).
  - **Variable / Puntual**: aparece solo en un mes concreto (ej. una cena
    especial, un ingreso extra inesperado).
- **Proyección mensual automática**: un crédito que termina en octubre ya
  no aparece en noviembre. Una suscripción temporal de 3 meses desaparece
  sola cuando termina. La línea de tiempo muestra el balance previsto para
  los próximos 12 meses.
- **Modo oscuro**: automático, claro u oscuro a elección.
- **Multi-moneda**: €, $, £, etc.

## Estructura del proyecto

```
gastos-pwa/
├── index.html              # Estructura HTML
├── manifest.json           # Manifiesto PWA
├── service-worker.js       # Service Worker (offline + caché)
├── css/
│   └── styles.css          # Estilos mobile-first
├── js/
│   ├── models.js           # Modelo de datos + motor de proyección
│   ├── storage.js          # LocalStorage + Import/Export
│   └── app.js              # Lógica de UI
├── icons/                  # Iconos PWA (192, 512, maskable, favicon)
└── build_icons.py          # Script para regenerar iconos
```

## Cómo desplegar

La app es 100% estática (HTML + CSS + JS). Necesitas servirla por HTTPS
(requisito de los Service Workers). Opciones:

### 1. Servidor local rápido (sólo para probar)
```bash
cd gastos-pwa
python3 -m http.server 8000
# Abre http://localhost:8000 en el móvil (misma WiFi)
```

### 2. Hosting gratuito
Sube la carpeta `gastos-pwa/` a:
- **GitHub Pages** (recomendado): crea un repo, sube los archivos, activa
  Pages en `main / root`.
- **Netlify / Vercel**: arrastra la carpeta a su dashboard.
- **Cloudflare Pages**: connect to Git → auto-deploy.

### 3. Instalar como app
Una vez desplegada con HTTPS:
- **Android Chrome**: menú ⋮ → "Instalar app" / "Añadir a inicio".
- **iOS Safari**: botón compartir → "Añadir a pantalla de inicio".
- **Desktop Chrome/Edge**: icono de instalación en la barra de direcciones.

## Cómo usar la app

1. **Resumen**: ves el mes actual con ingresos, gastos, balance y el detalle
   de cada movimiento. Cambia de mes con las flechas del header.

2. **Añadir un gasto/ingreso**: botón "+ Añadir" o FAB. Elige el tipo
   (fijo / temporal / variable) y rellena las fechas.

3. **Gastos / Ingresos**: vista de todos los items, con filtro por tipo
   en gastos. Toca cualquier item para editarlo o eliminarlo.

4. **Histórico / Línea de tiempo**: vista cronológica de meses pasados y
   futuros con badge "Pasado / Actual / Proyectado". Toca cualquier mes
   para saltar a él.

5. **Ajustes**:
   - **Moneda**: €, $, £, etc.
   - **Tema**: automático / claro / oscuro.
   - **Día de inicio de mes**: si tu "mes" no empieza el día 1.
   - **Exportar / Importar**: backup en JSON.
   - **Datos de ejemplo**: añade gastos/ingresos ficticios para probar.
   - **Borrar todo**: elimina todos los datos locales.

## Modelo de datos

```jsonc
{
  "version": 1,
  "settings": {
    "currency": "EUR",
    "theme": "auto",
    "startDayOfMonth": 1
  },
  "expenses": [
    {
      "id": "uuid",
      "name": "Préstamo coche",
      "amount": 220,
      "type": "temporary",           // fixed | temporary | variable
      "category": "deudas",
      "startDate": "2026-01-01",
      "endDate": "2026-10-31",        // null = indefinido
      "targetMonth": null,            // solo para variable
      "notes": ""
    }
  ],
  "income": [ /* misma estructura, type: recurring | extra */ ]
}
```

## Reglas de proyección (motor)

Un item se aplica al mes `YYYY-MM` si:

- **Variable / Extra**: `item.targetMonth == monthKey`
- **Resto (fijo, temporal, recurrente)**:
  - `startDate <= fin de mes`
  - `endDate == null` **o** `endDate >= inicio de mes`

## Privacidad

- **Cero tracking**, cero analytics, cero red.
- Los datos solo viven en el `localStorage` del navegador donde abriste la
  app.
- Al cerrar el navegador, los datos **persisten**. Al usar "Borrar todo" o
  vaciar el almacenamiento del sitio, se eliminan.
- Si quieres mover los datos a otro dispositivo: **Ajustes → Exportar** →
  copia el JSON al otro dispositivo → **Ajustes → Importar**.

## Licencia

Uso personal. Modifica y distribuye libremente.
# gastos-planner

# 🔴 El Rubio Defensa Ticket

Sistema de gestión de tickets de producción para El Rubio Defensa.

## ⚡ Inicio Rápido

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## 👥 Usuarios Demo (Modo Local)

| Usuario | Contraseña | Área |
|---------|------------|------|
| recepcion | 1234 | Recepción de vehículos |
| produccion | 1234 | Producción de piezas |
| pintura | 1234 | Pintura de defensas |
| instalacion | 1234 | Instalación |
| marquilla | 1234 | Marquilla / Pago |
| admin | admin123 | Administrador (todo) |

## 📋 Formularios

1. **Recepción** – Checklist de vehículo: gasolina, micas, cristales, luces, pertenencias, rayaduras + fotos
2. **Producción** – Ticket de orden: modelo, piezas, re-trabajo, fecha compromiso
3. **Pintura** – Ticket de pintado: piezas, responsable, fechas
4. **Instalación** – Ticket de montaje: piezas instaladas
5. **Marquilla** – Pago y monitoreo: color, requerimiento especial

## 📥 API para Alegra

```
GET /api/tickets?role=recepcion&format=json&from=2025-01-01&to=2025-12-31
GET /api/tickets?role=all&format=csv
```

Parámetros:
- `role`: recepcion | produccion | pintura | instalacion | marquilla | all
- `format`: json | csv
- `from`, `to`: fechas ISO (opcional)

## 🗄️ Conectar Supabase (Producción)

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ejecuta `supabase_schema.sql` en el SQL Editor
3. Copia las credenciales a `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
4. Crea los usuarios en Supabase Auth
5. Inserta los perfiles con sus roles

## 🚀 Deploy en Vercel

```bash
npm i -g vercel
vercel --prod
```

Agrega las variables de entorno en el dashboard de Vercel.

## 🎨 Colores

- Negro principal: `#0a0a0a`
- Negro soft: `#111111`
- Rojo: `#CC1100`
- Rojo brillante: `#FF1500`

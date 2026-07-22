// =====================================================================
// Errores en español simple — para personas que no saben tecnología.
// Traduce los mensajes técnicos de Supabase/Postgres/red a frases
// que cualquiera entiende, con una instrucción clara de qué hacer.
// =====================================================================

const RULES: { test: RegExp; message: string }[] = [
  // Sin internet / red caída
  { test: /failed to fetch|networkerror|load failed|network request failed|fetch failed/i,
    message: 'Sin conexión a internet. Revise la red e intente de nuevo.' },

  // Sesión expirada
  { test: /jwt|token.*expired|session.*expired/i,
    message: 'Su sesión expiró. Cierre sesión y entre de nuevo.' },

  // Configuración del sistema (llaves inválidas)
  { test: /invalid api key|apikey/i,
    message: 'Error de configuración del sistema. Avise al administrador.' },

  // Función o tabla no encontrada en la caché de PostgREST
  { test: /schema cache|could not find the (table|function)|PGRST20[0-9]/i,
    message: 'El sistema necesita una actualización. Avise al administrador.' },

  // Tabla/columna/función inexistente en la base de datos
  { test: /does not exist|undefined (table|column|function)|relation .* does not exist/i,
    message: 'El sistema necesita una actualización. Avise al administrador.' },

  // Formato de dato incorrecto (uuid, fechas, números)
  { test: /invalid input syntax|22P02|invalid.*(uuid|date|time)/i,
    message: 'Un dato no tiene el formato correcto. Revise e intente de nuevo.' },

  // Duplicado
  { test: /duplicate key|23505|already exists/i,
    message: 'Ese registro ya existe. No hace falta guardarlo de nuevo.' },

  // Permisos
  { test: /permission denied|42501|row-level security|not authorized|forbidden/i,
    message: 'No tiene permiso para hacer esto. Avise al administrador.' },

  // Dato requerido faltante
  { test: /null value|violates not-null|23502/i,
    message: 'Falta un dato obligatorio. Complete todos los campos marcados con *.' },

  // Timeout
  { test: /timeout|timed out|57014/i,
    message: 'El sistema tardó demasiado en responder. Intente de nuevo.' },

  // Storage
  { test: /bucket|storage|payload too large/i,
    message: 'No se pudo subir la foto. Intente con una foto más pequeña.' },
]

// Mensajes que ya vienen en español claro desde la base de datos — se respetan.
const KEEP_AS_IS = /^ya existe|^selecciona|^la capacidad|^falta|^complete|^el ticket/i

/**
 * Convierte cualquier error técnico en un mensaje simple en español.
 * Uso:  catch (e) { setError(friendlyError(e)) }
 */
export function friendlyError (err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err ?? '')).trim()
  if (!raw) return 'No se pudo completar la acción. Intente de nuevo.'
  if (KEEP_AS_IS.test(raw)) return raw
  for (const rule of RULES) {
    if (rule.test.test(raw)) return rule.message
  }
  return 'No se pudo completar la acción. Intente de nuevo.'
}

/**
 * Igual que friendlyError, pero agrega el detalle técnico al final.
 * Útil para pantallas del administrador.
 */
export function friendlyErrorWithDetail (err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err ?? '')).trim()
  const friendly = friendlyError(err)
  if (!raw || friendly === raw) return friendly
  return `${friendly} (Detalle técnico: ${raw})`
}

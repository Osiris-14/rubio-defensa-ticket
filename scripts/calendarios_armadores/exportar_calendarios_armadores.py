"""
Exporta a CSV los eventos de los calendarios de ARMADORES de Google Calendar.

Basado en exportar_calendario.py (repo reporte-cxc-alegra), que extrae el
calendario "INSTALA". Este script extrae los 5 calendarios de armado:

    EVENNOT PUESTO 4 5PM
    PUESTO 2 ARMADOR
    PUESTO 3 FELIPE TRASER
    PUESTO 4 DE 8AM 4PM
    PUESTO 5 OSCAR

Cada calendario se encuentra por un fragmento de su nombre (summary), igual que
"INSTALA". La salida son N archivos CSV en public/data/calendario_armadores/,
uno por calendario, con una columna "calendario" que identifica el armador.

Requisitos (pip):
    python3 -m pip install --upgrade google-api-python-client google-auth-httplib2 google-auth-oauthlib

El JSON de credenciales (token.json) debe estar en esta misma carpeta, o llegar
por la variable de entorno GOOGLE_TOKEN_JSON. La primera vez se abre el
navegador para autorizar; después queda token.json.

Uso:
    python exportar_calendarios_armadores.py
"""

import csv
import glob
import html
import os.path
import re

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ---------------------------------------------------------------------------
# CONFIGURACION
# ---------------------------------------------------------------------------
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# (fragmento del nombre del calendario, slug del archivo de salida).
# El fragmento es solo un trozo del summary; no hace falta el nombre exacto.
CALENDARIOS = [
    ("EVENNOT", "armador_evennot"),
    ("PUESTO 2 ARMADOR", "armador_puesto2"),
    ("PUESTO 3 FELIPE TRASER", "armador_puesto3"),
    ("PUESTO 4 DE 8AM 4PM", "armador_puesto4"),
    ("PUESTO 5 OSCAR", "armador_puesto5"),
    # Faltaban: sin estos, la pestana Doblado de la web queda vacia porque
    # los eventos de Deivi nunca llegan a CSV. Si el fragmento no coincide
    # con ningun calendario, el script solo avisa y sigue.
    ("DEIVI", "armador_p13_deivi"),
    ("ENCARGADO DE FABRICACION", "armador_encargado_fabricacion"),
    ("PUESTO 3 ARMADOR", "armador_puesto3_armador"),
]

# Solo exporta eventos cuyo año de inicio coincida. "" = todos los años.
ANIO_FILTRO = "2026"

# Carpeta de salida dentro del repo (la lee la web app desde public/).
# Se calcula desde la ubicación de este script para que funcione sin importar
# desde dónde se ejecute.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
SALIDA_DIR = os.path.join(REPO_ROOT, "public", "data", "calendario_armadores")

# Titulos a excluir (no se exportan). Comparacion normaliza espacios y mayusculas.
TITULOS_EXCLUIDOS = []


def _normalizar(texto):
    """Minusculas y espacios colapsados, para comparar titulos."""
    return re.sub(r"\s+", " ", texto).strip().lower()


def titulo_excluido(titulo):
    t = _normalizar(titulo)
    return any(frag in t for frag in TITULOS_EXCLUIDOS)


def limpiar_descripcion(texto):
    """Convierte la descripcion HTML de Google Calendar a texto plano."""
    if not texto:
        return ""
    texto = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", texto)
    texto = re.sub(r"(?i)</\s*(p|div|tr|li|table|h[1-6])\s*>", "\n", texto)
    texto = re.sub(r"<[^>]+>", "", texto)
    texto = re.sub(r"<[^>]*$", "", texto)
    texto = texto.replace("<", " ").replace(">", " ")
    texto = html.unescape(texto)
    lineas = []
    for linea in texto.split("\n"):
        linea = re.sub(r"[ \t\xa0]+", " ", linea).strip()
        if linea:
            lineas.append(linea)
    return "\n".join(lineas)


# Columnas que se extraen de la descripcion
CAMPOS_DESC = ["color", "telefono", "nombre", "pendiente", "cotizacion", "p", "requerimiento", "notas"]


def parsear_descripcion(desc):
    """Separa la descripcion (ya limpia) en campos. Lo que no encaja va a 'notas'."""
    c = {k: "" for k in CAMPOS_DESC}
    notas = []
    for line in desc.split("\n"):
        line = line.strip()
        if not line:
            continue
        low = line.lower()

        if low.startswith("color"):
            val = re.sub(r"(?i)^color\s*:?\s*", "", line).strip(" :/-")
            c["color"] = (c["color"] + " / " + val).strip(" /") if c["color"] else val
            continue
        if low.startswith("tel"):
            c["telefono"] = re.sub(r"(?i)^tel(efono)?\s*:?\s*", "", line).strip()
            continue
        if low.startswith("nombre"):
            c["nombre"] = re.sub(r"(?i)^nombre\s*:?\s*", "", line).strip()
            continue
        if low.startswith("pendiente"):
            c["pendiente"] = re.sub(r"(?i)^pendiente\s*[-:]?\s*", "", line).strip()
            continue
        if low.startswith("cotizacion"):
            mc = re.search(r"(?i)cotizacion\s*:?\s*([0-9]+)", line)
            if mc:
                c["cotizacion"] = mc.group(1)
            mp = re.search(r"(?i)\bp\.?\s*([0-9]+)", line)
            if mp:
                c["p"] = mp.group(1)
            continue
        if low.startswith("requerimiento"):
            c["requerimiento"] = re.sub(r"(?i)^requerimiento\s*:?\s*", "", line).strip()
            continue
        if re.match(r"(?i)^p\.?\s*[0-9]", line):
            mp = re.search(r"([0-9]+)", line)
            if mp and not c["p"]:
                c["p"] = mp.group(1)
            continue
        m = re.match(r"^([0-9][0-9_\-\s]{6,}[0-9])\s*:\s*(.+)$", line)
        if m:
            if not c["telefono"]:
                c["telefono"] = m.group(1).replace("_", "-").strip()
            if not c["nombre"]:
                c["nombre"] = m.group(2).strip()
            continue
        notas.append(line)

    c["notas"] = " / ".join(notas)
    return c


# Mapeo de color por hex -> (nombre de color, etiqueta de negocio).
COLOR_POR_HEX = {
    "#7ae7bf": ("Verde", "Instalacion completada"),
    "#d06b64": ("Rojo", "Dia fecha 0"),
    "#fbd75b": ("Amarillo", "Cliente reagendado"),
    "#46d6db": ("Turquesa/Celeste", "NONE"),
}


# ---------------------------------------------------------------------------
# AUTENTICACION
# ---------------------------------------------------------------------------
def obtener_credenciales():
    creds = None

    token_env = os.environ.get("GOOGLE_TOKEN_JSON")
    if token_env:
        with open("token.json", "w") as f:
            f.write(token_env.strip())

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if creds and creds.valid:
        return creds

    if creds and creds.refresh_token:
        creds.refresh(Request())
        with open("token.json", "w") as token:
            token.write(creds.to_json())
        return creds

    if os.environ.get("CI"):
        raise RuntimeError(
            "No hay credenciales validas en CI. Revisa que el secreto "
            "GOOGLE_TOKEN_JSON tenga el token.json completo y con refresh_token."
        )

    candidatos = glob.glob("client_secret*.json") or glob.glob("credentials.json")
    if not candidatos:
        raise FileNotFoundError(
            "No encontre el JSON de credenciales (client_secret_*.json) en esta carpeta."
        )
    archivo_credenciales = candidatos[0]
    print(f"Usando credenciales: {archivo_credenciales}")
    flow = InstalledAppFlow.from_client_secrets_file(archivo_credenciales, SCOPES)
    creds = flow.run_local_server(port=0)
    with open("token.json", "w") as token:
        token.write(creds.to_json())
    return creds


# ---------------------------------------------------------------------------
# BUSCAR EL CALENDARIO POR NOMBRE
# ---------------------------------------------------------------------------
def buscar_calendario(service, fragmento):
    page_token = None
    todos = []
    while True:
        lista = service.calendarList().list(pageToken=page_token).execute()
        for cal in lista.get("items", []):
            todos.append(cal)
            if fragmento.lower() in cal["summary"].lower():
                return cal
        page_token = lista.get("nextPageToken")
        if not page_token:
            break

    print(f"\nNo encontre ningun calendario que contenga '{fragmento}'.")
    print("Calendarios disponibles:")
    for cal in todos:
        print(f"  - {cal['summary']}")
    return None


def obtener_eventos(service, calendar_id, anio=None):
    """Trae todos los eventos del calendario. Si se pasa `anio`, arranca el 1 de
    enero de ese año (el default de la API excluye el pasado: timeMin = hoy)."""
    eventos = []
    page_token = None
    extra = {}
    if anio:
        extra["timeMin"] = f"{anio}-01-01T00:00:00-04:00"
    while True:
        resultado = (
            service.events()
            .list(
                calendarId=calendar_id,
                singleEvents=True,
                orderBy="startTime",
                maxResults=2500,
                pageToken=page_token,
                **extra,
            )
            .execute()
        )
        eventos.extend(resultado.get("items", []))
        page_token = resultado.get("nextPageToken")
        if not page_token:
            break
    return eventos


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    try:
        creds = obtener_credenciales()
        service = build("calendar", "v3", credentials=creds)

        colores = service.colors().get().execute().get("event", {})

        os.makedirs(SALIDA_DIR, exist_ok=True)

        total_escritos = 0
        for fragmento, slug in CALENDARIOS:
            calendario = buscar_calendario(service, fragmento)
            if not calendario:
                continue
            calendar_id = calendario["id"]
            summary = calendario["summary"]
            print(f"Calendario encontrado: {summary} ({calendar_id})")

            color_defecto_id = calendario.get("colorId", "")
            color_defecto_fondo = calendario.get("backgroundColor", "")

            eventos = obtener_eventos(service, calendar_id, ANIO_FILTRO)
            print(f"  Eventos encontrados: {len(eventos)}")

            archivo = os.path.join(SALIDA_DIR, f"{slug}.csv")
            with open(archivo, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "id",
                    "titulo",
                    "inicio",
                    "fin",
                    "todo_el_dia",
                    "calendario",
                    "color_id",
                    "color_nombre",
                    "etiqueta",
                    "color_hex",
                    "usa_color_predeterminado",
                    "color",
                    "telefono",
                    "nombre",
                    "pendiente",
                    "cotizacion",
                    "p",
                    "requerimiento",
                    "notas",
                    "descripcion",
                    "ubicacion",
                ])

                escritos = 0
                excluidos = 0
                fuera_de_anio = 0
                for ev in eventos:
                    titulo = ev.get("summary", "(sin titulo)")

                    if titulo_excluido(titulo):
                        excluidos += 1
                        continue

                    inicio = ev["start"].get("dateTime", ev["start"].get("date", ""))
                    fin = ev["end"].get("dateTime", ev["end"].get("date", ""))
                    todo_el_dia = "date" in ev["start"]

                    if ANIO_FILTRO and not str(inicio).startswith(ANIO_FILTRO):
                        fuera_de_anio += 1
                        continue

                    color_id = ev.get("colorId")
                    if color_id:
                        usa_defecto = "No"
                        color_hex = colores.get(color_id, {}).get("background", "")
                    else:
                        usa_defecto = "Si"
                        color_id = color_defecto_id
                        color_hex = color_defecto_fondo

                    color_nombre, etiqueta = COLOR_POR_HEX.get(
                        (color_hex or "").lower(), ("Otro", "NONE")
                    )

                    desc_limpia = limpiar_descripcion(ev.get("description", ""))
                    d = parsear_descripcion(desc_limpia)

                    writer.writerow([
                        ev.get("id", ""),
                        titulo,
                        inicio,
                        fin,
                        "Si" if todo_el_dia else "No",
                        summary,
                        color_id,
                        color_nombre,
                        etiqueta,
                        color_hex,
                        usa_defecto,
                        d["color"],
                        d["telefono"],
                        d["nombre"],
                        d["pendiente"],
                        d["cotizacion"],
                        d["p"],
                        d["requerimiento"],
                        d["notas"],
                        desc_limpia,
                        ev.get("location", ""),
                    ])
                    escritos += 1

                total_escritos += escritos
                print(f"  Escritos: {escritos} | Excluidos: {excluidos} | Fuera de {ANIO_FILTRO}: {fuera_de_anio}")
                print(f"  CSV: {archivo}")

        print(f"\nListo. Total eventos escritos: {total_escritos}")

    except HttpError as error:
        print(f"Ocurrio un error con la API: {error}")


if __name__ == "__main__":
    main()

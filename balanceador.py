from fastapi import FastAPI, HTTPException
import httpx
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="API DE LA RED MASIVA DE SERVIDORES",
    description="sistema de deistribucion de solicitudes"    
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

servidores = [
   {"nombre": "Servidor 1", "url": "http://127.0.0.1:8001", "puerto": 8001},
    {"nombre": "Servidor 2", "url": "http://127.0.0.1:8002", "puerto": 8002},
    {"nombre": "Servidor 3", "url": "http://127.0.0.1:8003", "puerto": 8003},
]

siguiente_servidor = 0

historico_solicitudes = []


@app.get("/")
def inicio():
    return {
        "sitema": "Red de servidores dinamicos",
        "Servidores_configurados": len(servidores),
        "solicitudes_atendidas": len(historico_solicitudes),
        "mensaje": "API funcionando correctamente"
                                       
    }
@app.get("/servidores")
async def consultar_servidores():
    resultado = []
    async with httpx.AsyncClient(timeout=2.0) as cliente:
        for servidor in servidores:
            try:
                response = await cliente.get(f"{servidor['url']}/health")
                if response.status_code == 200:
                    resultado.append({
                        "nombre": servidor["nombre"],
                        "url": servidor["url"],
                        "estado": "activo",
                        "puerto": servidor["puerto"]
                    })
                else:
                    resultado.append({
                        "nombre": servidor["nombre"],
                        "url": servidor["url"],
                        "estado": "inactivo",
                        "puerto": servidor["puerto"]
                    })
            except httpx.RequestError:
                resultado.append({
                    "nombre": servidor["nombre"],
                    "url": servidor["url"],
                    "estado": "inactivo",
                    "puerto": servidor["puerto"]
                })

    return {
        "total_servidores": len(servidores),
        "Servidores": resultado
    }


@app.get("/solicitar")
async def solicitar():
    global siguiente_servidor
    if not servidores:
        raise HTTPException(status_code=503, detail="No hay servidores disponibles")

    servidor_actual = servidores[siguiente_servidor]
    siguiente_servidor = (siguiente_servidor + 1) % len(servidores)

    async with httpx.AsyncClient(timeout=2.0) as cliente:
        try:
            response = await cliente.get(f"{servidor_actual['url']}/contador")
            if response.status_code == 200:
                historico_solicitudes.append({
                    "servidor": servidor_actual["nombre"],
                    "url": servidor_actual["url"],
                    "puerto": servidor_actual["puerto"]
                })
                return {
                    "mensaje": "Solicitud atendida correctamente",
                    "servidor": servidor_actual["nombre"],
                    "url": servidor_actual["url"],
                    "puerto": servidor_actual["puerto"]
                }
            else:
                raise HTTPException(status_code=503, detail=f"Servidor {servidor_actual['nombre']} no disponible")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail=f"Servidor {servidor_actual['nombre']} no disponible")

@app.get("/estadisticas")
def estadisticas():
    conteo = {servidor["nombre"]: 0 for servidor in servidores}
    for solicitud in historico_solicitudes:
        conteo[solicitud["servidor"]] = conteo.get(solicitud["servidor"], 0) + 1

    total = len(historico_solicitudes)
    por_servidor = []
    for servidor in servidores:
        solicitudes = conteo.get(servidor["nombre"], 0)
        porcentaje = round((solicitudes / total) * 100, 1) if total else 0.0
        por_servidor.append({
            "servidor": servidor["nombre"],
            "puerto": servidor["puerto"],
            "solicitudes": solicitudes,
            "porcentaje": porcentaje
        })

    ultimo_servidor = historico_solicitudes[-1] if historico_solicitudes else None

    return {
        "total_solicitudes": total,
        "por_servidor": por_servidor,
        "ultimo_servidor": ultimo_servidor
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)

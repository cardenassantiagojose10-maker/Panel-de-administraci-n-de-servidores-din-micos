from fastapi import FastAPI
import uvicorn
import sys 
app = FastAPI(
title="servidor de la red dinamica",
)

puerto = int(sys.argv[1])
nombre = sys.argv[2]

contador = 0

@app.get("/")
def inicio():
    return {
        "Servidor": nombre, 
        "Mensaje": "servidor dissponible",
        "Puerto": puerto,
        }
@app.get("/contador")
def contador_func():
    global contador
    contador += 1
    return {
        "Servidor": nombre, 
        "solicitudes_atendidas": contador,
        "Puerto": puerto,
        "resultado": "Solicitud atendida correctamente"
        }
@app.get("/health")
def health_check():
    return {
        "Servidor": nombre,
        "estado": "activo",
        "Puerto": puerto
    }

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=puerto)
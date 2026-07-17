# ---- Etapa 1: build de la app Angular/Ionic ----
FROM node:22-alpine AS build
WORKDIR /app

# Instalar dependencias con el lockfile (build reproducible)
COPY package.json package-lock.json ./
# --legacy-peer-deps: el proyecto tiene un desfase de versiones entre
# @capacitor/ios (^8.4.1) y @capacitor/core (8.0.1). No afecta al build web.
RUN npm ci --legacy-peer-deps

# Copiar el resto del código y compilar en producción,
# sirviendo la app bajo el subpath /spid/
COPY . .
RUN npx ng build --configuration production --base-href /spid/

# ---- Etapa 2: servir con nginx ----
FROM nginx:1.27-alpine

# Config de nginx para servir la SPA bajo /spid con fallback de rutas
COPY nginx.conf /etc/nginx/conf.d/default.conf

# El builder "browser" emite los archivos planos en /app/www
COPY --from=build /app/www /usr/share/nginx/html/spid

EXPOSE 80

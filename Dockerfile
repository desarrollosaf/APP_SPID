# ---- Etapa 1: build de la app Angular/Ionic ----
FROM node:22-alpine AS build

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci --legacy-peer-deps

# Copiar el código del proyecto
COPY . .

# Compilar para funcionar bajo /spid/
RUN npx ng build \
    --configuration production \
    --base-href /spid/

# ---- Etapa 2: servir con Nginx ----
FROM nginx:1.27-alpine

# Eliminar la página predeterminada "Welcome to nginx"
RUN rm -rf /usr/share/nginx/html/*

# Copiar configuración
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar la aplicación compilada
COPY --from=build /app/www/ /usr/share/nginx/html/spid/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
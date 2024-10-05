FROM node:22-alpine AS build
WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm install

COPY src ./src/
COPY *.json ./

RUN npm run build-prod

FROM nginx:1.27
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /usr/src/app/dist/cijfers /usr/share/nginx/html
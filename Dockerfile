# Serves the prebuilt web build (`pnpm build:web` writes web-dist/). Deploy: see README.
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY web-dist/ /usr/share/nginx/html/
EXPOSE 80

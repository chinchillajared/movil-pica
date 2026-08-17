FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npx tailwindcss -i src/input.css -o shared/styles.css --minify

FROM nginx:alpine
ARG SITE_URL=http://localhost:8081
RUN rm /usr/share/nginx/html/index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/shared /usr/share/nginx/html/shared
COPY --from=builder /app/locales /usr/share/nginx/html/locales
COPY --from=builder /app/user /usr/share/nginx/html/user
COPY --from=builder /app/mechanic /usr/share/nginx/html/mechanic
COPY --from=builder /app/icons /usr/share/nginx/html/icons
COPY robots.txt sitemap.xml llms.txt /usr/share/nginx/html/
RUN find /usr/share/nginx/html -type f -name '*.html' -exec sed -i "s|http://localhost:8081|${SITE_URL}|g" {} + \
    && sed -i "s|http://localhost:8081|${SITE_URL}|g" /usr/share/nginx/html/robots.txt /usr/share/nginx/html/sitemap.xml /usr/share/nginx/html/llms.txt
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

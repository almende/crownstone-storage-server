FROM node

COPY . .

EXPOSE 4444
CMD ["npm", "start"]

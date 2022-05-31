FROM node:14-alpine


# Install aptget packages with apk
RUN apk add --no-cache libxslt libxml2-dev python-dev

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app

EXPOSE 8080
CMD [ "npm", "start" ]

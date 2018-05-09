#!/bin/sh

set -e

cd $1

openssl genrsa -des3 -passout pass:x -out server.pass.key 2048
openssl rsa -passin pass:x -in server.pass.key -out server.key
rm server.pass.key
openssl req -new -key server.key -out server.csr \
  -subj "/C=US/ST=Massachusetts/L=Boston/O=Department of Innovation and Technology/OU=Digital/CN=$WORKSPACE"
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
rm server.csr

FROM alpine:3.5

MAINTAINER John Kozak <jk@thameslighter.net>

RUN apk --update add nodejs make

ADD . /var/lib/malaya

# !!! prevalence stuff should be on its own volume !!!

RUN cd /var/lib/malaya;npm install

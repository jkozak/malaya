FROM gliderlabs/alpine:3.2

MAINTAINER John Kozak <jk@thameslighter.net>

RUN apk --update add nodejs make

# get malaya code somehow into /var/lib/malaya

RUN cd /var/lib/malaya;make tests

CMD cd /var/lib/malaya;./malaya run


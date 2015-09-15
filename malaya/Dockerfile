FROM gliderlabs/alpine:3.2

MAINTAINER John Kozak <jk@thameslighter.net>

RUN apk --update add nodejs make

ADD . /var/lib/malaya

# !!! prevalence stuff should be on its own volume !!!

RUN cd /var/lib/malaya;make clean tests

RUN cd /var/lib/malaya/examples/auction;rm -rf .prevalence;./malaya init -d data/init.json

RUN cd /var/lib/malaya/examples/auction;rm -rf .prevalence/lock

CMD cd /var/lib/malaya/examples/auction;./malaya run -D


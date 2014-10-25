FROM santalucia/nodejs
MAINTAINER John Kozak <jk@thameslighter.net>

RUN apt-get update && apt-get dist-upgrade -y

RUN apt-get install -y make

ADD . /var/lib/malaya

RUN cd /var/lib/malaya;npm install;make tests



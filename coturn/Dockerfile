FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y coturn && \
    rm -rf /var/lib/apt/lists/*

COPY turnserver.conf.template /etc/turnserver.conf.template
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

EXPOSE 3478/udp 3478/tcp 5349/tcp 49152-65535/udp

ENTRYPOINT ["/entrypoint.sh"]

CMD ["turnserver", "-c", "/etc/turnserver.conf"]


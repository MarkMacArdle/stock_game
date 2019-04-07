FROM python:3.6-alpine

COPY ./game /stock_game

WORKDIR ./stock_game

RUN pip install -r requirements.txt

ENTRYPOINT ["python"]
CMD ["application.py"]
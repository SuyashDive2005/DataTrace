from celery import Celery
from config import redis_url

def make_celery(app_name=__name__):
    celery = Celery(
        app_name,
        broker=redis_url,
        backend=redis_url,
        include=["tasks"] 
    )

    celery.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
    )

    return celery

celery_app = make_celery()
from celery import Celery, Task
from celery.schedules import crontab

from app import create_app

flask_app = create_app()


class FlaskTask(Task):
    def __call__(self, *args, **kwargs):
        with flask_app.app_context():
            return self.run(*args, **kwargs)


celery = Celery("campfire", task_cls=FlaskTask)
celery.conf.update(
    broker_url=flask_app.config["CELERY_BROKER_URL"],
    result_backend=flask_app.config["CELERY_RESULT_BACKEND"],
    timezone=flask_app.config["DEFAULT_TRIP_TIMEZONE"],
    enable_utc=True,
    beat_schedule={
        "nightly-recap-check": {
            "task": "campfire.generate_due_recaps",
            "schedule": crontab(minute=15),
        },
        "anniversary-check": {
            "task": "campfire.send_due_anniversaries",
            "schedule": crontab(hour=9, minute=0),
        },
        "booking-proposal-expiry": {
            "task": "campfire.expire_booking_proposals",
            "schedule": crontab(minute=5),
        },
    },
)

import app.tasks  # noqa: E402,F401

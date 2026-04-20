import json
import logging
import os
import sys

_LOG_RECORD_DEFAULTS = frozenset(logging.makeLogRecord({}).__dict__)


class _JsonFormatter(logging.Formatter):
    def format(self, record):
        entry = {
            'time': self.formatTime(record, '%Y-%m-%dT%H:%M:%S'),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        if record.exc_info:
            entry['exc_info'] = self.formatException(record.exc_info)
        for key, val in record.__dict__.items():
            if key not in _LOG_RECORD_DEFAULTS and not key.startswith('_'):
                entry[key] = val
        return json.dumps(entry)


def configure_logging():
    level_name = os.environ.get('LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    logging.getLogger('werkzeug').setLevel(logging.WARNING)

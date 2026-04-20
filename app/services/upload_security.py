import os
import time
import uuid

_PDF_MAGIC = b'%PDF'
_DOCX_MAGIC = b'PK\x03\x04'  # DOCX is a ZIP archive


def validate_magic_bytes(file_bytes: bytes, is_pdf: bool) -> bool:
    if len(file_bytes) < 4:
        return False
    if is_pdf:
        return file_bytes[:4] == _PDF_MAGIC
    return file_bytes[:4] == _DOCX_MAGIC


def save_upload(upload_dir: str, file_bytes: bytes, ext: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(upload_dir, filename)
    with open(path, 'wb') as f:
        f.write(file_bytes)
    return path


def cleanup_old_uploads(upload_dir: str, max_age_seconds: int = 3600) -> int:
    if not os.path.isdir(upload_dir):
        return 0
    cutoff = time.time() - max_age_seconds
    removed = 0
    for filename in os.listdir(upload_dir):
        path = os.path.join(upload_dir, filename)
        try:
            if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
                os.remove(path)
                removed += 1
        except OSError:
            pass
    return removed

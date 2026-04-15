import bcrypt
import os


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def get_admin_hash() -> str:
    return os.getenv("ADMIN_PASSWORD_HASH", "")


def get_admin_username() -> str:
    return os.getenv("ADMIN_USERNAME", "admin")

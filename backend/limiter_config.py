"""
Rate Limiting Configuration

Centralized rate limiter instance for the application.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize rate limiter (in-memory, per IP address)
limiter = Limiter(key_func=get_remote_address)


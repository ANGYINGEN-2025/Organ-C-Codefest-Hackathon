"""
API Key Authentication

Simple API key authentication for protecting endpoints.
Can be enabled/disabled via environment variable.
"""

from fastapi import HTTPException, Depends, Header
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

# Get API key from environment variable
# If not set, authentication is disabled
REQUIRED_API_KEY = os.getenv("API_KEY")

# Enable/disable authentication
# Set AUTH_ENABLED=true or set API_KEY to enable
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "false").lower() == "true" or REQUIRED_API_KEY is not None


def verify_api_key(x_api_key: Optional[str] = Header(None, alias="X-API-Key")) -> str:
    """
    Verify API key from request header.
    
    This is a FastAPI dependency that can be used with Depends().
    
    Args:
        x_api_key: API key from X-API-Key header
    
    Returns:
        The API key if valid
    
    Raises:
        HTTPException: 401 if authentication is enabled and key is missing/invalid
    
    Usage:
        @router.post("/")
        async def my_endpoint(api_key: str = Depends(verify_api_key)):
            ...
    """
    # If authentication is disabled, allow all requests
    if not AUTH_ENABLED:
        logger.debug("Authentication disabled - allowing request")
        return "disabled"
    
    # If no API key provided
    if not x_api_key:
        logger.warning("API key missing from request")
        raise HTTPException(
            status_code=401,
            detail="API key required. Provide X-API-Key header.",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    # Verify API key matches
    if x_api_key != REQUIRED_API_KEY:
        logger.warning(f"Invalid API key attempted: {x_api_key[:10] if x_api_key else 'None'}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    logger.debug("API key verified successfully")
    return x_api_key


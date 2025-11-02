from pydantic import BaseModel, Field


class AuthResponse(BaseModel):
    access_token: str = Field(..., description="Issued JWT access token.")
    token_type: str = Field(default="bearer", description="Type of the token returned.")
    user_id: str = Field(..., description="Identifier associated with the authenticated user.")

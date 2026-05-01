from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, min_length=8, max_length=20)
    political_party: Optional[str] = Field(default=None, min_length=1, max_length=120)

    @model_validator(mode="after")
    def validate_contact(self) -> "SignupRequest":
        if not self.email and not self.phone:
            raise ValueError("At least one of email or phone is required.")
        return self


class VerifyOtpRequest(BaseModel):
    target: str
    channel: Literal["email", "phone"]
    otp_code: str = Field(min_length=4, max_length=8)
    purpose: Literal["signup_verify", "login_verify", "reset_password", "change_contact"] = "signup_verify"


class LoginRequest(BaseModel):
    identifier: str = Field(description="Username, email, or phone")
    password: str = Field(min_length=8, max_length=128)


class GoogleLoginRequest(BaseModel):
    access_token: str
    political_party: Optional[str] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    phone: Optional[str] = None
    political_party: Optional[str] = None
    is_email_verified: bool
    is_phone_verified: bool
    auth_providers: list[str]
    created_at: datetime


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    access_expires_at: datetime
    refresh_expires_at: datetime


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: AuthTokens
    otp_required: bool = False
    otp_target: Optional[str] = None
    dev_otp: Optional[str] = None


class MessageResponse(BaseModel):
    message: str

from fastapi import APIRouter, Header, HTTPException, status

from backend.schemas.auth import (
    AuthResponse,
    GoogleLoginRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    SignupRequest,
    UserPublic,
    VerifyOtpRequest,
)
from backend.schemas.common import ErrorResponse
from backend.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])
service = AuthService()


@router.post("/signup", response_model=AuthResponse, responses={400: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
def signup(payload: SignupRequest) -> AuthResponse:
    return service.signup(
        username=payload.username.strip(),
        password=payload.password,
        email=payload.email.lower() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        political_party=payload.political_party.strip() if payload.political_party else None,
    )


@router.post("/verify-otp", response_model=MessageResponse, responses={400: {"model": ErrorResponse}})
def verify_otp(payload: VerifyOtpRequest) -> MessageResponse:
    result = service.verify_otp(
        target=payload.target.strip(),
        channel=payload.channel,
        otp_code=payload.otp_code.strip(),
        purpose=payload.purpose,
    )
    return MessageResponse(**result)


@router.post("/login", response_model=AuthResponse, responses={401: {"model": ErrorResponse}})
def login(payload: LoginRequest) -> AuthResponse:
    return service.login(identifier=payload.identifier.strip(), password=payload.password)


@router.post("/google-login", response_model=AuthResponse, responses={400: {"model": ErrorResponse}, 401: {"model": ErrorResponse}})
def google_login(payload: GoogleLoginRequest) -> AuthResponse:
    return service.google_login(payload.id_token)


@router.post("/refresh", response_model=AuthResponse, responses={401: {"model": ErrorResponse}})
def refresh(payload: RefreshRequest) -> AuthResponse:
    return service.refresh(payload.refresh_token)


@router.post("/logout", response_model=MessageResponse, responses={404: {"model": ErrorResponse}})
def logout(payload: LogoutRequest) -> MessageResponse:
    result = service.logout(payload.refresh_token)
    return MessageResponse(**result)


@router.get("/me", response_model=UserPublic, responses={401: {"model": ErrorResponse}})
def me(authorization: str = Header(default="")) -> UserPublic:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    token = authorization.replace("Bearer ", "", 1).strip()
    return service.me(token)

from fastapi import APIRouter, status

from backend.schemas.contact import ContactMessageRequest, ContactMessageResponse
from backend.services.contact_service import send_contact_message

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("", response_model=ContactMessageResponse, status_code=status.HTTP_200_OK)
def submit_contact_message(payload: ContactMessageRequest) -> ContactMessageResponse:
    """
    Accept a landing-page contact submission and email it on.

    Public by design: the form sits above the fold for people who do not have
    an account and are deciding whether to get one.
    """
    send_contact_message(payload)
    return ContactMessageResponse(message="Thanks. We have got your message and will be in touch.")

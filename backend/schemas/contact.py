from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ContactMessageRequest(BaseModel):
    """One submission from the landing page contact form."""

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)
    address: Optional[str] = Field(default=None, max_length=300)
    phone: Optional[str] = Field(default=None, max_length=40)
    # Hidden field. A person never sees it, so anything here came from a bot
    # filling every input on the page. Cheaper and quieter than a captcha.
    website: Optional[str] = Field(default=None, max_length=200)


class ContactMessageResponse(BaseModel):
    message: str

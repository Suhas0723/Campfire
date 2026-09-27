"""Payment provider boundary modeled after Visa Intelligent Commerce."""

import uuid
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass

from flask import current_app


@dataclass(frozen=True)
class UserInstruction:
    idempotency_key: str
    item: str
    book_ref: str
    amount: float
    max_price: float
    currency: str
    approval_message_id: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class AuthorizationResult:
    approved: bool
    authorization_ref: str | None
    amount: float
    currency: str
    reason: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


class PaymentProvider(ABC):
    @abstractmethod
    def authorize(self, *, token_ref: str, instruction: UserInstruction) -> AuthorizationResult:
        raise NotImplementedError

    @abstractmethod
    def void(self, *, token_ref: str, authorization_ref: str) -> dict:
        """Release an authorization when downstream booking cannot complete."""
        raise NotImplementedError


class MockVisaIntelligentCommerceProvider(PaymentProvider):
    """Deterministic stand-in for a token-scoped VIC authorization."""

    def authorize(self, *, token_ref: str, instruction: UserInstruction) -> AuthorizationResult:
        if instruction.amount > instruction.max_price:
            return AuthorizationResult(
                approved=False,
                authorization_ref=None,
                amount=instruction.amount,
                currency=instruction.currency,
                reason="amount_exceeds_user_instruction",
            )
        if current_app.config.get("MOCK_VIC_DECLINE"):
            return AuthorizationResult(
                approved=False,
                authorization_ref=None,
                amount=instruction.amount,
                currency=instruction.currency,
                reason="mock_authorization_declined",
            )
        reference = uuid.uuid5(
            uuid.NAMESPACE_URL,
            f"{token_ref}:{instruction.idempotency_key}",
        )
        return AuthorizationResult(
            approved=True,
            authorization_ref=f"VIC-MOCK-{str(reference).upper()}",
            amount=instruction.amount,
            currency=instruction.currency,
        )

    def void(self, *, token_ref: str, authorization_ref: str) -> dict:
        return {"voided": True, "authorization_ref": authorization_ref}


def get_payment_provider() -> PaymentProvider:
    name = str(current_app.config.get("PAYMENT_PROVIDER", "mock_vic")).casefold()
    if name == "mock_vic":
        return MockVisaIntelligentCommerceProvider()
    raise RuntimeError(f"Unsupported payment provider: {name}")

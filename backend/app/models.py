import os
import uuid
from datetime import date, datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Numeric, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

ACTIVE = "active"
PAUSED = "paused"
ENDED = "ended"

EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "1536"))


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Group(db.Model):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    whatsapp_jid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    trips: Mapped[list["Trip"]] = relationship(back_populates="group")


class User(db.Model):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    whatsapp_jid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    payment_token: Mapped["PaymentToken | None"] = relationship(back_populates="user", uselist=False)


trip_participants = db.Table(
    "trip_participants",
    db.Column("trip_id", UUID(as_uuid=True), ForeignKey("trips.id"), primary_key=True),
    db.Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)


class Trip(db.Model):
    __tablename__ = "trips"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=ACTIVE, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anniversary_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    group: Mapped[Group] = relationship(back_populates="trips")
    participants: Mapped[list[User]] = relationship(secondary=trip_participants)
    messages: Mapped[list["Message"]] = relationship(back_populates="trip")
    locations: Mapped[list["Location"]] = relationship(back_populates="trip")
    stories: Mapped[list["Story"]] = relationship(back_populates="trip")
    suggestions: Mapped[list["Suggestion"]] = relationship(back_populates="trip")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="trip")

    def crew(self) -> list[str]:
        order = (self.details or {}).get("crew_order") or []
        names = [(user.display_name or "").split(" ")[0] for user in self.participants]
        return sorted((n for n in names if n), key=lambda n: (order.index(n) if n in order else len(order), n))

    def to_dict(self) -> dict:
        details = self.details or {}
        return {
            "id": str(self.id),
            "name": self.name,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
            "group_name": self.group.name if self.group else "",
            "slug": self.slug,
            "place": details.get("place"),
            "location": details.get("location"),
            "scene_key": details.get("scene_key"),
            "crew": self.crew(),
        }


class Message(db.Model):
    __tablename__ = "messages"
    __table_args__ = (UniqueConstraint("whatsapp_message_id", name="uq_message_wa_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    sender_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    whatsapp_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    media_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    quoted_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    excluded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    embedding = mapped_column(Vector(EMBEDDING_DIM), nullable=True)

    trip: Mapped[Trip] = relationship(back_populates="messages")
    sender: Mapped[User | None] = relationship()


class Location(db.Model):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="chat")

    trip: Mapped[Trip] = relationship(back_populates="locations")

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
        }


class Story(db.Model):
    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    for_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    script: Mapped[str] = mapped_column(Text, nullable=False, default="")
    audio_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    segments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    trip: Mapped[Trip] = relationship(back_populates="stories")


class Suggestion(db.Model):
    __tablename__ = "suggestions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False, default="")
    choices: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    trip: Mapped[Trip] = relationship(back_populates="suggestions")


side_quest_participants = db.Table(
    "side_quest_participants",
    db.Column("side_quest_id", UUID(as_uuid=True), ForeignKey("side_quests.id"), primary_key=True),
    db.Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)


class SideQuest(db.Model):
    __tablename__ = "side_quests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    visibility: Mapped[str | None] = mapped_column(String(32), nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    participants: Mapped[list[User]] = relationship(secondary=side_quest_participants)


class Booking(db.Model):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trips.id"), nullable=False, index=True)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)
    time_slot: Mapped[str] = mapped_column(String(32), nullable=False)
    candidate_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="proposed", index=True)
    proposal_ref: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    proposal_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    approved_by: Mapped[str | None] = mapped_column(String(128), nullable=True)
    approval_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    processing_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    trip: Mapped[Trip] = relationship(back_populates="bookings")
    audit_logs: Mapped[list["BookingAuditLog"]] = relationship(back_populates="booking")


class PaymentToken(db.Model):
    __tablename__ = "payment_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True, index=True)
    token_ref: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    provider: Mapped[str] = mapped_column(
        String(32), nullable=False, default="mock_vic", server_default=text("'mock_vic'")
    )
    spend_limit: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    user: Mapped[User] = relationship(back_populates="payment_token")


class BookingAuditLog(db.Model):
    __tablename__ = "booking_audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("bookings.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor_jid: Mapped[str | None] = mapped_column(String(128), nullable=True)
    approval_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    approval_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    provider_request: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    provider_response: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    booking: Mapped[Booking] = relationship(back_populates="audit_logs")

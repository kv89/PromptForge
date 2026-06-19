"""Async Firestore data-access layer for PromptForge.

Collection layout (Firestore native mode):

* ``use_cases``                       — one document per user-defined use case
                                        (global / shared across all users)
* ``prompts``                         — one document per prompt, auto-generated ID
* ``prompts/{prompt_id}/versions``    — one document per saved version

Prompts are owned by a user (``owner_uid``). Filtering prompts by use case is
done through the denormalised ``use_case_slug`` field on each prompt document,
avoiding a join against the ``use_cases`` collection.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from google.cloud import firestore
from google.cloud.firestore_v1 import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
from google.oauth2 import service_account


from app.config import get_settings
from app.core.exceptions import PromptNotFoundError
from app.models.prompt import (
    Prompt,
    PromptCreate,
    PromptStatus,
    PromptUpdate,
    PromptVariable,
    PromptVersion,
    UseCase,
    UseCaseCreate,
)
from app.models.prompt import _slugify
from app.models.run import Run, RunRequest, RunStatus, RunSummary
from app.models.eval import EvalResult, EvalResultResponse, Rubric, RubricCreate

USE_CASES_COLLECTION = "use_cases"
PROMPTS_COLLECTION = "prompts"
VERSIONS_SUBCOLLECTION = "versions"


def _utcnow() -> datetime:
    """Return the current time as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def _to_datetime(value: Any) -> Any:
    """Coerce a Firestore timestamp to a plain :class:`datetime`.

    Firestore returns ``DatetimeWithNanoseconds`` (a ``datetime`` subclass). We
    normalise it to a standard ``datetime`` so downstream code and serialisation
    behave predictably; non-datetime values are passed through unchanged.
    """
    if isinstance(value, datetime):
        return datetime.fromtimestamp(value.timestamp(), tz=value.tzinfo or timezone.utc)
    return value

from datetime import datetime, timezone

def _ts_to_dt(value) -> datetime:
    """Convert Firestore Timestamp or datetime to UTC datetime."""
    if hasattr(value, "ToDatetime"):
        return value.ToDatetime(tzinfo=timezone.utc)
    if isinstance(value, datetime):
        return value
    return datetime.utcnow()

class FirestoreService:
    """Async, high-level accessor for PromptForge's Firestore collections."""

    def __init__(self, project_id: str) -> None:
        """Create the service backed by a Firestore AsyncClient."""
        settings = get_settings()

        print("/n/n -- Settings Class:--", settings.firestore_database)
        
        credentials = service_account.Credentials.from_service_account_file(
            settings.google_application_credentials
        )
        self._db: AsyncClient = AsyncClient(
            project=project_id,
            credentials=credentials,
            database=settings.firestore_database
        )

    # ------------------------------------------------------------------ #
    # Document -> model converters
    # ------------------------------------------------------------------ #
    def _doc_to_use_case(self, doc: Any) -> UseCase:
        """Convert a Firestore ``DocumentSnapshot`` into a :class:`UseCase`."""
        data: dict[str, Any] = doc.to_dict() or {}
        data["id"] = doc.id
        if "created_at" in data:
            data["created_at"] = _to_datetime(data["created_at"])
        return UseCase(**data)

# ── Run methods ──────────────────────────────────────────────────────────

    async def create_run(
        self,
        data: RunRequest,
        owner_uid: str,
        rendered_prompt: str,
        prompt_name: str,
        model: str,
    ) -> Run:
        now = datetime.utcnow()
        run = Run(
            prompt_id=data.prompt_id,
            prompt_name=prompt_name,
            version_number=data.version_number,
            rendered_prompt=rendered_prompt,
            variables=data.variables,
            model=model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
            status=RunStatus.PENDING,
            created_at=now,
            owner_uid=owner_uid,
        )
        payload = run.model_dump(exclude={"id"})
        _, ref = await self._db.collection("runs").add(payload)
        run.id = ref.id
        return run

    async def update_run_completed(
        self,
        run_id: str,
        output: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: float,
    ) -> Run:
        run = await self.get_run(run_id)
        run.status = RunStatus.COMPLETED
        run.output = output
        run.prompt_tokens = prompt_tokens
        run.completion_tokens = completion_tokens
        run.total_tokens = prompt_tokens + completion_tokens
        run.latency_ms = latency_ms
        run.completed_at = datetime.utcnow()
        ref = self._db.collection("runs").document(run_id)
        await ref.set(run.model_dump(exclude={"id"}))
        return run

    async def update_run_failed(self, run_id: str, error: str) -> Run:
        run = await self.get_run(run_id)
        run.status = RunStatus.FAILED
        run.error = error
        run.completed_at = datetime.utcnow()
        ref = self._db.collection("runs").document(run_id)
        await ref.set(run.model_dump(exclude={"id"}))
        return run

    async def get_run(self, run_id: str) -> Run:
        doc = await self._db.collection("runs").document(run_id).get()
        if not doc.exists:
            raise PromptNotFoundError(run_id)
        return self._doc_to_run(doc)

    async def list_runs(
        self,
        owner_uid: str,
        prompt_id: str | None = None,
        limit: int = 50,
    ) -> list[RunSummary]:
        query = (
            self._db.collection("runs")
            .where("owner_uid", "==", owner_uid)
        )
        if prompt_id:
            query = query.where("prompt_id", "==", prompt_id)
        query = query.order_by("created_at", direction="DESCENDING").limit(limit)
        results = []
        async for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            if "created_at" in data:
                data["created_at"] = _ts_to_dt(data["created_at"])
            results.append(RunSummary(
                id=data["id"],
                prompt_id=data["prompt_id"],
                prompt_name=data["prompt_name"],
                version_number=data["version_number"],
                model=data["model"],
                status=data["status"],
                overall_score=data.get("overall_score"),
                latency_ms=data.get("latency_ms", 0.0),
                total_tokens=data.get("total_tokens", 0),
                created_at=data["created_at"],
            ))
        return results

    async def list_runs_for_prompt(
        self, prompt_id: str, owner_uid: str
    ) -> list[RunSummary]:
        return await self.list_runs(owner_uid, prompt_id=prompt_id)

# ── Rubric methods ───────────────────────────────────────────────────────

    async def create_rubric(
        self, data: RubricCreate, creator_uid: str
    ) -> Rubric:
        from app.services.eval_service import DEFAULT_RUBRIC
        payload = {
            "name": data.name,
            "description": data.description,
            "use_case_id": data.use_case_id,
            "criteria": [c.model_dump() for c in data.criteria],
            "created_by": creator_uid,
            "created_at": datetime.utcnow(),
            "is_default": False,
        }
        _, ref = await self._db.collection("rubrics").add(payload)
        return Rubric(id=ref.id, **payload)

    async def get_rubric(self, rubric_id: str) -> Rubric:
        doc = await self._db.collection("rubrics").document(rubric_id).get()
        if not doc.exists:
            raise PromptNotFoundError(rubric_id)
        return self._doc_to_rubric(doc)

    async def list_rubrics(
        self, use_case_id: str | None = None
    ) -> list[Rubric]:
        query = self._db.collection("rubrics")
        if use_case_id:
            query = query.where("use_case_id", "==", use_case_id)
        return [self._doc_to_rubric(d) async for d in query.stream()]

    async def get_rubric_for_use_case(
        self, use_case_id: str
    ) -> Rubric | None:
        """
        Returns the custom rubric for a use case if one exists.
        Returns None if no custom rubric — caller should fall back
        to DEFAULT_RUBRIC.
        """
        query = (
            self._db.collection("rubrics")
            .where("use_case_id", "==", use_case_id)
            .limit(1)
        )
        docs = [d async for d in query.stream()]
        if not docs:
            return None
        return self._doc_to_rubric(docs[0])

    # ── EvalResult methods ───────────────────────────────────────────────────

    async def save_eval_result(self, result: EvalResult) -> EvalResult:
        payload = result.model_dump(exclude={"id"})
        _, ref = await self._db.collection("eval_results").add(payload)
        result.id = ref.id
        return result

    async def get_eval_result(self, eval_id: str) -> EvalResult:
        doc = await self._db.collection("eval_results").document(eval_id).get()
        if not doc.exists:
            raise PromptNotFoundError(eval_id)
        return self._doc_to_eval(doc)

    async def get_eval_for_run(self, run_id: str) -> EvalResult | None:
        """Get the evaluation result for a specific run, if it exists."""
        query = (
            self._db.collection("eval_results")
            .where("run_id", "==", run_id)
            .limit(1)
        )
        docs = [d async for d in query.stream()]
        if not docs:
            return None
        return self._doc_to_eval(docs[0])

    async def list_evals_for_prompt(
        self, prompt_id: str, owner_uid: str
    ) -> list[EvalResult]:
        query = (
            self._db.collection("eval_results")
            .where("prompt_id", "==", prompt_id)
            .where("owner_uid", "==", owner_uid)
            .order_by("created_at", direction="DESCENDING")
        )
        return [self._doc_to_eval(d) async for d in query.stream()]

    async def update_run_score(
        self, run_id: str, overall_score: float
    ) -> None:
        """Denormalise the overall_score onto the run document for list views."""
        ref = self._db.collection("runs").document(run_id)
        await ref.update({"overall_score": overall_score})

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _doc_to_rubric(self, doc) -> Rubric:
        data = doc.to_dict()
        data["id"] = doc.id
        if "created_at" in data:
            data["created_at"] = _ts_to_dt(data["created_at"])
        return Rubric(**data)

    def _doc_to_eval(self, doc) -> EvalResult:
        data = doc.to_dict()
        data["id"] = doc.id
        if "created_at" in data:
            data["created_at"] = _ts_to_dt(data["created_at"])
        return EvalResult(**data)

    def _doc_to_run(self, doc) -> Run:
        data = doc.to_dict()
        data["id"] = doc.id
        for field in ("created_at", "completed_at"):
            if field in data and data[field] is not None:
                data[field] = _ts_to_dt(data[field])
        return Run(**data)
        
    def _doc_to_prompt(self, doc: Any) -> Prompt:
        """Convert a Firestore ``DocumentSnapshot`` into a :class:`Prompt`."""
        data: dict[str, Any] = doc.to_dict() or {}
        data["id"] = doc.id
        if "created_at" in data:
            data["created_at"] = _to_datetime(data["created_at"])
        if "updated_at" in data:
            data["updated_at"] = _to_datetime(data["updated_at"])
        for version in data.get("versions", []) or []:
            if isinstance(version, dict) and "created_at" in version:
                version["created_at"] = _to_datetime(version["created_at"])
        return Prompt(**data)

    # ------------------------------------------------------------------ #
    # UseCase methods
    # ------------------------------------------------------------------ #
    async def create_use_case(self, data: UseCaseCreate, creator_uid: str) -> UseCase:
        """Create a new, globally-shared use case with a unique slug."""
        slug = _slugify(data.name)
        collection = self._db.collection(USE_CASES_COLLECTION)

        existing = collection.where(filter=FieldFilter("slug", "==", slug)).limit(1)
        async for _ in existing.stream():
            raise ValueError(f"A use case with slug '{slug}' already exists")

        use_case = UseCase(
            name=data.name,
            slug=slug,
            description=data.description,
            icon=data.icon,
            created_by=creator_uid,
            created_at=_utcnow(),
            prompt_count=0,
        )

        _, doc_ref = await collection.add(use_case.model_dump(exclude={"id"}))
        use_case.id = doc_ref.id
        return use_case

    async def list_use_cases(self) -> list[UseCase]:
        """Return all use cases ordered by name ascending."""
        query = self._db.collection(USE_CASES_COLLECTION).order_by("name")
        return [self._doc_to_use_case(doc) async for doc in query.stream()]

    async def get_use_case(self, use_case_id: str) -> UseCase:
        """Fetch a single use case by document ID, or raise if missing."""
        doc = await self._db.collection(USE_CASES_COLLECTION).document(use_case_id).get()
        if not doc.exists:
            raise PromptNotFoundError(use_case_id)
        return self._doc_to_use_case(doc)

    async def increment_use_case_prompt_count(self, use_case_id: str, delta: int = 1) -> None:
        """Atomically adjust a use case's denormalised ``prompt_count``."""
        doc_ref = self._db.collection(USE_CASES_COLLECTION).document(use_case_id)
        await doc_ref.update({"prompt_count": firestore.Increment(delta)})

    # ------------------------------------------------------------------ #
    # Prompt methods
    # ------------------------------------------------------------------ #
    async def create_prompt(
        self, data: PromptCreate, owner_uid: str, owner_email: str
    ) -> Prompt:
        """Create a prompt (with its first version) under the given use case."""
        use_case = await self.get_use_case(data.use_case_id)

        now = _utcnow()
        first_version = PromptVersion(
            version_number=1,
            content=data.initial_content,
            variables=data.variables,
            created_at=now,
            created_by=owner_email,
            change_note="Initial version",
            is_stable=False,
            tags=data.tags,
        )

        prompt = Prompt(
            name=data.name,
            description=data.description,
            use_case_id=data.use_case_id,
            use_case_slug=use_case.slug,
            use_case_name=use_case.name,
            status=PromptStatus.DRAFT,
            current_version=1,
            versions=[first_version],
            owner_uid=owner_uid,
            owner_email=owner_email,
            created_at=now,
            updated_at=now,
        )

        _, doc_ref = await self._db.collection(PROMPTS_COLLECTION).add(
            prompt.model_dump(exclude={"id"})
        )
        prompt.id = doc_ref.id

        await doc_ref.collection(VERSIONS_SUBCOLLECTION).document(
            str(first_version.version_number)
        ).set(first_version.model_dump())

        await self.increment_use_case_prompt_count(data.use_case_id, 1)
        return prompt

    async def get_prompt(self, prompt_id: str) -> Prompt:
        """Fetch a single prompt by document ID, or raise if missing."""
        doc = await self._db.collection(PROMPTS_COLLECTION).document(prompt_id).get()
        if not doc.exists:
            raise PromptNotFoundError(prompt_id)
        return self._doc_to_prompt(doc)

    async def list_prompts(
        self,
        owner_uid: str,
        use_case_slug: str | None = None,
        status: str | None = None,
    ) -> list[Prompt]:
        """List a user's prompts, optionally filtered by use case slug/status.

        Firestore requires a composite index when combining multiple ``where``
        clauses with ``order_by`` on another field. To avoid blocking local dev
        on index creation, we query only ``owner_uid`` in Firestore, then filter
        and sort in memory (fine for typical prompt counts in Phase 1).
        """
        query = self._db.collection(PROMPTS_COLLECTION).where(
            filter=FieldFilter("owner_uid", "==", owner_uid)
        )
        prompts = [self._doc_to_prompt(doc) async for doc in query.stream()]

        if use_case_slug is not None:
            prompts = [p for p in prompts if p.use_case_slug == use_case_slug]
        if status is not None:
            prompts = [p for p in prompts if str(p.status) == status]

        prompts.sort(key=lambda p: p.updated_at, reverse=True)
        return prompts

    async def update_prompt(
        self, prompt_id: str, data: PromptUpdate, editor_email: str
    ) -> Prompt:
        """Save a new version of an existing prompt and persist the change."""
        prompt = await self.get_prompt(prompt_id)

        new_version_number = prompt.current_version + 1
        new_version = PromptVersion(
            version_number=new_version_number,
            content=data.content,
            variables=data.variables,
            created_at=_utcnow(),
            created_by=editor_email,
            change_note=data.change_note,
            is_stable=False,
            tags=data.tags,
        )

        prompt.current_version = new_version_number
        prompt.versions.append(new_version)
        prompt.updated_at = _utcnow()

        doc_ref = self._db.collection(PROMPTS_COLLECTION).document(prompt_id)
        await doc_ref.set(prompt.model_dump(exclude={"id"}), merge=False)
        await doc_ref.collection(VERSIONS_SUBCOLLECTION).document(
            str(new_version_number)
        ).set(new_version.model_dump())

        return prompt

    async def promote_to_stable(self, prompt_id: str, version_number: int) -> Prompt:
        """Mark a version as stable and activate the prompt."""
        prompt = await self.get_prompt(prompt_id)

        found = False
        for version in prompt.versions:
            if version.version_number == version_number:
                version.is_stable = True
                found = True
                break
        if not found:
            raise PromptNotFoundError(f"{prompt_id}/versions/{version_number}")

        prompt.status = PromptStatus.ACTIVE
        prompt.updated_at = _utcnow()

        doc_ref = self._db.collection(PROMPTS_COLLECTION).document(prompt_id)
        await doc_ref.set(prompt.model_dump(exclude={"id"}), merge=False)
        await doc_ref.collection(VERSIONS_SUBCOLLECTION).document(
            str(version_number)
        ).set({"is_stable": True}, merge=True)

        return prompt

    async def archive_prompt(self, prompt_id: str) -> None:
        """Archive a prompt and decrement its use case's prompt count."""
        prompt = await self.get_prompt(prompt_id)

        doc_ref = self._db.collection(PROMPTS_COLLECTION).document(prompt_id)
        await doc_ref.update(
            {
                "status": PromptStatus.ARCHIVED.value,
                "updated_at": _utcnow(),
            }
        )
        await self.increment_use_case_prompt_count(prompt.use_case_id, -1)

    async def get_versions(self, prompt_id: str) -> list[PromptVersion]:
        """Return all saved versions for a prompt, ordered ascending."""
        query = (
            self._db.collection(PROMPTS_COLLECTION)
            .document(prompt_id)
            .collection(VERSIONS_SUBCOLLECTION)
            .order_by("version_number")
        )
        versions: list[PromptVersion] = []
        async for doc in query.stream():
            payload = doc.to_dict() or {}
            if "created_at" in payload:
                payload["created_at"] = _to_datetime(payload["created_at"])
            versions.append(PromptVersion(**payload))
        return versions


@lru_cache
def get_firestore_service() -> FirestoreService:
    """Return a cached singleton :class:`FirestoreService` from settings."""
    settings = get_settings()
    return FirestoreService(project_id=settings.gcp_project_id)

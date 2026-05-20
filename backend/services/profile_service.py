from fastapi import HTTPException, status

from backend.repositories.profile_answers_repo import ProfileAnswersRepository
from backend.repositories.questions_repo import QuestionsRepository
from backend.schemas.profile import ProfileAnswerResponse


class ProfileService:
    def __init__(self) -> None:
        self.repo = ProfileAnswersRepository()
        self.questions_repo = QuestionsRepository()

    def upsert_answer(self, user_id: str, question_id: str, answer, source: str) -> ProfileAnswerResponse:
        question = self.questions_repo.get_by_question_id(question_id)
        if not question:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        normalized_answer = self._validate_answer_against_question(question, answer)
        doc = self.repo.upsert_answer(user_id=user_id, question_id=question_id, answer=normalized_answer, source=source)
        return self._to_response(doc)

    def upsert_answers_batch(self, user_id: str, answers: dict, source: str) -> list[ProfileAnswerResponse]:
        all_questions = self.questions_repo.list(limit=500, skip=0)
        active_questions = [q for q in all_questions if bool(q.get("is_active", True))]
        question_map = {str(q["question_id"]): q for q in active_questions}

        # Merge incoming payload with existing persisted answers so partial profile
        # updates don't fail required validation when required answers are already saved.
        existing_answers = {
            str(doc.get("question_id")): doc.get("answer")
            for doc in self.repo.list_by_user(user_id=user_id, limit=1000, skip=0)
            if doc.get("question_id") is not None
        }
        effective_answers = {**existing_answers, **answers}

        required_ids = [str(q["question_id"]) for q in active_questions if bool(q.get("is_required", False))]
        missing_required = [qid for qid in required_ids if self._is_empty_answer(effective_answers.get(qid))]
        if missing_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required answers for: {', '.join(sorted(missing_required))}",
            )

        out: list[ProfileAnswerResponse] = []
        for question_id, answer in answers.items():
            question = question_map.get(str(question_id))
            if not question:
                # Unknown question IDs (e.g. from the Preferences profile panel) are
                # stored as free-form answers rather than rejected, so the UI always
                # round-trips correctly even when the questions table doesn't have them.
                doc = self.repo.upsert_answer(
                    user_id=user_id,
                    question_id=str(question_id),
                    answer=answer,
                    source=source,
                )
                out.append(self._to_response(doc))
                continue
            normalized_answer = self._validate_answer_against_question(question, answer)
            doc = self.repo.upsert_answer(
                user_id=user_id,
                question_id=str(question_id),
                answer=normalized_answer,
                source=source,
            )
            out.append(self._to_response(doc))
        return out

    def list_answers(self, user_id: str, limit: int = 200, skip: int = 0) -> list[ProfileAnswerResponse]:
        return [self._to_response(doc) for doc in self.repo.list_by_user(user_id, limit=limit, skip=skip)]

    def get_answer(self, user_id: str, question_id: str) -> ProfileAnswerResponse:
        doc = self.repo.get_by_user_and_question(user_id, question_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found.")
        return self._to_response(doc)

    def _to_response(self, doc: dict) -> ProfileAnswerResponse:
        return ProfileAnswerResponse(
            id=str(doc["_id"]),
            user_id=str(doc["user_id"]),
            question_id=doc["question_id"],
            answer=doc["answer"],
            source=doc["source"],
            answered_at=doc["answered_at"],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )

    @staticmethod
    def _is_empty_answer(answer) -> bool:
        if answer is None:
            return True
        if isinstance(answer, str):
            return not answer.strip()
        if isinstance(answer, (list, tuple, set, dict)):
            return len(answer) == 0
        return False

    def _validate_answer_against_question(self, question: dict, answer):
        options = question.get("options") or []
        answer_type = str(question.get("answer_type") or "")
        question_id = str(question.get("question_id") or "")

        if answer_type == "single_select":
            if not isinstance(answer, str) or not answer.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Answer for {question_id} must be a non-empty string.",
                )
            normalized = self._normalize_single_select_answer(answer, options)
            if options and normalized is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid option for {question_id}: {answer}",
                )
            return normalized or answer.strip()
        elif answer_type == "multi_select":
            if not isinstance(answer, list) or not answer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Answer for {question_id} must be a non-empty list.",
                )
            if options and any(item not in options for item in answer):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid multi-select option for {question_id}.",
                )
            return answer
        return answer

    @staticmethod
    def _normalize_single_select_answer(answer: str, options: list) -> str | None:
        def _soft_norm(text: str) -> str:
            return "".join(ch.lower() for ch in text if ch.isalnum())

        if not options:
            return answer.strip()
        raw = answer.strip()
        if raw in options:
            return raw

        raw_fold = raw.casefold()
        for opt in options:
            if isinstance(opt, str) and opt.casefold() == raw_fold:
                return opt

        raw_soft = _soft_norm(raw)
        for opt in options:
            if isinstance(opt, str) and _soft_norm(opt) == raw_soft:
                return opt

        # Backward compatibility: UI may send short label, while DB stores:
        # "Label -> Description". Accept short label and map to canonical option.
        for opt in options:
            if not isinstance(opt, str):
                continue
            label = opt.split("->", 1)[0].strip()
            if label.casefold() == raw_fold:
                return opt
            label_soft = _soft_norm(label)
            if label_soft == raw_soft:
                return opt
            # Accept expanded UI labels like "High (4-6)" for DB label "High",
            # and variants like "Real imagery" for label "Real".
            if label_soft and (raw_soft.startswith(label_soft) or label_soft.startswith(raw_soft)):
                return opt
        return None

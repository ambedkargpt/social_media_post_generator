from __future__ import annotations

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient


QUESTIONS = [
    {
        "question_id": "profile_user_role",
        "question_text": "Which role best reflects how you engage with social or political issues?",
        "is_required": True,
        "options": [
            "Mobilizer -> Focus on action, protests, organizing people",
            "Analyst -> Focus on research, history, structured reasoning",
            "Communicator -> Focus on explaining and informing clearly",
            "Community Leader -> Focus on grassroots engagement and empowerment",
            "Learner -> Exploring and forming perspectives",
        ],
    },
    {
        "question_id": "profile_tone",
        "question_text": "What tone should be strictly followed?",
        "is_required": True,
        "options": [
            "Assertive -> Strong, direct, no compromise",
            "Analytical -> Calm, logical, explanatory",
            "Confrontational -> Directly challenges systems/actors",
            "Empathetic -> Emotionally aware and human-centered",
            "Hopeful -> Forward-looking and solution-oriented",
        ],
    },
    {
        "question_id": "profile_target_audience",
        "question_text": "Who is the primary audience?",
        "is_required": True,
        "options": [
            "General Public -> Broad and accessible",
            "Affected Communities -> Insider/shared experience tone",
            "Youth/Students -> Relatable and modern",
            "Policymakers -> Formal, policy-focused",
            "Opposing Groups -> Direct accountability tone",
        ],
    },
    {
        "question_id": "profile_primary_focus",
        "question_text": "What should the content focus on most?",
        "is_required": True,
        "options": [
            "Historical Context -> Link past to present",
            "Current Event -> Explain the specific incident",
            "Policy Critique -> Evaluate laws/governance",
            "Human Impact -> Focus on lived experiences",
            "Systemic Analysis -> Expose structural issues",
        ],
    },
    {
        "question_id": "profile_ambedkarite_perspective",
        "question_text": "Which ideological lens should guide interpretation?",
        "is_required": True,
        "options": [
            "Radical Anti-Caste -> Focus on dismantling hierarchy",
            "Constitutional -> Focus on rights and legal reform",
            "Buddhist -> Ethical/philosophical framing",
            "Caste + Class -> Combined structural analysis",
            "Human Rights -> Universal justice framework",
        ],
    },
    {
        "question_id": "profile_use_of_ambedkar_quotes",
        "question_text": "How should Ambedkar's quotes be used?",
        "is_required": False,
        "options": [
            "Mandatory -> Include at least 1 quote",
            "Preferred -> Include if relevant",
            "Occasional -> Rare use",
            "Indirect -> Refer without quoting",
            "None -> No quotes",
        ],
    },
    {
        "question_id": "profile_buddhist_references",
        "question_text": "How should Buddhist references be handled?",
        "is_required": False,
        "options": [
            "Core -> Central to framing",
            "Contextual -> Use when relevant",
            "Symbolic -> Light mention only",
            "Secular -> Avoid religious framing",
            "None -> No references",
        ],
    },
    {
        "question_id": "profile_language",
        "question_text": "What language style should be used?",
        "is_required": True,
        "options": [
            "English -> Clear and global",
            "Hindi -> Accessible and local",
            "Regional -> State-specific language",
            "Hinglish -> Mixed informal style",
            "Adaptive -> Depends on audience",
        ],
    },
    {
        "question_id": "profile_formality_level",
        "question_text": "What writing style should be enforced?",
        "is_required": True,
        "options": [
            "Formal -> Structured, no slang",
            "Semi-formal -> Professional but readable",
            "Conversational -> Simple and natural",
            "Informal -> Casual and direct",
            "Raw -> Aggressive/slang-heavy",
        ],
    },
    {
        "question_id": "profile_include_statistics",
        "question_text": "How should data/statistics be used?",
        "is_required": False,
        "options": [
            "Mandatory -> Include 1-2 data points",
            "Preferred -> Use if available",
            "Optional -> Not required",
            "Minimal -> Avoid numbers",
            "None -> No statistics",
        ],
    },
    {
        "question_id": "profile_call_to_action",
        "question_text": "What type of ending should be enforced?",
        "is_required": True,
        "options": [
            "Action -> Direct call (protest/act)",
            "Institutional -> Legal/policy steps",
            "Awareness -> Share/discuss",
            "Reflective -> Thought-provoking close",
            "None -> No CTA",
        ],
    },
    {
        "question_id": "profile_intersectionality",
        "question_text": "How should intersectionality be handled?",
        "is_required": True,
        "options": [
            "Strong -> Explicit multi-axis analysis",
            "Moderate -> Include when relevant",
            "Light -> Minimal mention",
            "Focused -> Single-issue focus",
            "None -> Avoid entirely",
        ],
    },
    {
        "question_id": "profile_personal_story",
        "question_text": "How should personal narratives be used?",
        "is_required": False,
        "options": [
            "Mandatory -> Include narrative element",
            "Preferred -> Add if relevant",
            "Generalized -> Use generic examples",
            "Minimal -> Avoid storytelling",
            "None -> No narratives",
        ],
    },
    {
        "question_id": "profile_hashtags",
        "question_text": "How should hashtags be used?",
        "is_required": False,
        "options": [
            "High -> 4-6 hashtags",
            "Moderate -> 2-3 hashtags",
            "Minimal -> 1 hashtag",
            "Rare -> Only if necessary",
            "None -> No hashtags",
        ],
    },
    {
        "question_id": "profile_target_platform",
        "question_text": "Where will the content be posted?",
        "is_required": True,
        "options": [
            "Twitter/X -> Short, sharp",
            "Instagram -> Visual + caption",
            "LinkedIn -> Professional tone",
            "Facebook -> Community-oriented",
            "Messaging Apps -> Shareable format",
        ],
    },
    {
        "question_id": "profile_regional_context",
        "question_text": "What geographical framing should be used?",
        "is_required": True,
        "options": [
            "Local -> City/state-specific",
            "National -> India-wide",
            "Global -> International framing",
            "Mixed -> Local + national",
            "Neutral -> No location emphasis",
        ],
    },
    {
        "question_id": "profile_caste_identity",
        "question_text": "How should identity perspective be reflected?",
        "is_required": False,
        "options": [
            "Insider -> Lived experience voice",
            "Ally -> Supportive framing",
            "Neutral -> Identity not highlighted",
            "Contextual -> Depends on topic",
            "Hidden -> No identity cues",
        ],
    },
    {
        "question_id": "profile_religious_affiliation",
        "question_text": "How should religion influence the narrative?",
        "is_required": False,
        "options": [
            "Core -> Central to perspective",
            "Contextual -> Used if relevant",
            "Symbolic -> Light mention",
            "Secular -> No religious framing",
            "None -> Avoid completely",
        ],
    },
    {
        "question_id": "profile_content_length",
        "question_text": "What exact length must the output follow?",
        "is_required": True,
        "options": [
            "Ultra-short -> 1-2 sentences (max 40 words)",
            "Short -> 3-4 sentences (max 80 words)",
            "Medium -> 4-6 sentences (80-150 words)",
            "Long -> 1 paragraph (150-250 words)",
            "Extended -> 2 paragraphs (250-400 words max)",
        ],
    },
    {
        "question_id": "profile_engagement_style",
        "question_text": "What structure should the content follow?",
        "is_required": True,
        "options": [
            "Question-led -> Start with a question",
            "Declarative -> Strong statements",
            "Confrontational -> Direct challenge",
            "Narrative -> Story flow",
            "Hybrid -> Mix styles",
        ],
    },
    {
        "question_id": "profile_historical_references",
        "question_text": "How should historical context be used?",
        "is_required": False,
        "options": [
            "Strong -> Frequent references",
            "Moderate -> Selective use",
            "Light -> Minimal mention",
            "Rare -> Only if needed",
            "None -> No history",
        ],
    },
    {
        "question_id": "profile_emotional_appeal",
        "question_text": "What emotional tone should dominate?",
        "is_required": True,
        "options": [
            "Anger -> High intensity, urgent",
            "Grief -> Somber, empathetic",
            "Hope -> Positive, forward-looking",
            "Pride -> Identity/assertion",
            "Controlled -> Neutral but firm",
        ],
    },
    {
        "question_id": "profile_legal_angle",
        "question_text": "How should legal references be used?",
        "is_required": False,
        "options": [
            "Mandatory -> Include laws/articles",
            "Preferred -> Include if relevant",
            "Light -> Mention briefly",
            "Minimal -> Avoid jargon",
            "None -> No legal references",
        ],
    },
    {
        "question_id": "profile_solidarity_expression",
        "question_text": "How should solidarity be expressed?",
        "is_required": False,
        "options": [
            "Strong -> Multi-group solidarity",
            "Moderate -> Include where relevant",
            "Limited -> Context-specific only",
            "Minimal -> Rare mention",
            "None -> No solidarity language",
        ],
    },
    {
        "question_id": "profile_visual_suggestion",
        "question_text": "What visual suggestion should be added (if any)?",
        "is_required": False,
        "options": [
            "Poster -> Bold slogan graphic",
            "Data -> Infographic/chart",
            "Clean -> Minimal text visual",
            "Real -> Event/incident imagery",
            "None -> No suggestion",
        ],
    },
]


def main() -> None:
    load_dotenv()
    mongodb_uri = (os.getenv("MONGODB_URI") or "").strip()
    mongodb_database = (os.getenv("MONGODB_DATABASE") or "ambedkargpt").strip() or "ambedkargpt"
    if not mongodb_uri:
        raise ValueError("MONGODB_URI is not set. Please set it in your environment or .env file.")

    client = MongoClient(mongodb_uri)
    collection = client[mongodb_database]["questions"]

    now = datetime.now(timezone.utc)
    docs = []
    for row in QUESTIONS:
        docs.append(
            {
                "question_id": row["question_id"],
                "question_text": row["question_text"],
                "category": "profile",
                "answer_type": "single_select",
                "options": row["options"],
                "is_required": row["is_required"],
                "is_active": True,
                "version": 2,
                "created_at": now,
                "updated_at": now,
            }
        )

    deleted = collection.delete_many({})
    inserted = collection.insert_many(docs)
    print(f"Deleted {deleted.deleted_count} existing question(s).")
    print(f"Inserted {len(inserted.inserted_ids)} profile question(s).")


if __name__ == "__main__":
    main()

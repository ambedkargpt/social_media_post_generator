"""
Preference questions about the party itself, rather than the office held in it.

Three sets now shape a post and they ask different things. The core profile
asks who the writer is: their tone, their audience, their ideological lens.
position_questions asks how someone at their level in the party writes. These
ask what relationship the writer wants with the party: whether to defend it or
judge it, what to lead with when it is in the news, how to answer its critics,
and what to do when it is the one at fault.

Two supporters of the same party can want opposite posts. One wants an
unconditional defence in a movement voice; the other wants an evidence-led
analysis that concedes a fault when the material shows one. Party alone cannot
tell those apart, which is why question 10 is asked of everyone.

The ten questions are the same for both parties. Only the answer options
change, because the vocabulary does: a Congress supporter chooses between
constitutional and governance framings, a BSP supporter between Bahujan
representation and caste. So the text lives once in QUESTIONS and the options
live per party in OPTIONS, rather than the whole table being written twice.

English text and options are copied verbatim from the approved questionnaire.
They are what gets stored as the answer and what the answer is validated
against, so do not reword them in place: add a new version instead. The Hindi
beside each is display text only and never reaches the backend as an answer.

Sets exist for INC and BSP. A party with no set here, Samajwadi included, has no
party questions and generates exactly as it did before.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

CATEGORY = "party"

# When these questions reached users.
#
# An account older than this never saw them, so it is sent to the questionnaire
# once to set them. An account created after it answered the position questions
# at sign-up and starts from the defaults below, which is the whole point of
# having defaults: a new user is not made to sit through fifteen questions.
#
# Move this only when a new set ships, and to that ship date. Moving it forward
# for any other reason re-prompts every user who already answered.
LAUNCHED_AT = datetime(2026, 9, 17, tzinfo=timezone.utc)

PARTIES = ("inc", "bsp")

# The ten questions, in order, as (English, Hindi). Identical for both parties.
QUESTIONS: list[tuple[str, str]] = [
    (
        "When your selected party is mentioned in a news story, what should your post focus on most?",
        "जब किसी ख़बर में आपकी चुनी हुई पार्टी का ज़िक्र हो, तो आपकी पोस्ट सबसे ज़्यादा किस पर केंद्रित हो?",
    ),
    (
        "When your selected party takes a position you agree with, how strongly should the post communicate it?",
        "जब आपकी चुनी हुई पार्टी ऐसा रुख़ अपनाए जिससे आप सहमत हों, तो पोस्ट उसे कितनी मज़बूती से कहे?",
    ),
    (
        "When your selected party is criticized by opponents, how should your post respond?",
        "जब विरोधी आपकी चुनी हुई पार्टी की आलोचना करें, तो आपकी पोस्ट कैसे जवाब दे?",
    ),
    (
        "When your selected party makes a mistake or faces legitimate criticism, how should the post handle it?",
        "जब आपकी चुनी हुई पार्टी से ग़लती हो या उस पर जायज़ आलोचना हो, तो पोस्ट उसे कैसे संभाले?",
    ),
    (
        "What should be the emotional energy of posts supporting your selected party?",
        "आपकी चुनी हुई पार्टी के समर्थन में लिखी पोस्ट की भावनात्मक ऊर्जा कैसी हो?",
    ),
    (
        "When comparing your selected party with political opponents, what should the post emphasize?",
        "अपनी चुनी हुई पार्टी की तुलना राजनीतिक विरोधियों से करते समय पोस्ट किस पर ज़ोर दे?",
    ),
    (
        "How should your post portray the political identity of your selected party?",
        "आपकी पोस्ट आपकी चुनी हुई पार्टी की राजनीतिक पहचान को कैसे पेश करे?",
    ),
    (
        "When discussing your selected party's historical legacy, what should the post do?",
        "अपनी चुनी हुई पार्टी की ऐतिहासिक विरासत पर बात करते समय पोस्ट क्या करे?",
    ),
    (
        "When a major political controversy involves your selected party, what kind of post should be generated?",
        "जब कोई बड़ा राजनीतिक विवाद आपकी चुनी हुई पार्टी से जुड़ा हो, तो किस तरह की पोस्ट बने?",
    ),
    (
        "What should be the overall attitude of your posts toward your selected party?",
        "आपकी चुनी हुई पार्टी के प्रति आपकी पोस्ट का समग्र रवैया कैसा हो?",
    ),
]

# Five options per question per party, in question order, as (English, Hindi).
OPTIONS: dict[str, list[list[tuple[str, str]]]] = {
    # ── Indian National Congress ───────────────────────────────────────────
    "inc": [
        [
            ("Constitutional values and democratic institutions", "संवैधानिक मूल्य और लोकतांत्रिक संस्थाएँ"),
            ("Social justice, equality, and representation", "सामाजिक न्याय, समानता और प्रतिनिधित्व"),
            ("Governance and policy outcomes", "शासन और नीतिगत नतीजे"),
            ("The party's position compared with the government's", "सरकार के मुक़ाबले पार्टी का रुख़"),
            ("How the issue affects ordinary and marginalized citizens", "मुद्दा आम और हाशिये के नागरिकों को कैसे प्रभावित करता है"),
        ],
        [
            ("Clearly defend the position with strong arguments", "मज़बूत तर्कों के साथ उस रुख़ का साफ़ बचाव करें"),
            ("Present it as a credible constitutional alternative", "उसे एक भरोसेमंद संवैधानिक विकल्प के रूप में रखें"),
            ("Highlight its social-justice implications", "उसके सामाजिक न्याय से जुड़े निहितार्थ सामने लाएँ"),
            ("Explain why the position is better than the government's approach", "समझाएँ कि यह रुख़ सरकार के रवैये से बेहतर क्यों है"),
            ("Support it, but remain measured and evidence-based", "समर्थन करें, पर संयत और सबूतों पर आधारित रहें"),
        ],
        [
            ("Directly challenge the criticism with facts", "तथ्यों के साथ आलोचना को सीधी चुनौती दें"),
            ("Defend the party's constitutional and policy position", "पार्टी के संवैधानिक और नीतिगत रुख़ का बचाव करें"),
            ("Point out inconsistencies in the opposing argument", "विरोधी तर्क के अंतर्विरोध सामने लाएँ"),
            ("Provide historical and political context", "ऐतिहासिक और राजनीतिक संदर्भ दें"),
            ("Address the criticism calmly without becoming defensive", "बिना रक्षात्मक हुए शांति से आलोचना का जवाब दें"),
        ],
        [
            ("Defend the party unless the criticism is strongly substantiated", "जब तक आलोचना ठोस सबूतों से साबित न हो, पार्टी का बचाव करें"),
            ("Acknowledge the mistake but provide context", "ग़लती मानें, पर संदर्भ भी दें"),
            ("Criticize the decision while supporting the broader ideological position", "फ़ैसले की आलोचना करें, पर व्यापक वैचारिक रुख़ का साथ दें"),
            ("Demand accountability while avoiding unnecessary attacks", "जवाबदेही माँगें, ग़ैरज़रूरी हमलों से बचते हुए"),
            ("Evaluate the issue independently, even if criticism is justified", "मुद्दे का स्वतंत्र आकलन करें, भले आलोचना जायज़ हो"),
        ],
        [
            ("Confident and assertive", "आत्मविश्वास से भरी और दृढ़"),
            ("Constitutional and morally grounded", "संवैधानिक और नैतिक आधार वाली"),
            ("Hopeful and progressive", "उम्मीद भरी और प्रगतिशील"),
            ("Firmly critical of opposing policies", "विरोधी नीतियों की दृढ़ आलोचना करती हुई"),
            ("Calm, mature, and persuasive", "शांत, परिपक्व और प्रभावी"),
        ],
        [
            ("Constitutional commitments", "संवैधानिक प्रतिबद्धताएँ"),
            ("Governance and policy delivery", "शासन और नीतियों पर अमल"),
            ("Social-justice policies", "सामाजिक न्याय की नीतियाँ"),
            ("Democratic institutions and accountability", "लोकतांत्रिक संस्थाएँ और जवाबदेही"),
            ("Promises versus actual outcomes", "वादे बनाम असल नतीजे"),
        ],
        [
            ("As a defender of constitutional democracy", "संवैधानिक लोकतंत्र के रक्षक के रूप में"),
            ("As a force for inclusive social justice", "समावेशी सामाजिक न्याय की ताक़त के रूप में"),
            ("As an alternative to the current government's politics", "मौजूदा सरकार की राजनीति के विकल्प के रूप में"),
            ("As a broad-based political movement", "व्यापक जनाधार वाले राजनीतिक आंदोलन के रूप में"),
            ("As a party whose record should be judged through evidence and outcomes", "ऐसी पार्टी जिसका रिकॉर्ड सबूतों और नतीजों से परखा जाए"),
        ],
        [
            ("Highlight its role in India's freedom and democratic development", "भारत की आज़ादी और लोकतांत्रिक विकास में उसकी भूमिका सामने लाए"),
            ("Connect its historical positions with today's politics", "उसके ऐतिहासिक रुख़ को आज की राजनीति से जोड़े"),
            ("Highlight its contribution to constitutional and institutional development", "संवैधानिक और संस्थागत विकास में उसके योगदान को सामने लाए"),
            ("Critically examine both achievements and failures", "उपलब्धियों और विफलताओं, दोनों की आलोचनात्मक पड़ताल करे"),
            ("Use history only when it directly strengthens the current argument", "इतिहास का इस्तेमाल तभी करे जब वह मौजूदा तर्क को सीधे मज़बूत करे"),
        ],
        [
            ("A strong rebuttal defending the party's position", "पार्टी के रुख़ का बचाव करता मज़बूत प्रत्युत्तर"),
            ("A constitutional analysis of the controversy", "विवाद का संवैधानिक विश्लेषण"),
            ("A comparison between INC's position and its opponents' position", "कांग्रेस के रुख़ और विरोधियों के रुख़ की तुलना"),
            ("A fact-based breakdown of claims and counterclaims", "दावों और प्रतिदावों का तथ्य आधारित विश्लेषण"),
            ("A broader social-justice analysis of the controversy", "विवाद का व्यापक सामाजिक न्याय के नज़रिए से विश्लेषण"),
        ],
        [
            ("Strongly supportive", "पूरी तरह समर्थक"),
            ("Supportive but willing to criticize", "समर्थक, पर आलोचना करने को तैयार"),
            ("Constructively critical", "रचनात्मक रूप से आलोचनात्मक"),
            ("Analytical and issue-based", "विश्लेषणात्मक और मुद्दा आधारित"),
            ("Supportive only when supported by evidence", "समर्थन तभी, जब सबूत साथ हों"),
        ],
    ],
    # ── Bahujan Samaj Party ────────────────────────────────────────────────
    "bsp": [
        [
            ("Caste inequality and social hierarchy", "जातिगत असमानता और सामाजिक पदानुक्रम"),
            ("Bahujan representation and political power", "बहुजन प्रतिनिधित्व और राजनीतिक ताक़त"),
            ("Constitutional rights and social justice", "संवैधानिक अधिकार और सामाजिक न्याय"),
            ("The impact of the issue on Dalits and marginalized communities", "दलितों और हाशिये के समुदायों पर मुद्दे का असर"),
            ("The party's political position and its implications for Bahujan politics", "पार्टी का राजनीतिक रुख़ और बहुजन राजनीति पर उसका असर"),
        ],
        [
            ("Defend it strongly from an Ambedkarite perspective", "आंबेडकरवादी नज़रिए से उसका मज़बूती से बचाव करें"),
            ("Connect it to Bahujan empowerment and representation", "उसे बहुजन सशक्तिकरण और प्रतिनिधित्व से जोड़ें"),
            ("Frame it as a challenge to caste-based inequality", "उसे जाति आधारित असमानता की चुनौती के रूप में रखें"),
            ("Emphasize its importance for Dalit and marginalized communities", "दलित और हाशिये के समुदायों के लिए उसकी अहमियत पर ज़ोर दें"),
            ("Support it firmly while keeping the argument evidence-based", "दृढ़ता से समर्थन करें, तर्क को सबूतों पर आधारित रखते हुए"),
        ],
        [
            ("Directly challenge the criticism from a Bahujan perspective", "बहुजन नज़रिए से आलोचना को सीधी चुनौती दें"),
            ("Expose caste or representation issues underlying the criticism", "आलोचना के पीछे छिपे जाति या प्रतिनिधित्व के सवाल उजागर करें"),
            ("Defend the party's role in marginalized-community politics", "हाशिये के समुदायों की राजनीति में पार्टी की भूमिका का बचाव करें"),
            ("Contrast the criticism with the broader history of caste politics", "आलोचना को जाति की राजनीति के व्यापक इतिहास के सामने रखें"),
            ("Respond firmly while remaining evidence-based", "सबूतों पर टिके रहते हुए दृढ़ता से जवाब दें"),
        ],
        [
            ("Defend the party against politically motivated criticism", "राजनीति से प्रेरित आलोचना के सामने पार्टी का बचाव करें"),
            ("Acknowledge mistakes while protecting the broader Bahujan perspective", "ग़लतियाँ मानें, पर व्यापक बहुजन नज़रिए की रक्षा करें"),
            ("Critique the decision through Ambedkarite principles", "आंबेडकरवादी सिद्धांतों के आधार पर फ़ैसले की समीक्षा करें"),
            ("Demand accountability while distinguishing the party from its larger social mission", "जवाबदेही माँगें, पार्टी और उसके बड़े सामाजिक मिशन में फ़र्क़ रखते हुए"),
            ("Evaluate the decision independently based on its impact on marginalized communities", "हाशिये के समुदायों पर असर के आधार पर फ़ैसले का स्वतंत्र आकलन करें"),
        ],
        [
            ("Assertive and uncompromising", "दृढ़ और बिना समझौते वाली"),
            ("Ambedkarite and socially conscious", "आंबेडकरवादी और सामाजिक रूप से सजग"),
            ("Empowering and movement-oriented", "सशक्त करने वाली और आंदोलन से जुड़ी"),
            ("Angry about caste injustice and inequality", "जातिगत अन्याय और असमानता पर आक्रोश से भरी"),
            ("Firm but intellectually grounded", "दृढ़ पर वैचारिक रूप से ठोस"),
        ],
        [
            ("Representation of Dalits and Bahujans", "दलितों और बहुजनों का प्रतिनिधित्व"),
            ("Commitment to annihilation of caste", "जाति के विनाश के प्रति प्रतिबद्धता"),
            ("Political empowerment of marginalized communities", "हाशिये के समुदायों का राजनीतिक सशक्तिकरण"),
            ("Constitutional and social-justice principles", "संवैधानिक और सामाजिक न्याय के सिद्धांत"),
            ("Actual impact on Bahujan communities", "बहुजन समुदायों पर असल असर"),
        ],
        [
            ("As a vehicle for Bahujan political power", "बहुजन राजनीतिक ताक़त के वाहक के रूप में"),
            ("As an Ambedkarite political force", "आंबेडकरवादी राजनीतिक ताक़त के रूप में"),
            ("As a challenge to caste hierarchy", "जातिगत पदानुक्रम को चुनौती के रूप में"),
            ("As a representative of historically marginalized communities", "ऐतिहासिक रूप से हाशिये पर रहे समुदायों के प्रतिनिधि के रूप में"),
            ("As a party whose current actions should be judged against its social-justice principles", "ऐसी पार्टी जिसके आज के कामों को उसके सामाजिक न्याय के सिद्धांतों पर परखा जाए"),
        ],
        [
            ("Connect present politics with Ambedkarite and Bahujan movements", "आज की राजनीति को आंबेडकरवादी और बहुजन आंदोलनों से जोड़े"),
            ("Highlight the history of Dalit political representation", "दलित राजनीतिक प्रतिनिधित्व का इतिहास सामने लाए"),
            ("Explain the evolution of Bahujan political power", "बहुजन राजनीतिक ताक़त के विकास को समझाए"),
            ("Critically examine both the party's legacy and current direction", "पार्टी की विरासत और मौजूदा दिशा, दोनों की आलोचनात्मक पड़ताल करे"),
            ("Use historical references only when directly relevant", "ऐतिहासिक संदर्भ तभी दे जब वे सीधे प्रासंगिक हों"),
        ],
        [
            ("A strong Bahujan-centered response", "बहुजन केंद्रित मज़बूत जवाब"),
            ("An Ambedkarite analysis of the controversy", "विवाद का आंबेडकरवादी विश्लेषण"),
            ("A direct examination of caste and representation", "जाति और प्रतिनिधित्व की सीधी पड़ताल"),
            ("A fact-based breakdown of competing claims", "आमने-सामने के दावों का तथ्य आधारित विश्लेषण"),
            ("An analysis of how the controversy affects marginalized communities", "विवाद हाशिये के समुदायों को कैसे प्रभावित करता है, इसका विश्लेषण"),
        ],
        [
            ("Strongly supportive", "पूरी तरह समर्थक"),
            ("Supportive but willing to criticize", "समर्थक, पर आलोचना करने को तैयार"),
            ("Ambedkarite but constructively critical", "आंबेडकरवादी, पर रचनात्मक रूप से आलोचनात्मक"),
            ("Analytical from a Bahujan perspective", "बहुजन नज़रिए से विश्लेषणात्मक"),
            ("Supportive only when supported by evidence", "समर्थन तभी, जब सबूत साथ हों"),
        ],
    ],
}

# Question 10 is the one that separates two supporters of the same party who
# want opposite posts. See the module docstring. One-based, so it matches the
# questionnaire's numbering. It is not asked at sign-up, which asks only the
# five position questions: this set starts from the defaults below and is
# changed on the Preferences page. The flag is what marks it there.
COMPULSORY_NUMBERS = (10,)

# The option each question starts on, one-based, in question order.
#
# Nobody is asked these at sign-up, so every INC or BSP user has a full set of
# answers from their first post and can change any of them later. That makes the
# choice of default a real editorial decision rather than a placeholder: it is
# what most users will actually generate with.
#
# Both read as one coherent writer rather than ten unrelated picks: supportive
# of the party and assertive in voice, arguing from the party's own vocabulary,
# fact-based on a contested claim, and willing to acknowledge a mistake with
# context rather than deny it. Question 10 is deliberately the middle option and
# not "Strongly supportive": an unconditional defence is a position a user
# should have to choose, not one they are given.
DEFAULT_NUMBERS: dict[str, tuple[int, ...]] = {
    "inc": (2, 1, 1, 2, 1, 3, 2, 2, 4, 2),
    "bsp": (2, 1, 1, 2, 1, 1, 1, 1, 4, 2),
}


def default_answer(party: str, number: int) -> str:
    """The English option this question starts on, or "" when there is no set."""
    if party not in OPTIONS or not 1 <= number <= len(QUESTIONS):
        return ""
    return OPTIONS[party][number - 1][DEFAULT_NUMBERS[party][number - 1] - 1][0]


def defaults_for(party: str) -> dict[str, str]:
    """{question_id: default answer} for this party. Empty when it has no set."""
    if party not in OPTIONS:
        return {}
    return {
        question_id(party, n): default_answer(party, n)
        for n in range(1, len(QUESTIONS) + 1)
    }


def question_party(party_name: str | None) -> str:
    """"inc" or "bsp" for a party with a question set, otherwise ""."""
    from backend.pipeline.position_questions import question_party as _party

    return _party(party_name)


def question_id(party: str, number: int) -> str:
    return f"party_{party}_q{number}"


def question_ids_for(party: str) -> list[str]:
    """Ids of this party's set, in order. Empty for a party with no set."""
    if party not in OPTIONS:
        return []
    return [question_id(party, i) for i in range(1, len(QUESTIONS) + 1)]


def compulsory_ids_for(party: str) -> list[str]:
    """The ids a user must answer for this party. Empty when there is no set."""
    if party not in OPTIONS:
        return []
    return [question_id(party, n) for n in COMPULSORY_NUMBERS]


def validate() -> list[str]:
    """Authoring problems in the tables above. Empty means they are sound."""
    problems: list[str] = []
    if len(QUESTIONS) != 10:
        problems.append(f"{len(QUESTIONS)} questions, expected 10")
    for i, (en, hi) in enumerate(QUESTIONS, start=1):
        if not en.strip() or not hi.strip():
            problems.append(f"q{i}: question text missing")
    for party in PARTIES:
        if party not in OPTIONS:
            problems.append(f"{party}: no option table")
            continue
        sets = OPTIONS[party]
        if len(sets) != len(QUESTIONS):
            problems.append(f"{party}: {len(sets)} option sets for {len(QUESTIONS)} questions")
        for i, opts in enumerate(sets, start=1):
            where = f"{party} q{i}"
            if len(opts) != 5:
                problems.append(f"{where}: {len(opts)} options, expected 5")
            if any(not en.strip() or not hi.strip() for en, hi in opts):
                problems.append(f"{where}: an option is missing its English or Hindi")
            if len({en for en, _ in opts}) != len(opts):
                problems.append(f"{where}: duplicate English option")
    for n in COMPULSORY_NUMBERS:
        if not 1 <= n <= len(QUESTIONS):
            problems.append(f"compulsory question {n} is outside the set")
    for party in PARTIES:
        picks = DEFAULT_NUMBERS.get(party)
        if not picks:
            problems.append(f"{party}: no default table")
            continue
        if len(picks) != len(QUESTIONS):
            problems.append(f"{party}: {len(picks)} defaults for {len(QUESTIONS)} questions")
        for i, pick in enumerate(picks, start=1):
            if party in OPTIONS and i <= len(OPTIONS[party]) and not 1 <= pick <= len(OPTIONS[party][i - 1]):
                problems.append(f"{party} q{i}: default option {pick} does not exist")
    return problems


def seed_documents() -> list[dict[str, Any]]:
    """One MongoDB question document per question, ready to upsert."""
    docs: list[dict[str, Any]] = []
    for party in PARTIES:
        for number, (en, hi) in enumerate(QUESTIONS, start=1):
            options = OPTIONS[party][number - 1]
            docs.append(
                {
                    "question_id": question_id(party, number),
                    "question_text": en,
                    "question_text_hi": hi,
                    "options": [o_en for o_en, _ in options],
                    "options_hi": [o_hi for _, o_hi in options],
                    "category": CATEGORY,
                    "party": party,
                    "display_order": number,
                    "answer_type": "single_select",
                    # Carried to the client so the Preferences page pre-selects
                    # the same option the prompt falls back to, rather than
                    # keeping a second copy of this table in the frontend.
                    "default_option": default_answer(party, number),
                    # Compulsory is enforced where it can be: the questionnaire
                    # will not finish and the preferences page will not save
                    # without it. It is deliberately not is_required here,
                    # because the batch save refuses to store anything while a
                    # required question is unanswered and it checks every active
                    # required question at once. A BSP user would then be held
                    # to the INC question they can never see, which is the same
                    # failure that silently lost onboarding answers before.
                    "is_required": False,
                    "is_compulsory": number in COMPULSORY_NUMBERS,
                    "is_active": True,
                    "version": 1,
                }
            )
    return docs


# What each question governs in the finished post, in question order.
#
# Stated here rather than left to the model to infer from the wording. The
# position questions were tried that way first and the model acted on some
# answers and ignored others, so every rendered line carries its facet.
_FACETS = (
    "focus",
    "conviction",
    "rebuttal",
    "accountability",
    "energy",
    "comparison",
    "identity",
    "history",
    "controversy",
    "stance",
)

# Order of appearance in the rendered block: the relationship with the party
# first, because it governs everything under it, then what the post is about,
# then how it argues, and the register last.
_FACET_ORDER = (
    "stance",
    "focus",
    "identity",
    "conviction",
    "comparison",
    "rebuttal",
    "accountability",
    "controversy",
    "history",
    "energy",
)

_FACET_LABELS = {
    "stance": "OVERALL STANCE toward the party, this governs every line below it",
    "focus": "FOCUS, what the post is mainly about when the party is in the news",
    "identity": "IDENTITY, how the post presents the party itself",
    "conviction": "CONVICTION, how hard to back a party position the writer agrees with",
    "comparison": "COMPARISON, the ground opponents are measured on",
    "rebuttal": "REBUTTAL, how criticism from opponents is answered",
    "accountability": "ACCOUNTABILITY, how the party's own mistakes are handled",
    "controversy": "CONTROVERSY, the kind of post a major controversy calls for",
    "history": "HISTORY, how the party's past is used",
    "energy": "ENERGY, the emotional register throughout",
}

_FACET_BY_ID: dict[str, str] = {
    question_id(party, number): facet
    for party in PARTIES
    for number, facet in enumerate(_FACETS, start=1)
}


def validate_facets() -> list[str]:
    """Problems in the facet mapping. Empty means every question has a known facet."""
    problems: list[str] = []
    if len(_FACETS) != len(QUESTIONS):
        problems.append(f"{len(_FACETS)} facets for {len(QUESTIONS)} questions")
    unknown = [f for f in _FACETS if f not in _FACET_LABELS]
    if unknown:
        problems.append(f"unknown facet(s) {unknown}")
    missing = [f for f in _FACETS if f not in _FACET_ORDER]
    if missing:
        problems.append(f"facet(s) with no place in the render order: {missing}")
    return problems


def render_preferences(question_docs: Iterable[dict[str, Any]], answers: dict[str, Any]) -> str:
    """
    The answered questions as prompt lines, most governing first.

    Each line names the facet it governs, states the answer as the instruction
    for that facet, and keeps the question after it in brackets. The answer
    alone can be read more than one way: "Supportive but willing to criticize"
    does not say by itself whether it set the overall stance or described how
    one particular criticism should be answered.
    """
    rows: list[tuple[int, int, str, str, str]] = []
    for doc in question_docs:
        qid = str(doc.get("question_id"))
        answer = answers.get(qid)
        if not (isinstance(answer, str) and answer.strip()):
            continue
        facet = _FACET_BY_ID.get(qid, "focus")
        rank = _FACET_ORDER.index(facet) if facet in _FACET_ORDER else len(_FACET_ORDER)
        question = str(doc.get("question_text") or "").strip()
        rows.append((rank, int(doc.get("display_order") or 0), facet, answer.strip(), question))
    rows.sort()
    return "\n".join(
        f"- {_FACET_LABELS.get(facet, facet.upper())}: {answer} (asked: {question})"
        for _, _, facet, answer, question in rows
    )

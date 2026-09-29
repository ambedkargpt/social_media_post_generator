"""
Single source for the party-position taxonomy.

Generates the backend table (which drives post generation) and the frontend
list (which fills the dropdown) from the same rows, so the two cannot drift.

Columns:
  id      stable key stored on the user; never shown to anyone
  group   heading in the dropdown
  level   how far the person's remit reaches, which is what changes a post
  sp/inc  the title each party actually uses
  generic fallback wording for the other parties in the list
  voice   the instruction handed to the writer

The same titles in Hindi live in HI below, keyed by id. They reach the
dropdown only; see the comment there for why the backend does not get them.
"""

# level -> what it means for the post
# The voice says who the person is; the level says how far a claim may reach.
# Keep the two from restating each other, since both land in the same prompt.
LEVELS = {
    "national": "National remit: policy and the party's position across states are yours to address.",
    "state":    "State remit: the state government and state-wide politics are yours to address.",
    "district": "District remit: do not claim to speak for the state or the nation.",
    "block":    "Block remit: name villages and wards rather than generalising upward.",
    "booth":    "Booth remit: keep claims to what one ward can vouch for.",
    "member":   "No party remit: your own experience and the public record are what you have.",
}

# Who the post is talking to, which is a separate question from what it may
# claim. Remit alone left a booth worker and a national spokesperson writing
# the same post in different sizes: both addressed "the public" because that
# is what target_audience said, and neither sounded like the person sending it.
# A karyakarta is talking to people they will see again this week; a national
# officer is talking past the room to the press and the other side.
LEVEL_AUDIENCE = {
    "national": "Addressing the country, the national press and the opposition's leadership. "
                "You are on the record and quotable, so argue the party's case rather than your own feelings.",
    "state":    "Addressing the state's voters and its press, and answering the state government directly. "
                "Name the state's ministers and its own failures, not Delhi's.",
    "district": "Addressing the district's people and its local press. Talk about what happened here, "
                "to people the reader could plausibly know, and leave national framing to others.",
    "block":    "Addressing your own block: the people at the meeting, the ones who will act on this. "
                "Speak like someone who will be asked about it face to face tomorrow.",
    "booth":    "Addressing neighbours, in the voice of someone who lives on the same street. "
                "Nothing grand, nothing official: what this means for the people on your list.",
    "member":   "Addressing whoever reads it, as one citizen to another. No office, no mandate, "
                "so persuade rather than pronounce.",
}

ROWS = [
    # id, group, level, sp, inc, generic, voice
    ("national_president", "National", "national",
     "Rashtriya Adhyaksh", "Congress President (AICC)", "National President",
     "You lead the party. Speak for it, not merely about it."),
    ("national_vice_president", "National", "national",
     "Rashtriya Upadhyaksh", "AICC Vice President", "National Vice-President",
     "You are among the party's most senior leaders."),
    ("national_general_secretary", "National", "national",
     "Rashtriya Mahamantri", "AICC General Secretary", "National General Secretary",
     "You run national organisation. Speak with the authority of the party machine."),
    ("national_secretary", "National", "national",
     "Rashtriya Sachiv", "AICC Secretary", "National Secretary",
     "You hold a national office. Speak for the organisation, not for yourself."),
    ("national_treasurer", "National", "national",
     "Rashtriya Koshadhyaksh", "AICC Treasurer", "National Treasurer",
     "You hold a national office covering the party's finances."),
    ("national_spokesperson", "National", "national",
     "Rashtriya Pravakta", "AICC Chief Spokesperson", "Chief Spokesperson",
     "You are the party's public voice. Every line is quotable and will be quoted."),
    ("state_incharge", "National", "national",
     "Rashtriya Prabhari", "AICC State In-charge", "Central State In-charge",
     "You answer to the national leadership for a whole state."),

    ("state_president", "State", "state",
     "Pradesh Adhyaksh", "PCC President", "State President",
     "You lead the party in your state. Speak for the state unit."),
    ("state_working_president", "State", "state",
     "Pradesh Upadhyaksh", "PCC Working President", "State Vice-President",
     "You are among the senior leadership of the state unit."),
    ("state_general_secretary", "State", "state",
     "Pradesh Mahamantri", "PCC General Secretary", "State General Secretary",
     "You run state organisation."),
    ("state_secretary", "State", "state",
     "Pradesh Sachiv", "PCC Secretary", "State Secretary",
     "You hold a state office."),
    ("state_treasurer", "State", "state",
     "Pradesh Koshadhyaksh", "PCC Treasurer", "State Treasurer",
     "You hold a state office covering the unit's finances."),
    ("state_spokesperson", "State", "state",
     "Pradesh Pravakta", "PCC Spokesperson", "State Spokesperson",
     "You are the state unit's public voice. Every line is quotable."),
    ("legislature_party_leader", "State", "state",
     "Legislature Party Leader", "CLP Leader", "Legislature Party Leader",
     "You lead the party in the legislature and speak to what it does there."),

    ("district_president", "District", "district",
     "Zila Adhyaksh", "DCC President", "District President",
     "You lead the party in your district."),
    ("district_vice_president", "District", "district",
     "Zila Upadhyaksh", "DCC Vice President", "District Vice-President",
     "You are among the district leadership."),
    ("district_general_secretary", "District", "district",
     "Zila Mahamantri", "DCC General Secretary", "District General Secretary",
     "You run district organisation."),
    ("district_secretary", "District", "district",
     "Zila Sachiv", "DCC Secretary", "District Secretary",
     "You hold a district office."),
    ("district_treasurer", "District", "district",
     "Zila Koshadhyaksh", "DCC Treasurer", "District Treasurer",
     "You hold a district office covering its finances."),

    ("block_president", "Block", "block",
     "Mandal Adhyaksh", "Block Congress President", "Block President",
     "You lead the party in your block."),
    ("block_secretary", "Block", "block",
     "Mandal Mantri", "Block Congress Secretary", "Block Secretary",
     "You hold a block office."),

    ("karyakarta", "Grassroots", "booth",
     "Karyakarta", "Karyakarta", "Active Worker",
     "You do the work on the ground. Write as someone who was there, not as an office."),
    ("booth_karyakarta", "Grassroots", "booth",
     "Booth Karyakarta", "Booth Level Worker", "Booth Level Worker",
     "You work one booth. Write at the scale of a street and a neighbour."),
    ("primary_member", "Grassroots", "member",
     "Sadasya", "Congress Member", "Primary Member",
     "You are a member and a supporter. Speak for yourself, never for the party."),

    ("youth_wing", "Frontal wing", "state",
     "Samajwadi Yuvjan Sabha President", "Indian Youth Congress President", "Youth Wing President",
     "You lead the youth wing. Jobs, education and the future are your ground."),
    ("women_wing", "Frontal wing", "state",
     "Samajwadi Mahila Sabha President", "Mahila Congress President", "Women's Wing President",
     "You lead the women's wing. Safety, dignity and representation are your ground."),
    ("farmers_wing", "Frontal wing", "state",
     "Samajwadi Kisan Sabha President", "Kisan Congress President", "Farmers' Wing President",
     "You lead the farmers' wing. Land, prices, debt and procurement are your ground."),
    ("students_wing", "Frontal wing", "state",
     "Samajwadi Chhatra Sabha President", "NSUI President", "Students' Wing President",
     "You lead the students' wing. Fees, exams, hostels and paper leaks are your ground."),
    ("legal_wing", "Frontal wing", "state",
     "Adhivakta Sabha President", "AICC Legal Cell Chairman", "Legal Wing Head",
     "You lead the legal wing. Argue from statute and judgment."),
    ("minority_wing", "Frontal wing", "state",
     "Minority Cell President", "Minority Department Chairman", "Minority Wing Head",
     "You lead the minority wing. Discrimination and equal protection are your ground."),
    ("sc_st_obc_wing", "Frontal wing", "state",
     "SC/ST Cell President", "SC/ST/OBC Department Chairman", "SC/ST/OBC Wing Head",
     "You lead the SC/ST/OBC wing. Reservation, atrocity law and representation are your ground."),
    ("labour_wing", "Frontal wing", "state",
     "Labour Cell President", "INTUC President", "Trade Union Wing Head",
     "You lead the labour wing. Wages, contracts and workplace safety are your ground."),

    # Public office. Not party posts, so the titles do not vary by party.
    ("union_minister", "Elected office", "national",
     "Union Minister", "Union Minister", "Union Minister",
     "You hold union office. You are answerable for government policy, not only critical of it."),
    ("mp_lok_sabha", "Elected office", "national",
     "MP (Lok Sabha)", "MP (Lok Sabha)", "MP (Lok Sabha)",
     "You sit in the Lok Sabha and answer to one constituency."),
    ("mp_rajya_sabha", "Elected office", "national",
     "MP (Rajya Sabha)", "MP (Rajya Sabha)", "MP (Rajya Sabha)",
     "You sit in the Rajya Sabha and speak to national legislation."),
    ("chief_minister", "Elected office", "state",
     "Chief Minister", "Chief Minister", "Chief Minister",
     "You lead a state government. You are answerable for it."),
    ("state_minister", "Elected office", "state",
     "State Cabinet Minister", "State Cabinet Minister", "State Cabinet Minister",
     "You hold state office and are answerable for your department."),
    ("mla", "Elected office", "district",
     "MLA", "MLA", "MLA",
     "You represent one assembly constituency. Name it and its problems."),
    ("mlc", "Elected office", "state",
     "MLC", "MLC", "MLC",
     "You sit in the legislative council."),
    ("corporator", "Elected office", "booth",
     "Parshad / Corporator", "Parshad / Corporator", "Councillor",
     "You represent one ward. Write about drains, roads and lights by name."),
    ("mayor", "Elected office", "district",
     "Mayor", "Mayor", "Mayor",
     "You lead a municipal corporation and are answerable for the city."),
]


# id -> the same three titles in Hindi, for the Hindi UI. The dropdown and the
# questionnaire are the only readers: the prompt block stays English, so a role
# name is never dropped into the middle of an English instruction.
#
# The SP titles were already Hindi written in Latin script, so those are simply
# put back into Devanagari. Congress runs on its own vocabulary (AICC, PCC,
# DCC), which has settled Hindi forms. Elected offices are the same words for
# every party.
HI = {
    "national_president":         ("राष्ट्रीय अध्यक्ष", "कांग्रेस अध्यक्ष (एआईसीसी)", "राष्ट्रीय अध्यक्ष"),
    "national_vice_president":    ("राष्ट्रीय उपाध्यक्ष", "एआईसीसी उपाध्यक्ष", "राष्ट्रीय उपाध्यक्ष"),
    "national_general_secretary": ("राष्ट्रीय महामंत्री", "एआईसीसी महासचिव", "राष्ट्रीय महासचिव"),
    "national_secretary":         ("राष्ट्रीय सचिव", "एआईसीसी सचिव", "राष्ट्रीय सचिव"),
    "national_treasurer":         ("राष्ट्रीय कोषाध्यक्ष", "एआईसीसी कोषाध्यक्ष", "राष्ट्रीय कोषाध्यक्ष"),
    "national_spokesperson":      ("राष्ट्रीय प्रवक्ता", "एआईसीसी मुख्य प्रवक्ता", "मुख्य प्रवक्ता"),
    "state_incharge":             ("राष्ट्रीय प्रभारी", "एआईसीसी प्रदेश प्रभारी", "केंद्रीय प्रदेश प्रभारी"),
    "state_president":            ("प्रदेश अध्यक्ष", "पीसीसी अध्यक्ष", "प्रदेश अध्यक्ष"),
    "state_working_president":    ("प्रदेश उपाध्यक्ष", "पीसीसी कार्यकारी अध्यक्ष", "प्रदेश उपाध्यक्ष"),
    "state_general_secretary":    ("प्रदेश महामंत्री", "पीसीसी महासचिव", "प्रदेश महासचिव"),
    "state_secretary":            ("प्रदेश सचिव", "पीसीसी सचिव", "प्रदेश सचिव"),
    "state_treasurer":            ("प्रदेश कोषाध्यक्ष", "पीसीसी कोषाध्यक्ष", "प्रदेश कोषाध्यक्ष"),
    "state_spokesperson":         ("प्रदेश प्रवक्ता", "पीसीसी प्रवक्ता", "प्रदेश प्रवक्ता"),
    "legislature_party_leader":   ("विधायक दल के नेता", "सीएलपी नेता", "विधायक दल के नेता"),
    "district_president":         ("ज़िला अध्यक्ष", "डीसीसी अध्यक्ष", "ज़िला अध्यक्ष"),
    "district_vice_president":    ("ज़िला उपाध्यक्ष", "डीसीसी उपाध्यक्ष", "ज़िला उपाध्यक्ष"),
    "district_general_secretary": ("ज़िला महामंत्री", "डीसीसी महासचिव", "ज़िला महासचिव"),
    "district_secretary":         ("ज़िला सचिव", "डीसीसी सचिव", "ज़िला सचिव"),
    "district_treasurer":         ("ज़िला कोषाध्यक्ष", "डीसीसी कोषाध्यक्ष", "ज़िला कोषाध्यक्ष"),
    "block_president":            ("मंडल अध्यक्ष", "ब्लॉक कांग्रेस अध्यक्ष", "ब्लॉक अध्यक्ष"),
    "block_secretary":            ("मंडल मंत्री", "ब्लॉक कांग्रेस सचिव", "ब्लॉक सचिव"),
    "karyakarta":                 ("कार्यकर्ता", "कार्यकर्ता", "सक्रिय कार्यकर्ता"),
    "booth_karyakarta":           ("बूथ कार्यकर्ता", "बूथ स्तर कार्यकर्ता", "बूथ स्तर कार्यकर्ता"),
    "primary_member":             ("सदस्य", "कांग्रेस सदस्य", "प्राथमिक सदस्य"),
    "youth_wing":                 ("समाजवादी युवजन सभा अध्यक्ष", "भारतीय युवा कांग्रेस अध्यक्ष", "युवा मोर्चा अध्यक्ष"),
    "women_wing":                 ("समाजवादी महिला सभा अध्यक्ष", "महिला कांग्रेस अध्यक्ष", "महिला मोर्चा अध्यक्ष"),
    "farmers_wing":               ("समाजवादी किसान सभा अध्यक्ष", "किसान कांग्रेस अध्यक्ष", "किसान मोर्चा अध्यक्ष"),
    "students_wing":              ("समाजवादी छात्र सभा अध्यक्ष", "एनएसयूआई अध्यक्ष", "छात्र मोर्चा अध्यक्ष"),
    "legal_wing":                 ("अधिवक्ता सभा अध्यक्ष", "एआईसीसी विधि प्रकोष्ठ अध्यक्ष", "विधि प्रकोष्ठ प्रमुख"),
    "minority_wing":              ("अल्पसंख्यक प्रकोष्ठ अध्यक्ष", "अल्पसंख्यक विभाग अध्यक्ष", "अल्पसंख्यक प्रकोष्ठ प्रमुख"),
    "sc_st_obc_wing":             ("अनुसूचित जाति/जनजाति प्रकोष्ठ अध्यक्ष", "अनुसूचित जाति/जनजाति/ओबीसी विभाग अध्यक्ष", "अनुसूचित जाति/जनजाति/ओबीसी प्रकोष्ठ प्रमुख"),
    "labour_wing":                ("श्रमिक प्रकोष्ठ अध्यक्ष", "इंटक अध्यक्ष", "श्रमिक संगठन प्रमुख"),
    "union_minister":             ("केंद्रीय मंत्री", "केंद्रीय मंत्री", "केंद्रीय मंत्री"),
    "mp_lok_sabha":               ("सांसद (लोकसभा)", "सांसद (लोकसभा)", "सांसद (लोकसभा)"),
    "mp_rajya_sabha":             ("सांसद (राज्यसभा)", "सांसद (राज्यसभा)", "सांसद (राज्यसभा)"),
    "chief_minister":             ("मुख्यमंत्री", "मुख्यमंत्री", "मुख्यमंत्री"),
    "state_minister":             ("राज्य कैबिनेट मंत्री", "राज्य कैबिनेट मंत्री", "राज्य कैबिनेट मंत्री"),
    "mla":                        ("विधायक", "विधायक", "विधायक"),
    "mlc":                        ("विधान परिषद सदस्य", "विधान परिषद सदस्य", "विधान परिषद सदस्य"),
    "corporator":                 ("पार्षद", "पार्षद", "पार्षद"),
    "mayor":                      ("महापौर", "महापौर", "महापौर"),
}


# Every row must have Hindi, or the dropdown silently falls back to Latin for
# one entry and reads as a bug rather than a gap.
assert {r[0] for r in ROWS} == set(HI), "ROWS and HI disagree about which roles exist"


def label_for(row, party_key):
    _id, _group, _level, sp, inc, generic, _voice = row
    return {"sp": sp, "inc": inc}.get(party_key, generic)

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


def label_for(row, party_key):
    _id, _group, _level, sp, inc, generic, _voice = row
    return {"sp": sp, "inc": inc}.get(party_key, generic)

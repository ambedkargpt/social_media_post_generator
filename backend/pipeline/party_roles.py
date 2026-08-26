"""
Where a user sits in their party, and what that does to a post.

Position is a different axis from user_role. user_role is who someone is
ideologically; this is how far their remit reaches and whether they can
speak for the party at all. A booth worker writing about national policy in
the party's voice is the failure this prevents.

Generated from one source shared with frontend/src/utils/partyRoles.js.
Edit both or neither.
"""

from __future__ import annotations

# What each level means for the scope a post may claim.
LEVEL_SCOPE = {
    'national': "National remit: policy and the party's position across states are yours to address.",
    'state': 'State remit: the state government and state-wide politics are yours to address.',
    'district': 'District remit: do not claim to speak for the state or the nation.',
    'block': 'Block remit: name villages and wards rather than generalising upward.',
    'booth': 'Booth remit: keep claims to what one ward can vouch for.',
    'member': 'No party remit: your own experience and the public record are what you have.',
}

# Who a post at each level is talking to. Separate from scope: remit is what
# you may claim, this is who is listening.
LEVEL_AUDIENCE = {
    'national': "Addressing the country, the national press and the opposition's leadership. You are on the record and quotable, so argue the party's case rather than your own feelings.",
    'state': "Addressing the state's voters and its press, and answering the state government directly. Name the state's ministers and its own failures, not Delhi's.",
    'district': "Addressing the district's people and its local press. Talk about what happened here, to people the reader could plausibly know, and leave national framing to others.",
    'block': 'Addressing your own block: the people at the meeting, the ones who will act on this. Speak like someone who will be asked about it face to face tomorrow.',
    'booth': 'Addressing neighbours, in the voice of someone who lives on the same street. Nothing grand, nothing official: what this means for the people on your list.',
    'member': 'Addressing whoever reads it, as one citizen to another. No office, no mandate, so persuade rather than pronounce.',
}


# id -> label per party, level, and the instruction handed to the writer.
ROLES: dict[str, dict] = {
    'national_president': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Adhyaksh', 'inc': 'Congress President (AICC)', 'generic': 'National President'},
        'voice': 'You lead the party. Speak for it, not merely about it.',
    },
    'national_vice_president': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Upadhyaksh', 'inc': 'AICC Vice President', 'generic': 'National Vice-President'},
        'voice': "You are among the party's most senior leaders.",
    },
    'national_general_secretary': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Mahamantri', 'inc': 'AICC General Secretary', 'generic': 'National General Secretary'},
        'voice': 'You run national organisation. Speak with the authority of the party machine.',
    },
    'national_secretary': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Sachiv', 'inc': 'AICC Secretary', 'generic': 'National Secretary'},
        'voice': 'You hold a national office. Speak for the organisation, not for yourself.',
    },
    'national_treasurer': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Koshadhyaksh', 'inc': 'AICC Treasurer', 'generic': 'National Treasurer'},
        'voice': "You hold a national office covering the party's finances.",
    },
    'national_spokesperson': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Pravakta', 'inc': 'AICC Chief Spokesperson', 'generic': 'Chief Spokesperson'},
        'voice': "You are the party's public voice. Every line is quotable and will be quoted.",
    },
    'state_incharge': {
        'group': 'National',
        'level': 'national',
        'labels': {'sp': 'Rashtriya Prabhari', 'inc': 'AICC State In-charge', 'generic': 'Central State In-charge'},
        'voice': 'You answer to the national leadership for a whole state.',
    },
    'state_president': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Pradesh Adhyaksh', 'inc': 'PCC President', 'generic': 'State President'},
        'voice': 'You lead the party in your state. Speak for the state unit.',
    },
    'state_working_president': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Pradesh Upadhyaksh', 'inc': 'PCC Working President', 'generic': 'State Vice-President'},
        'voice': 'You are among the senior leadership of the state unit.',
    },
    'state_general_secretary': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Pradesh Mahamantri', 'inc': 'PCC General Secretary', 'generic': 'State General Secretary'},
        'voice': 'You run state organisation.',
    },
    'state_secretary': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Pradesh Sachiv', 'inc': 'PCC Secretary', 'generic': 'State Secretary'},
        'voice': 'You hold a state office.',
    },
    'state_treasurer': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Pradesh Koshadhyaksh', 'inc': 'PCC Treasurer', 'generic': 'State Treasurer'},
        'voice': "You hold a state office covering the unit's finances.",
    },
    'state_spokesperson': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Pradesh Pravakta', 'inc': 'PCC Spokesperson', 'generic': 'State Spokesperson'},
        'voice': "You are the state unit's public voice. Every line is quotable.",
    },
    'legislature_party_leader': {
        'group': 'State',
        'level': 'state',
        'labels': {'sp': 'Legislature Party Leader', 'inc': 'CLP Leader', 'generic': 'Legislature Party Leader'},
        'voice': 'You lead the party in the legislature and speak to what it does there.',
    },
    'district_president': {
        'group': 'District',
        'level': 'district',
        'labels': {'sp': 'Zila Adhyaksh', 'inc': 'DCC President', 'generic': 'District President'},
        'voice': 'You lead the party in your district.',
    },
    'district_vice_president': {
        'group': 'District',
        'level': 'district',
        'labels': {'sp': 'Zila Upadhyaksh', 'inc': 'DCC Vice President', 'generic': 'District Vice-President'},
        'voice': 'You are among the district leadership.',
    },
    'district_general_secretary': {
        'group': 'District',
        'level': 'district',
        'labels': {'sp': 'Zila Mahamantri', 'inc': 'DCC General Secretary', 'generic': 'District General Secretary'},
        'voice': 'You run district organisation.',
    },
    'district_secretary': {
        'group': 'District',
        'level': 'district',
        'labels': {'sp': 'Zila Sachiv', 'inc': 'DCC Secretary', 'generic': 'District Secretary'},
        'voice': 'You hold a district office.',
    },
    'district_treasurer': {
        'group': 'District',
        'level': 'district',
        'labels': {'sp': 'Zila Koshadhyaksh', 'inc': 'DCC Treasurer', 'generic': 'District Treasurer'},
        'voice': 'You hold a district office covering its finances.',
    },
    'block_president': {
        'group': 'Block',
        'level': 'block',
        'labels': {'sp': 'Mandal Adhyaksh', 'inc': 'Block Congress President', 'generic': 'Block President'},
        'voice': 'You lead the party in your block.',
    },
    'block_secretary': {
        'group': 'Block',
        'level': 'block',
        'labels': {'sp': 'Mandal Mantri', 'inc': 'Block Congress Secretary', 'generic': 'Block Secretary'},
        'voice': 'You hold a block office.',
    },
    'karyakarta': {
        'group': 'Grassroots',
        'level': 'booth',
        'labels': {'sp': 'Karyakarta', 'inc': 'Karyakarta', 'generic': 'Active Worker'},
        'voice': 'You do the work on the ground. Write as someone who was there, not as an office.',
    },
    'booth_karyakarta': {
        'group': 'Grassroots',
        'level': 'booth',
        'labels': {'sp': 'Booth Karyakarta', 'inc': 'Booth Level Worker', 'generic': 'Booth Level Worker'},
        'voice': 'You work one booth. Write at the scale of a street and a neighbour.',
    },
    'primary_member': {
        'group': 'Grassroots',
        'level': 'member',
        'labels': {'sp': 'Sadasya', 'inc': 'Congress Member', 'generic': 'Primary Member'},
        'voice': 'You are a member and a supporter. Speak for yourself, never for the party.',
    },
    'youth_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Samajwadi Yuvjan Sabha President', 'inc': 'Indian Youth Congress President', 'generic': 'Youth Wing President'},
        'voice': 'You lead the youth wing. Jobs, education and the future are your ground.',
    },
    'women_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Samajwadi Mahila Sabha President', 'inc': 'Mahila Congress President', 'generic': "Women's Wing President"},
        'voice': "You lead the women's wing. Safety, dignity and representation are your ground.",
    },
    'farmers_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Samajwadi Kisan Sabha President', 'inc': 'Kisan Congress President', 'generic': "Farmers' Wing President"},
        'voice': "You lead the farmers' wing. Land, prices, debt and procurement are your ground.",
    },
    'students_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Samajwadi Chhatra Sabha President', 'inc': 'NSUI President', 'generic': "Students' Wing President"},
        'voice': "You lead the students' wing. Fees, exams, hostels and paper leaks are your ground.",
    },
    'legal_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Adhivakta Sabha President', 'inc': 'AICC Legal Cell Chairman', 'generic': 'Legal Wing Head'},
        'voice': 'You lead the legal wing. Argue from statute and judgment.',
    },
    'minority_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Minority Cell President', 'inc': 'Minority Department Chairman', 'generic': 'Minority Wing Head'},
        'voice': 'You lead the minority wing. Discrimination and equal protection are your ground.',
    },
    'sc_st_obc_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'SC/ST Cell President', 'inc': 'SC/ST/OBC Department Chairman', 'generic': 'SC/ST/OBC Wing Head'},
        'voice': 'You lead the SC/ST/OBC wing. Reservation, atrocity law and representation are your ground.',
    },
    'labour_wing': {
        'group': 'Frontal wing',
        'level': 'state',
        'labels': {'sp': 'Labour Cell President', 'inc': 'INTUC President', 'generic': 'Trade Union Wing Head'},
        'voice': 'You lead the labour wing. Wages, contracts and workplace safety are your ground.',
    },
    'union_minister': {
        'group': 'Elected office',
        'level': 'national',
        'labels': {'sp': 'Union Minister', 'inc': 'Union Minister', 'generic': 'Union Minister'},
        'voice': 'You hold union office. You are answerable for government policy, not only critical of it.',
    },
    'mp_lok_sabha': {
        'group': 'Elected office',
        'level': 'national',
        'labels': {'sp': 'MP (Lok Sabha)', 'inc': 'MP (Lok Sabha)', 'generic': 'MP (Lok Sabha)'},
        'voice': 'You sit in the Lok Sabha and answer to one constituency.',
    },
    'mp_rajya_sabha': {
        'group': 'Elected office',
        'level': 'national',
        'labels': {'sp': 'MP (Rajya Sabha)', 'inc': 'MP (Rajya Sabha)', 'generic': 'MP (Rajya Sabha)'},
        'voice': 'You sit in the Rajya Sabha and speak to national legislation.',
    },
    'chief_minister': {
        'group': 'Elected office',
        'level': 'state',
        'labels': {'sp': 'Chief Minister', 'inc': 'Chief Minister', 'generic': 'Chief Minister'},
        'voice': 'You lead a state government. You are answerable for it.',
    },
    'state_minister': {
        'group': 'Elected office',
        'level': 'state',
        'labels': {'sp': 'State Cabinet Minister', 'inc': 'State Cabinet Minister', 'generic': 'State Cabinet Minister'},
        'voice': 'You hold state office and are answerable for your department.',
    },
    'mla': {
        'group': 'Elected office',
        'level': 'district',
        'labels': {'sp': 'MLA', 'inc': 'MLA', 'generic': 'MLA'},
        'voice': 'You represent one assembly constituency. Name it and its problems.',
    },
    'mlc': {
        'group': 'Elected office',
        'level': 'state',
        'labels': {'sp': 'MLC', 'inc': 'MLC', 'generic': 'MLC'},
        'voice': 'You sit in the legislative council.',
    },
    'corporator': {
        'group': 'Elected office',
        'level': 'booth',
        'labels': {'sp': 'Parshad / Corporator', 'inc': 'Parshad / Corporator', 'generic': 'Councillor'},
        'voice': 'You represent one ward. Write about drains, roads and lights by name.',
    },
    'mayor': {
        'group': 'Elected office',
        'level': 'district',
        'labels': {'sp': 'Mayor', 'inc': 'Mayor', 'generic': 'Mayor'},
        'voice': 'You lead a municipal corporation and are answerable for the city.',
    },
}


def _party_key(party: str | None) -> str:
    """Which naming a party uses. Everything else gets the generic wording."""
    p = (party or "").lower()
    if "samajwadi" in p:
        return "sp"
    if "indian national congress" in p or "(inc)" in p:
        return "inc"
    return "generic"


def label_for(role_id: str | None, party: str | None) -> str:
    """The title this party actually uses for the role, or empty if unknown."""
    role = ROLES.get((role_id or '').strip())
    if not role:
        return ''
    return role['labels'].get(_party_key(party)) or role['labels']['generic']


def guidance_for(role_id: str | None, party: str | None) -> str:
    """
    One block describing the position, for the post prompt.

    Empty when no position is set, so the prompt stays exactly as it was for
    a user who never chose one.
    """
    role = ROLES.get((role_id or '').strip())
    if not role:
        return ''
    label = label_for(role_id, party)
    scope = LEVEL_SCOPE.get(role['level'], '')
    audience = LEVEL_AUDIENCE.get(role['level'], '')
    return f"{label}. {role['voice']} {scope} {audience}".strip()

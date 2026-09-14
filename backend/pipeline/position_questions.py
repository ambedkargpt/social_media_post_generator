"""
Preference questions written for one party and one level in it.

The general profile asks who someone is: their tone, their audience, their
ideological lens. These ask how someone in a particular office wants to write.
A national Congress leader and a Congress block worker can share a tone and
still need different posts: one defends the party's national position, the
other starts from what a village is living through. Five questions per party
and position group, and a user only ever sees their own five.

The position groups are the `group` values in party_roles.ROLES, so a stored
party_position resolves to its set without any new mapping.

English text and options are copied verbatim from the approved questionnaire.
They are what gets stored as the answer and what the answer is validated
against, so do not reword them in place: add a new version instead. The Hindi
beside each is display text only and never reaches the backend as an answer.

Sets exist for INC and BSP. A party with no set here, Samajwadi included, has no
position questions and generates exactly as it did before.
"""

from __future__ import annotations

from typing import Any, Iterable

CATEGORY = "position"

# Keyed by the group names party_roles.ROLES and frontend/src/utils/partyRoles.js
# already use. The slug only forms question ids.
GROUP_SLUGS: dict[str, str] = {
    "National": "national",
    "State": "state",
    "District": "district",
    "Block": "block",
    "Grassroots": "grassroots",
    "Frontal wing": "frontal_wing",
    "Elected office": "elected_office",
}


def _q(en: str, hi: str, *options: tuple[str, str]) -> dict[str, Any]:
    return {"en": en, "hi": hi, "options": list(options)}


POSITION_QUESTIONS: dict[tuple[str, str], list[dict[str, Any]]] = {
    # ── Indian National Congress ───────────────────────────────────────────
    ("inc", "National"): [
        _q(
            "As a national-level Congress voice, what should your posts primarily emphasize?",
            "राष्ट्रीय स्तर की कांग्रेस आवाज़ के रूप में आपकी पोस्ट मुख्य रूप से किस पर ज़ोर दें?",
            ("Constitutional democracy and protection of institutions", "संवैधानिक लोकतंत्र और संस्थाओं की रक्षा"),
            ("Social justice, equality and representation", "सामाजिक न्याय, समानता और प्रतिनिधित्व"),
            ("Inclusive economic development and welfare", "समावेशी आर्थिक विकास और जनकल्याण"),
            ("National governance and policy accountability", "राष्ट्रीय शासन और नीतिगत जवाबदेही"),
            ("A broad political vision for India's future", "भारत के भविष्य की व्यापक राजनीतिक दृष्टि"),
        ),
        _q(
            "When Congress takes a national political position, how should your post present it?",
            "जब कांग्रेस कोई राष्ट्रीय राजनीतिक रुख़ अपनाए, तो आपकी पोस्ट उसे कैसे पेश करे?",
            ("Clearly communicate and defend the official position", "आधिकारिक रुख़ को साफ़ बताएँ और उसका बचाव करें"),
            ("Explain the constitutional reasoning behind it", "उसके पीछे का संवैधानिक तर्क समझाएँ"),
            ("Connect it to people's everyday concerns", "उसे लोगों की रोज़मर्रा की चिंताओं से जोड़ें"),
            ("Contrast it with the government's approach", "सरकार के रवैये से उसकी तुलना करें"),
            ("Present it with evidence while allowing room for independent analysis", "सबूतों के साथ रखें, स्वतंत्र विश्लेषण की गुंजाइश छोड़ते हुए"),
        ),
        _q(
            "When criticizing the Union Government, what should your national post focus on?",
            "केंद्र सरकार की आलोचना करते समय आपकी राष्ट्रीय पोस्ट किस पर केंद्रित हो?",
            ("Policy failures and measurable outcomes", "नीतिगत विफलताएँ और मापने योग्य नतीजे"),
            ("Constitutional and democratic concerns", "संवैधानिक और लोकतांत्रिक चिंताएँ"),
            ("Economic issues affecting ordinary citizens", "आम नागरिकों को प्रभावित करने वाले आर्थिक मुद्दे"),
            ("Social-justice and representation concerns", "सामाजिक न्याय और प्रतिनिधित्व से जुड़ी चिंताएँ"),
            ("Contradictions between promises and implementation", "वादों और अमल के बीच का विरोधाभास"),
        ),
        _q(
            "What kind of national political voice should your posts have?",
            "आपकी पोस्ट में किस तरह की राष्ट्रीय राजनीतिक आवाज़ हो?",
            ("Authoritative and statesmanlike", "आधिकारिक और राजनेता जैसी"),
            ("Constitutional and principled", "संवैधानिक और सिद्धांतनिष्ठ"),
            ("Strong and politically assertive", "मज़बूत और राजनीतिक रूप से दृढ़"),
            ("People-centric and relatable", "जन-केंद्रित और अपनापन लिए"),
            ("Analytical and evidence-driven", "विश्लेषणात्मक और सबूतों पर आधारित"),
        ),
        _q(
            "What should a national Congress post ultimately leave the reader with?",
            "राष्ट्रीय स्तर की कांग्रेस पोस्ट पढ़कर पाठक के मन में आख़िर क्या रहना चाहिए?",
            ("A clear understanding of Congress's position", "कांग्रेस के रुख़ की साफ़ समझ"),
            ("Confidence in a constitutional alternative", "संवैधानिक विकल्प पर भरोसा"),
            ("Awareness of a national public issue", "एक राष्ट्रीय जनहित मुद्दे के प्रति जागरूकता"),
            ("A reason to question government policy", "सरकारी नीति पर सवाल उठाने की वजह"),
            ("Hope for a more inclusive political direction", "अधिक समावेशी राजनीतिक दिशा की उम्मीद"),
        ),
    ],
    ("inc", "State"): [
        _q(
            "What should your state-level Congress posts prioritize?",
            "राज्य स्तर की आपकी कांग्रेस पोस्ट किसे प्राथमिकता दें?",
            ("State government performance and accountability", "राज्य सरकार का कामकाज और जवाबदेही"),
            ("State-specific development and welfare", "राज्य से जुड़ा विकास और जनकल्याण"),
            ("Implementation of national policies in the state", "राज्य में राष्ट्रीय नीतियों का अमल"),
            ("Social justice and representation within the state", "राज्य के भीतर सामाजिक न्याय और प्रतिनिधित्व"),
            ("Issues directly affecting people in the state", "राज्य के लोगों को सीधे प्रभावित करने वाले मुद्दे"),
        ),
        _q(
            "How should you connect national Congress positions to state politics?",
            "कांग्रेस के राष्ट्रीय रुख़ को राज्य की राजनीति से कैसे जोड़ें?",
            ("Show their direct impact on the state", "राज्य पर उनका सीधा असर दिखाएँ"),
            ("Explain how they affect state governance", "समझाएँ कि वे राज्य के शासन को कैसे प्रभावित करते हैं"),
            ("Connect national policy to local economic and social issues", "राष्ट्रीय नीति को स्थानीय आर्थिक और सामाजिक मुद्दों से जोड़ें"),
            ("Compare the national position with the state government's actions", "राष्ट्रीय रुख़ की तुलना राज्य सरकार के कामों से करें"),
            ("Mention national issues only when they have clear state relevance", "राष्ट्रीय मुद्दों का ज़िक्र तभी करें जब राज्य से साफ़ संबंध हो"),
        ),
        _q(
            "How strongly should you challenge the state government?",
            "राज्य सरकार को कितनी मज़बूती से चुनौती दें?",
            ("Firmly, using policy and performance evidence", "दृढ़ता से, नीति और कामकाज के सबूतों के साथ"),
            ("Strongly, focusing on failures affecting citizens", "मज़बूती से, नागरिकों को प्रभावित करने वाली विफलताओं पर ध्यान देकर"),
            ("Constitutionally, focusing on rights and institutions", "संवैधानिक ढंग से, अधिकारों और संस्थाओं पर ध्यान देकर"),
            ("Politically, directly challenging the government's narrative", "राजनीतिक ढंग से, सरकार के नैरेटिव को सीधी चुनौती देकर"),
            ("Constructively, identifying failures and possible alternatives", "रचनात्मक ढंग से, विफलताएँ और संभावित विकल्प बताकर"),
        ),
        _q(
            "What should be the dominant voice of your state-level posts?",
            "राज्य स्तर की आपकी पोस्ट में कौन-सी आवाज़ हावी रहे?",
            ("State policy expert", "राज्य की नीतियों के जानकार"),
            ("Representative of ordinary citizens", "आम नागरिकों के प्रतिनिधि"),
            ("Strong opposition voice", "मज़बूत विपक्षी आवाज़"),
            ("Social-justice advocate", "सामाजिक न्याय के पैरोकार"),
            ("Development and governance-focused voice", "विकास और शासन पर केंद्रित आवाज़"),
        ),
        _q(
            "What should your state-level CTA encourage?",
            "राज्य स्तर की आपकी पोस्ट का आह्वान किस बात के लिए प्रेरित करे?",
            ("Public awareness", "जन जागरूकता"),
            ("Accountability from the state government", "राज्य सरकार से जवाबदेही"),
            ("Discussion of state policy alternatives", "राज्य की नीतियों के विकल्पों पर चर्चा"),
            ("Participation in public and democratic processes", "सार्वजनिक और लोकतांत्रिक प्रक्रियाओं में भागीदारी"),
            ("Support for the state-level Congress agenda", "राज्य स्तर पर कांग्रेस के एजेंडे का समर्थन"),
        ),
    ],
    ("inc", "District"): [
        _q(
            "What should your district Congress posts focus on most?",
            "ज़िला स्तर की आपकी कांग्रेस पोस्ट सबसे ज़्यादा किस पर केंद्रित हों?",
            ("Problems directly affecting district residents", "ज़िले के निवासियों को सीधे प्रभावित करने वाली समस्याएँ"),
            ("District administration and public services", "ज़िला प्रशासन और सार्वजनिक सेवाएँ"),
            ("Local development and employment", "स्थानीय विकास और रोज़गार"),
            ("Social justice and representation in the district", "ज़िले में सामाजिक न्याय और प्रतिनिधित्व"),
            ("Connecting local problems with larger government policies", "स्थानीय समस्याओं को बड़ी सरकारी नीतियों से जोड़ना"),
        ),
        _q(
            "How much local detail should your posts use?",
            "आपकी पोस्ट में कितना स्थानीय ब्योरा हो?",
            ("Use district-specific facts whenever available", "जब भी उपलब्ध हों, ज़िले से जुड़े तथ्य दें"),
            ("Regularly mention affected communities and locations", "प्रभावित समुदायों और जगहों का नियमित ज़िक्र करें"),
            ("Use local examples to explain larger issues", "बड़े मुद्दे समझाने के लिए स्थानीय उदाहरण लें"),
            ("Use local data and government records", "स्थानीय आँकड़े और सरकारी रिकॉर्ड इस्तेमाल करें"),
            ("Keep local references limited and focus on the political argument", "स्थानीय संदर्भ कम रखें, राजनीतिक तर्क पर ध्यान दें"),
        ),
        _q(
            "How should you criticize local government or political opponents?",
            "स्थानीय सरकार या राजनीतिक विरोधियों की आलोचना कैसे करें?",
            ("Focus on measurable failures", "मापने योग्य विफलताओं पर ध्यान दें"),
            ("Highlight broken promises", "टूटे वादों को सामने लाएँ"),
            ("Show how people are being affected", "दिखाएँ कि लोग कैसे प्रभावित हो रहे हैं"),
            ("Demand specific administrative action", "ठोस प्रशासनिक कार्रवाई की माँग करें"),
            ("Directly challenge political claims with evidence", "राजनीतिक दावों को सबूतों के साथ सीधी चुनौती दें"),
        ),
        _q(
            "What should your district-level voice sound like?",
            "ज़िला स्तर पर आपकी आवाज़ कैसी लगे?",
            ("Local representative", "स्थानीय प्रतिनिधि"),
            ("Strong opposition voice", "मज़बूत विपक्षी आवाज़"),
            ("Community-focused advocate", "समुदाय पर केंद्रित पैरोकार"),
            ("Evidence-based political commentator", "सबूतों पर आधारित राजनीतिक टिप्पणीकार"),
            ("Accessible and people-oriented leader", "सुलभ और जनता से जुड़ा नेता"),
        ),
        _q(
            "What should your posts encourage district residents to do?",
            "आपकी पोस्ट ज़िले के लोगों को क्या करने के लिए प्रेरित करें?",
            ("Understand the issue", "मुद्दे को समझें"),
            ("Raise concerns with authorities", "अधिकारियों के सामने अपनी चिंता रखें"),
            ("Participate in public discussion", "सार्वजनिक चर्चा में हिस्सा लें"),
            ("Demand accountability", "जवाबदेही की माँग करें"),
            ("Support collective action around the issue", "मुद्दे पर सामूहिक कार्रवाई का साथ दें"),
        ),
    ],
    ("inc", "Block"): [
        _q(
            "What should your Block-level Congress posts focus on?",
            "ब्लॉक स्तर की आपकी कांग्रेस पोस्ट किस पर केंद्रित हों?",
            ("Everyday problems faced by residents", "निवासियों की रोज़मर्रा की समस्याएँ"),
            ("Implementation of government schemes", "सरकारी योजनाओं का अमल"),
            ("Local administration and public services", "स्थानीय प्रशासन और सार्वजनिक सेवाएँ"),
            ("Employment, education and welfare issues", "रोज़गार, शिक्षा और जनकल्याण के मुद्दे"),
            ("Problems raised by villages and local communities", "गाँवों और स्थानीय समुदायों की उठाई समस्याएँ"),
        ),
        _q(
            "How should you explain political issues at the Block level?",
            "ब्लॉक स्तर पर राजनीतिक मुद्दों को कैसे समझाएँ?",
            ("Use simple everyday language", "सरल, रोज़मर्रा की भाषा में"),
            ("Start with people's experiences", "लोगों के अनुभवों से शुरुआत करके"),
            ("Connect local problems to government policy", "स्थानीय समस्याओं को सरकारी नीति से जोड़कर"),
            ("Use specific examples from the area", "इलाक़े के ठोस उदाहरणों से"),
            ("Combine simple language with clear political arguments", "सरल भाषा और साफ़ राजनीतिक तर्क को मिलाकर"),
        ),
        _q(
            "How should criticism of local authorities be expressed?",
            "स्थानीय अधिकारियों की आलोचना कैसे की जाए?",
            ("Firmly but respectfully", "दृढ़ता से, पर सम्मान के साथ"),
            ("Directly and politically", "सीधे और राजनीतिक ढंग से"),
            ("Through specific failures and evidence", "ठोस विफलताओं और सबूतों के ज़रिए"),
            ("Through people's experiences", "लोगों के अनुभवों के ज़रिए"),
            ("By identifying the problem and demanding a solution", "समस्या बताकर और समाधान की माँग करके"),
        ),
        _q(
            "What should be the emotional character of your posts?",
            "आपकी पोस्ट का भावनात्मक स्वभाव कैसा हो?",
            ("Empathetic", "सहानुभूतिपूर्ण"),
            ("Firm", "दृढ़"),
            ("Frustrated about local failures", "स्थानीय विफलताओं पर नाराज़गी"),
            ("Hopeful and solution-oriented", "आशावादी और समाधान केंद्रित"),
            ("Mobilizing and community-focused", "लोगों को जोड़ने वाला और समुदाय केंद्रित"),
        ),
        _q(
            "What should the CTA encourage?",
            "पोस्ट का आह्वान किस बात के लिए प्रेरित करे?",
            ("People to report problems", "लोग अपनी समस्याएँ बताएँ"),
            ("Community discussion", "समुदाय में चर्चा"),
            ("Demands for administrative action", "प्रशासनिक कार्रवाई की माँग"),
            ("Participation in local democratic activity", "स्थानीय लोकतांत्रिक गतिविधियों में भागीदारी"),
            ("Collective action on local issues", "स्थानीय मुद्दों पर सामूहिक कार्रवाई"),
        ),
    ],
    ("inc", "Grassroots"): [
        _q(
            "What should your grassroots Congress posts begin with?",
            "ज़मीनी स्तर की आपकी कांग्रेस पोस्ट की शुरुआत किससे हो?",
            ("People's everyday experiences", "लोगों के रोज़मर्रा के अनुभव"),
            ("A local problem or incident", "कोई स्थानीय समस्या या घटना"),
            ("An injustice affecting the community", "समुदाय के साथ हुआ कोई अन्याय"),
            ("A question ordinary people are asking", "आम लोगों का पूछा जा रहा कोई सवाल"),
            ("A larger political issue explained through local experience", "स्थानीय अनुभव के ज़रिए समझाया गया कोई बड़ा राजनीतिक मुद्दा"),
        ),
        _q(
            "How should political issues be communicated?",
            "राजनीतिक मुद्दों को कैसे बताया जाए?",
            ("Very simply and conversationally", "बहुत सरल, बातचीत के अंदाज़ में"),
            ("Through stories and lived experiences", "क़िस्सों और भोगे हुए अनुभवों के ज़रिए"),
            ("Through relatable local examples", "अपनेपन वाले स्थानीय उदाहरणों के ज़रिए"),
            ("Through strong but understandable political language", "मज़बूत पर समझ में आने वाली राजनीतिक भाषा में"),
            ("By connecting everyday problems with larger policy decisions", "रोज़मर्रा की समस्याओं को बड़े नीतिगत फ़ैसलों से जोड़कर"),
        ),
        _q(
            "What emotional tone should dominate?",
            "कौन-सा भावनात्मक लहजा हावी रहे?",
            ("Empathetic and human", "सहानुभूतिपूर्ण और मानवीय"),
            ("Firm and determined", "दृढ़ और संकल्पबद्ध"),
            ("Angry about injustice", "अन्याय पर आक्रोश"),
            ("Hopeful and empowering", "आशावादी और सशक्त करने वाला"),
            ("Collective and community-oriented", "सामूहिक और समुदाय केंद्रित"),
        ),
        _q(
            "How directly should you challenge political opponents?",
            "राजनीतिक विरोधियों को कितनी सीधी चुनौती दें?",
            ("Carefully and respectfully", "सावधानी और सम्मान के साथ"),
            ("Firmly with facts", "तथ्यों के साथ दृढ़ता से"),
            ("Directly when people's interests are affected", "जब लोगों के हित प्रभावित हों, तब सीधे"),
            ("Strongly when there is clear evidence of failure", "जब विफलता का साफ़ सबूत हो, तब मज़बूती से"),
            ("Focus more on the issue than the opponent", "विरोधी से ज़्यादा मुद्दे पर ध्यान दें"),
        ),
        _q(
            "What should the post encourage people to do?",
            "पोस्ट लोगों को क्या करने के लिए प्रेरित करे?",
            ("Talk about the issue", "मुद्दे पर बात करें"),
            ("Share their experiences", "अपने अनुभव साझा करें"),
            ("Raise the issue collectively", "मिलकर मुद्दा उठाएँ"),
            ("Demand accountability", "जवाबदेही की माँग करें"),
            ("Participate in democratic/community action", "लोकतांत्रिक या सामुदायिक कार्रवाई में हिस्सा लें"),
        ),
    ],
    ("inc", "Frontal wing"): [
        _q(
            "What should your Frontal Wing posts primarily represent?",
            "अनुषांगिक संगठन की आपकी पोस्ट मुख्य रूप से किसका प्रतिनिधित्व करें?",
            ("The concerns of your specific constituency", "आपके वर्ग की ख़ास चिंताएँ"),
            ("The party's position on issues affecting that constituency", "उस वर्ग को प्रभावित करने वाले मुद्दों पर पार्टी का रुख़"),
            ("Rights and representation of the group", "उस वर्ग के अधिकार और प्रतिनिधित्व"),
            ("Policy issues affecting the group", "उस वर्ग को प्रभावित करने वाले नीतिगत मुद्दे"),
            ("Mobilization and participation within the constituency", "वर्ग के भीतर लोगों को जोड़ना और भागीदारी"),
        ),
        _q(
            "How should constituency-specific issues be framed?",
            "वर्ग से जुड़े मुद्दों को किस नज़रिये से रखा जाए?",
            ("Through rights and constitutional protections", "अधिकारों और संवैधानिक सुरक्षा के नज़रिये से"),
            ("Through lived experiences", "भोगे हुए अनुभवों के नज़रिये से"),
            ("Through policy outcomes", "नीतिगत नतीजों के नज़रिये से"),
            ("Through social-justice concerns", "सामाजिक न्याय की चिंताओं के नज़रिये से"),
            ("Through specific demands and solutions", "ठोस माँगों और समाधानों के नज़रिये से"),
        ),
        _q(
            "When another political group makes a claim about your constituency, how should you respond?",
            "जब कोई दूसरा राजनीतिक दल आपके वर्ग को लेकर दावा करे, तो कैसे जवाब दें?",
            ("Fact-check it", "उसकी तथ्य-जाँच करें"),
            ("Directly challenge it", "उसे सीधी चुनौती दें"),
            ("Explain its impact on the community", "समुदाय पर उसका असर समझाएँ"),
            ("Present evidence and counterarguments", "सबूत और जवाबी तर्क रखें"),
            ("Respond strongly while avoiding personal attacks", "निजी हमलों से बचते हुए मज़बूती से जवाब दें"),
        ),
        _q(
            "What should your Frontal Wing voice sound like?",
            "अनुषांगिक संगठन के रूप में आपकी आवाज़ कैसी लगे?",
            ("Advocacy-oriented", "पैरवी करने वाली"),
            ("Community-representative", "समुदाय की प्रतिनिधि"),
            ("Politically assertive", "राजनीतिक रूप से दृढ़"),
            ("Policy-focused", "नीति पर केंद्रित"),
            ("Mobilizing and energetic", "लोगों को जोड़ने वाली और ऊर्जावान"),
        ),
        _q(
            "What should the content ultimately achieve?",
            "आपकी सामग्री आख़िरकार क्या हासिल करे?",
            ("Increase awareness", "जागरूकता बढ़ाए"),
            ("Strengthen representation", "प्रतिनिधित्व मज़बूत करे"),
            ("Highlight community concerns", "समुदाय की चिंताएँ सामने लाए"),
            ("Build political support for the issue", "मुद्दे के लिए राजनीतिक समर्थन जुटाए"),
            ("Encourage organizational participation", "संगठन में भागीदारी को बढ़ावा दे"),
        ),
    ],
    ("inc", "Elected office"): [
        _q(
            "As an elected representative, what should your posts prioritize?",
            "निर्वाचित प्रतिनिधि के रूप में आपकी पोस्ट किसे प्राथमिकता दें?",
            ("Constituents' concerns", "क्षेत्र के लोगों की चिंताएँ"),
            ("Actions taken on public issues", "जनहित के मुद्दों पर की गई कार्रवाई"),
            ("Government accountability", "सरकार की जवाबदेही"),
            ("Development and public services", "विकास और सार्वजनिक सेवाएँ"),
            ("Your political position on important issues", "अहम मुद्दों पर आपका राजनीतिक रुख़"),
        ),
        _q(
            "When discussing a constituency problem, what should the post show?",
            "क्षेत्र की किसी समस्या पर बात करते समय पोस्ट क्या दिखाए?",
            ("The problem and its impact", "समस्या और उसका असर"),
            ("What action you have taken", "आपने क्या कार्रवाई की है"),
            ("Who is responsible for resolving it", "उसे सुलझाने की ज़िम्मेदारी किसकी है"),
            ("Your specific demand or proposed solution", "आपकी ठोस माँग या प्रस्तावित समाधान"),
            ("How the local problem connects to broader policy", "स्थानीय समस्या का बड़ी नीति से संबंध"),
        ),
        _q(
            "If your party's position and local public sentiment differ, how should your post handle it?",
            "अगर पार्टी का रुख़ और स्थानीय जनभावना अलग हों, तो पोस्ट इसे कैसे संभाले?",
            ("Clearly explain the party's position", "पार्टी का रुख़ साफ़ समझाएँ"),
            ("Prioritize constituents' concerns", "क्षेत्र के लोगों की चिंताओं को प्राथमिकता दें"),
            ("Present both perspectives", "दोनों पक्ष रखें"),
            ("Seek a practical solution while remaining aligned with party principles", "पार्टी के सिद्धांतों के साथ रहते हुए व्यावहारिक समाधान खोजें"),
            ("Take an independent position when evidence strongly warrants it", "जब सबूत पुख़्ता हों, तब स्वतंत्र रुख़ अपनाएँ"),
        ),
        _q(
            "What should your elected-representative voice communicate?",
            "निर्वाचित प्रतिनिधि के रूप में आपकी आवाज़ क्या जताए?",
            ("Responsibility and accountability", "ज़िम्मेदारी और जवाबदेही"),
            ("Authority with accessibility", "अधिकार के साथ सुलभता"),
            ("Empathy toward constituents", "क्षेत्र के लोगों के प्रति सहानुभूति"),
            ("Firmness when demanding action", "कार्रवाई माँगते समय दृढ़ता"),
            ("Political leadership with institutional responsibility", "संस्थागत ज़िम्मेदारी के साथ राजनीतिक नेतृत्व"),
        ),
        _q(
            "What should your CTA generally be?",
            "आपका आह्वान आम तौर पर कैसा हो?",
            ("Inform constituents about action taken", "लोगों को की गई कार्रवाई की जानकारी दें"),
            ("Request action from the relevant authority", "संबंधित अधिकारी से कार्रवाई का अनुरोध करें"),
            ("Invite citizens to share concerns", "नागरिकों को अपनी चिंताएँ बताने के लिए आमंत्रित करें"),
            ("Build public support around the issue", "मुद्दे पर जनसमर्थन जुटाएँ"),
            ("Demand a measurable response", "मापने योग्य जवाब की माँग करें"),
        ),
    ],
    # ── Bahujan Samaj Party ────────────────────────────────────────────────
    ("bsp", "National"): [
        _q(
            "What should your national BSP posts primarily emphasize?",
            "राष्ट्रीय स्तर की आपकी बसपा पोस्ट मुख्य रूप से किस पर ज़ोर दें?",
            ("Bahujan political empowerment", "बहुजन राजनीतिक सशक्तिकरण"),
            ("Social transformation and equality", "सामाजिक परिवर्तन और समानता"),
            ("Constitutional rights and dignity", "संवैधानिक अधिकार और गरिमा"),
            ("Caste-based inequality and representation", "जाति आधारित असमानता और प्रतिनिधित्व"),
            ("Economic emancipation of marginalized communities", "वंचित समुदायों की आर्थिक मुक्ति"),
        ),
        _q(
            "When BSP takes a national political position, how should your post present it?",
            "जब बसपा कोई राष्ट्रीय राजनीतिक रुख़ अपनाए, तो आपकी पोस्ट उसे कैसे पेश करे?",
            ("Connect it to Bahujan political interests", "उसे बहुजन राजनीतिक हितों से जोड़ें"),
            ("Explain it through constitutional equality", "संवैधानिक समानता के ज़रिए समझाएँ"),
            ("Connect it to Ambedkarite principles", "उसे आंबेडकरवादी सिद्धांतों से जोड़ें"),
            ("Show how it affects marginalized communities", "दिखाएँ कि वंचित समुदायों पर उसका क्या असर है"),
            ("Present it strongly while supporting the argument with evidence", "तर्क को सबूतों से पुष्ट करते हुए मज़बूती से रखें"),
        ),
        _q(
            "When criticizing the Union Government or political opponents, what should your post emphasize?",
            "केंद्र सरकार या राजनीतिक विरोधियों की आलोचना करते समय आपकी पोस्ट किस पर ज़ोर दे?",
            ("Impact on Dalits, OBCs, STs and other marginalized communities", "दलितों, पिछड़ों, आदिवासियों और दूसरे वंचित समुदायों पर असर"),
            ("Denial of political representation", "राजनीतिक प्रतिनिधित्व से वंचित करना"),
            ("Caste-based inequality and discrimination", "जाति आधारित असमानता और भेदभाव"),
            ("Constitutional rights and equality", "संवैधानिक अधिकार और समानता"),
            ("Economic and social consequences for Bahujans", "बहुजनों पर आर्थिक और सामाजिक नतीजे"),
        ),
        _q(
            "What kind of national BSP voice should your posts have?",
            "आपकी पोस्ट में बसपा की किस तरह की राष्ट्रीय आवाज़ हो?",
            ("Strongly Ambedkarite", "प्रखर आंबेडकरवादी"),
            ("Assertive and uncompromising", "दृढ़ और समझौता न करने वाली"),
            ("Bahujan-centered and empowering", "बहुजन केंद्रित और सशक्त करने वाली"),
            ("Constitutional and evidence-driven", "संवैधानिक और सबूतों पर आधारित"),
            ("Movement-oriented and socially conscious", "आंदोलनधर्मी और सामाजिक रूप से सजग"),
        ),
        _q(
            "What should a national BSP post ultimately communicate?",
            "राष्ट्रीय स्तर की बसपा पोस्ट आख़िरकार क्या संदेश दे?",
            ("The importance of Bahujan political power", "बहुजन राजनीतिक शक्ति का महत्व"),
            ("The need for social transformation", "सामाजिक परिवर्तन की ज़रूरत"),
            ("The defense of constitutional rights", "संवैधानिक अधिकारों की रक्षा"),
            ("The demand for dignity and equal opportunity", "गरिमा और समान अवसर की माँग"),
            ("The political importance of marginalized communities", "वंचित समुदायों का राजनीतिक महत्व"),
        ),
    ],
    ("bsp", "State"): [
        _q(
            "What should your state-level BSP posts prioritize?",
            "राज्य स्तर की आपकी बसपा पोस्ट किसे प्राथमिकता दें?",
            ("Political representation of Bahujan communities in the state", "राज्य में बहुजन समुदायों का राजनीतिक प्रतिनिधित्व"),
            ("Caste inequality and social discrimination", "जातिगत असमानता और सामाजिक भेदभाव"),
            ("State government policies affecting marginalized communities", "वंचित समुदायों को प्रभावित करने वाली राज्य सरकार की नीतियाँ"),
            ("Economic and social conditions of disadvantaged groups", "वंचित वर्गों की आर्थिक और सामाजिक स्थिति"),
            ("BSP's organizational and political position in the state", "राज्य में बसपा की सांगठनिक और राजनीतिक स्थिति"),
        ),
        _q(
            "How should national BSP issues be connected to your state?",
            "बसपा के राष्ट्रीय मुद्दों को अपने राज्य से कैसे जोड़ें?",
            ("Show their impact on Bahujan communities in the state", "राज्य के बहुजन समुदायों पर उनका असर दिखाएँ"),
            ("Connect them to state-level caste and social issues", "उन्हें राज्य के जातिगत और सामाजिक मुद्दों से जोड़ें"),
            ("Explain their constitutional implications", "उनके संवैधानिक मायने समझाएँ"),
            ("Compare them with the state government's policies", "राज्य सरकार की नीतियों से उनकी तुलना करें"),
            ("Focus on how they affect political representation", "इस पर ध्यान दें कि वे राजनीतिक प्रतिनिधित्व को कैसे प्रभावित करते हैं"),
        ),
        _q(
            "How strongly should your posts challenge the state government?",
            "आपकी पोस्ट राज्य सरकार को कितनी मज़बूती से चुनौती दें?",
            ("Firmly on constitutional and social-justice grounds", "संवैधानिक और सामाजिक न्याय के आधार पर दृढ़ता से"),
            ("Directly when marginalized communities are affected", "जब वंचित समुदाय प्रभावित हों, तब सीधे"),
            ("Strongly when representation is denied", "जब प्रतिनिधित्व से वंचित किया जाए, तब मज़बूती से"),
            ("Through evidence and measurable outcomes", "सबूतों और मापने योग्य नतीजों के ज़रिए"),
            ("Through an assertive Bahujan political voice", "एक दृढ़ बहुजन राजनीतिक आवाज़ के ज़रिए"),
        ),
        _q(
            "What should your state-level BSP voice sound like?",
            "राज्य स्तर पर बसपा की आपकी आवाज़ कैसी लगे?",
            ("Ambedkarite and principled", "आंबेडकरवादी और सिद्धांतनिष्ठ"),
            ("Assertive and politically strong", "दृढ़ और राजनीतिक रूप से मज़बूत"),
            ("Bahujan-centered", "बहुजन केंद्रित"),
            ("Grounded in social realities", "सामाजिक सच्चाइयों से जुड़ी"),
            ("Analytical but uncompromising on equality", "विश्लेषणात्मक, पर समानता पर कोई समझौता नहीं"),
        ),
        _q(
            "What should your state-level CTA encourage?",
            "राज्य स्तर की आपकी पोस्ट का आह्वान किस बात के लिए प्रेरित करे?",
            ("Awareness of Bahujan issues", "बहुजन मुद्दों के प्रति जागरूकता"),
            ("Community organization", "समुदाय को संगठित करना"),
            ("Political participation", "राजनीतिक भागीदारी"),
            ("Demand for representation and accountability", "प्रतिनिधित्व और जवाबदेही की माँग"),
            ("Collective action around social-justice issues", "सामाजिक न्याय के मुद्दों पर सामूहिक कार्रवाई"),
        ),
    ],
    ("bsp", "District"): [
        _q(
            "What should your district-level BSP posts focus on most?",
            "ज़िला स्तर की आपकी बसपा पोस्ट सबसे ज़्यादा किस पर केंद्रित हों?",
            ("Local problems affecting Dalits and Bahujan communities", "दलितों और बहुजन समुदायों को प्रभावित करने वाली स्थानीय समस्याएँ"),
            ("Political representation within the district", "ज़िले के भीतर राजनीतिक प्रतिनिधित्व"),
            ("Caste discrimination and social inequality", "जातिगत भेदभाव और सामाजिक असमानता"),
            ("Local administration and delivery of welfare/services", "स्थानीय प्रशासन और जनकल्याण व सेवाओं की पहुँच"),
            ("Connecting district issues with broader Bahujan politics", "ज़िले के मुद्दों को व्यापक बहुजन राजनीति से जोड़ना"),
        ),
        _q(
            "How much local experience should your posts include?",
            "आपकी पोस्ट में कितना स्थानीय अनुभव हो?",
            ("Make lived experience central", "भोगे हुए अनुभव को केंद्र में रखें"),
            ("Frequently use local examples", "स्थानीय उदाहरणों का बार-बार इस्तेमाल करें"),
            ("Use local incidents to expose larger structural problems", "स्थानीय घटनाओं से बड़ी ढाँचागत समस्याएँ उजागर करें"),
            ("Use local data wherever available", "जहाँ उपलब्ध हों, स्थानीय आँकड़े इस्तेमाल करें"),
            ("Combine local experiences with broader political analysis", "स्थानीय अनुभवों को व्यापक राजनीतिक विश्लेषण से मिलाएँ"),
        ),
        _q(
            "How should you respond to local political criticism of BSP?",
            "बसपा की स्थानीय राजनीतिक आलोचना का जवाब कैसे दें?",
            ("Defend the party's Bahujan political role", "पार्टी की बहुजन राजनीतिक भूमिका का बचाव करें"),
            ("Respond through constitutional principles", "संवैधानिक सिद्धांतों के ज़रिए जवाब दें"),
            ("Challenge narratives that ignore caste and representation", "जाति और प्रतिनिधित्व को नज़रअंदाज़ करने वाले नैरेटिव को चुनौती दें"),
            ("Present evidence and local realities", "सबूत और स्थानीय सच्चाई सामने रखें"),
            ("Respond firmly while acknowledging legitimate criticism", "जायज़ आलोचना को मानते हुए दृढ़ता से जवाब दें"),
        ),
        _q(
            "What should your district-level voice sound like?",
            "ज़िला स्तर पर आपकी आवाज़ कैसी लगे?",
            ("Strongly connected to the Bahujan community", "बहुजन समुदाय से गहराई से जुड़ी"),
            ("Ambedkarite and assertive", "आंबेडकरवादी और दृढ़"),
            ("Grassroots and relatable", "ज़मीनी और अपनेपन वाली"),
            ("Evidence-based and analytical", "सबूतों पर आधारित और विश्लेषणात्मक"),
            ("Mobilizing and politically direct", "लोगों को जोड़ने वाली और राजनीतिक रूप से सीधी"),
        ),
        _q(
            "What should your district posts encourage?",
            "ज़िले की आपकी पोस्ट किस बात के लिए प्रेरित करें?",
            ("Community awareness", "समुदाय में जागरूकता"),
            ("Political participation", "राजनीतिक भागीदारी"),
            ("Demand for equal representation", "बराबर प्रतिनिधित्व की माँग"),
            ("Collective response to local injustice", "स्थानीय अन्याय का सामूहिक जवाब"),
            ("Stronger grassroots organization", "ज़मीनी संगठन को मज़बूत करना"),
        ),
    ],
    ("bsp", "Block"): [
        _q(
            "What should your Block-level BSP posts focus on?",
            "ब्लॉक स्तर की आपकी बसपा पोस्ट किस पर केंद्रित हों?",
            ("Everyday problems of Bahujan communities", "बहुजन समुदायों की रोज़मर्रा की समस्याएँ"),
            ("Implementation of welfare and government schemes", "जनकल्याण और सरकारी योजनाओं का अमल"),
            ("Caste discrimination and local inequality", "जातिगत भेदभाव और स्थानीय असमानता"),
            ("Local administrative failures", "स्थानीय प्रशासन की विफलताएँ"),
            ("Political awareness and organization at the grassroots", "ज़मीनी स्तर पर राजनीतिक जागरूकता और संगठन"),
        ),
        _q(
            "How should you communicate these issues?",
            "इन मुद्दों को कैसे बताएँ?",
            ("Simple and conversational", "सरल और बातचीत के अंदाज़ में"),
            ("Through people's lived experiences", "लोगों के भोगे हुए अनुभवों के ज़रिए"),
            ("Through local examples and incidents", "स्थानीय उदाहरणों और घटनाओं के ज़रिए"),
            ("Through Ambedkarite/Bahujan framing", "आंबेडकरवादी और बहुजन नज़रिये से"),
            ("Through direct political language", "सीधी राजनीतिक भाषा में"),
        ),
        _q(
            "When highlighting a local injustice, what should the post emphasize?",
            "किसी स्थानीय अन्याय को उठाते समय पोस्ट किस पर ज़ोर दे?",
            ("The person's/community's dignity", "व्यक्ति या समुदाय की गरिमा"),
            ("The caste or social dimension when relevant", "प्रासंगिक हो तो जातिगत या सामाजिक पहलू"),
            ("The administrative failure involved", "उसमें शामिल प्रशासनिक विफलता"),
            ("The constitutional right involved", "उससे जुड़ा संवैधानिक अधिकार"),
            ("The need for collective accountability", "सामूहिक जवाबदेही की ज़रूरत"),
        ),
        _q(
            "What emotional tone should dominate?",
            "कौन-सा भावनात्मक लहजा हावी रहे?",
            ("Empathy and solidarity", "सहानुभूति और एकजुटता"),
            ("Anger against injustice", "अन्याय के ख़िलाफ़ आक्रोश"),
            ("Assertiveness and self-respect", "दृढ़ता और स्वाभिमान"),
            ("Empowerment and confidence", "सशक्तिकरण और आत्मविश्वास"),
            ("Collective determination", "सामूहिक संकल्प"),
        ),
        _q(
            "What should the CTA encourage?",
            "पोस्ट का आह्वान किस बात के लिए प्रेरित करे?",
            ("People to speak about the problem", "लोग समस्या पर बोलें"),
            ("Community organization", "समुदाय को संगठित करना"),
            ("Demand for administrative action", "प्रशासनिक कार्रवाई की माँग"),
            ("Awareness of rights", "अधिकारों के प्रति जागरूकता"),
            ("Collective political participation", "सामूहिक राजनीतिक भागीदारी"),
        ),
    ],
    ("bsp", "Grassroots"): [
        _q(
            "What should your grassroots BSP posts begin with?",
            "ज़मीनी स्तर की आपकी बसपा पोस्ट की शुरुआत किससे हो?",
            ("Everyday experiences of Bahujan communities", "बहुजन समुदायों के रोज़मर्रा के अनुभव"),
            ("A local injustice", "कोई स्थानीय अन्याय"),
            ("Caste discrimination experienced by people", "लोगों के साथ हुआ जातिगत भेदभाव"),
            ("A community demand", "समुदाय की कोई माँग"),
            ("A question exposing an everyday inequality", "रोज़मर्रा की असमानता उजागर करता कोई सवाल"),
        ),
        _q(
            "How should political issues be explained?",
            "राजनीतिक मुद्दों को कैसे समझाया जाए?",
            ("Through simple everyday examples", "सरल, रोज़मर्रा के उदाहरणों से"),
            ("Through lived experiences", "भोगे हुए अनुभवों से"),
            ("Through Ambedkarite principles", "आंबेडकरवादी सिद्धांतों से"),
            ("Through local incidents connected to larger structures", "बड़े ढाँचे से जुड़ी स्थानीय घटनाओं से"),
            ("Through direct Bahujan political messaging", "सीधे बहुजन राजनीतिक संदेश से"),
        ),
        _q(
            "What should be the dominant emotional character?",
            "कौन-सा भावनात्मक स्वभाव हावी रहे?",
            ("Self-respect and confidence", "स्वाभिमान और आत्मविश्वास"),
            ("Anger against caste injustice", "जातिगत अन्याय के ख़िलाफ़ आक्रोश"),
            ("Empathy and solidarity", "सहानुभूति और एकजुटता"),
            ("Empowerment and hope", "सशक्तिकरण और उम्मीद"),
            ("Collective determination", "सामूहिक संकल्प"),
        ),
        _q(
            "How strongly should posts challenge caste-based inequality?",
            "पोस्ट जाति आधारित असमानता को कितनी मज़बूती से चुनौती दें?",
            ("Mention it only when directly relevant", "तभी ज़िक्र करें जब सीधे प्रासंगिक हो"),
            ("Clearly identify structural inequality", "ढाँचागत असमानता को साफ़ पहचानें"),
            ("Directly challenge discriminatory practices", "भेदभाव वाली प्रथाओं को सीधी चुनौती दें"),
            ("Make caste inequality central when it explains the issue", "जब जातिगत असमानता मुद्दे की वजह हो, तो उसे केंद्र में रखें"),
            ("Use strong anti-discrimination language backed by evidence", "सबूतों से पुष्ट, भेदभाव के ख़िलाफ़ मज़बूत भाषा इस्तेमाल करें"),
        ),
        _q(
            "What should the post encourage people to do?",
            "पोस्ट लोगों को क्या करने के लिए प्रेरित करे?",
            ("Understand their rights", "अपने अधिकार समझें"),
            ("Speak against discrimination", "भेदभाव के ख़िलाफ़ बोलें"),
            ("Organize within the community", "समुदाय के भीतर संगठित हों"),
            ("Participate politically", "राजनीति में भागीदारी करें"),
            ("Demand dignity, equality and accountability", "गरिमा, समानता और जवाबदेही की माँग करें"),
        ),
    ],
    ("bsp", "Frontal wing"): [
        _q(
            "What should your Frontal Wing BSP posts primarily represent?",
            "अनुषांगिक संगठन की आपकी बसपा पोस्ट मुख्य रूप से किसका प्रतिनिधित्व करें?",
            ("The concerns of your specific community/constituency", "आपके समुदाय या वर्ग की ख़ास चिंताएँ"),
            ("Bahujan political representation", "बहुजन राजनीतिक प्रतिनिधित्व"),
            ("Social equality and dignity", "सामाजिक समानता और गरिमा"),
            ("Issues affecting marginalized groups", "वंचित वर्गों को प्रभावित करने वाले मुद्दे"),
            ("The party's position on issues affecting your constituency", "आपके वर्ग को प्रभावित करने वाले मुद्दों पर पार्टी का रुख़"),
        ),
        _q(
            "How should constituency issues be framed?",
            "वर्ग से जुड़े मुद्दों को किस नज़रिये से रखा जाए?",
            ("Through constitutional rights", "संवैधानिक अधिकारों के नज़रिये से"),
            ("Through Ambedkarite principles", "आंबेडकरवादी सिद्धांतों के नज़रिये से"),
            ("Through lived experiences", "भोगे हुए अनुभवों के नज़रिये से"),
            ("Through political representation", "राजनीतिक प्रतिनिधित्व के नज़रिये से"),
            ("Through social and economic inequality", "सामाजिक और आर्थिक असमानता के नज़रिये से"),
        ),
        _q(
            "When another political group makes a claim about your community, how should you respond?",
            "जब कोई दूसरा राजनीतिक दल आपके समुदाय को लेकर दावा करे, तो कैसे जवाब दें?",
            ("Fact-check it with evidence", "सबूतों के साथ उसकी तथ्य-जाँच करें"),
            ("Directly challenge the narrative", "उस नैरेटिव को सीधी चुनौती दें"),
            ("Explain its impact on the community", "समुदाय पर उसका असर समझाएँ"),
            ("Contrast it with constitutional principles", "संवैधानिक सिद्धांतों से उसकी तुलना करें"),
            ("Respond strongly while keeping the focus on the issue", "मुद्दे पर ध्यान रखते हुए मज़बूती से जवाब दें"),
        ),
        _q(
            "What should your Frontal Wing voice sound like?",
            "अनुषांगिक संगठन के रूप में आपकी आवाज़ कैसी लगे?",
            ("Ambedkarite and assertive", "आंबेडकरवादी और दृढ़"),
            ("Community-centered", "समुदाय केंद्रित"),
            ("Advocacy-oriented", "पैरवी करने वाली"),
            ("Movement-oriented", "आंदोलनधर्मी"),
            ("Analytical but firmly rooted in social justice", "विश्लेषणात्मक, पर सामाजिक न्याय में गहरी जड़ें"),
        ),
        _q(
            "What should your content aim to achieve?",
            "आपकी सामग्री का लक्ष्य क्या हो?",
            ("Political awareness", "राजनीतिक जागरूकता"),
            ("Stronger representation", "मज़बूत प्रतिनिधित्व"),
            ("Community organization", "समुदाय को संगठित करना"),
            ("Advocacy for rights and equality", "अधिकारों और समानता की पैरवी"),
            ("Broader public recognition of the issue", "मुद्दे को व्यापक जनमान्यता दिलाना"),
        ),
    ],
    ("bsp", "Elected office"): [
        _q(
            "As an elected representative, what should your BSP posts prioritize?",
            "निर्वाचित प्रतिनिधि के रूप में आपकी बसपा पोस्ट किसे प्राथमिकता दें?",
            ("The concerns of the people you represent", "जिनका आप प्रतिनिधित्व करते हैं, उनकी चिंताएँ"),
            ("Issues affecting Dalit and Bahujan communities", "दलित और बहुजन समुदायों को प्रभावित करने वाले मुद्दे"),
            ("Political representation and equality", "राजनीतिक प्रतिनिधित्व और समानता"),
            ("Government accountability", "सरकार की जवाबदेही"),
            ("Concrete action on constituency problems", "क्षेत्र की समस्याओं पर ठोस कार्रवाई"),
        ),
        _q(
            "When discussing a constituency problem, what should the post emphasize?",
            "क्षेत्र की किसी समस्या पर बात करते समय पोस्ट किस पर ज़ोर दे?",
            ("People's lived experience", "लोगों का भोगा हुआ अनुभव"),
            ("The dignity and rights involved", "उससे जुड़ी गरिमा और अधिकार"),
            ("The responsible authority", "ज़िम्मेदार अधिकारी या संस्था"),
            ("The specific action or solution required", "ज़रूरी ठोस कार्रवाई या समाधान"),
            ("The broader social issue behind the local problem", "स्थानीय समस्या के पीछे का बड़ा सामाजिक मुद्दा"),
        ),
        _q(
            "If your party's position and local public sentiment differ, how should your post handle it?",
            "अगर पार्टी का रुख़ और स्थानीय जनभावना अलग हों, तो पोस्ट इसे कैसे संभाले?",
            ("Explain the party's position clearly", "पार्टी का रुख़ साफ़ समझाएँ"),
            ("Give serious attention to constituents' concerns", "क्षेत्र के लोगों की चिंताओं पर गंभीरता से ध्यान दें"),
            ("Connect the issue with constitutional principles", "मुद्दे को संवैधानिक सिद्धांतों से जोड़ें"),
            ("Seek a practical solution consistent with social-justice principles", "सामाजिक न्याय के सिद्धांतों के अनुरूप व्यावहारिक समाधान खोजें"),
            ("Take an independent evidence-based position when necessary", "ज़रूरत हो तो सबूतों पर आधारित स्वतंत्र रुख़ अपनाएँ"),
        ),
        _q(
            "What should your elected-office voice communicate?",
            "निर्वाचित पद पर आपकी आवाज़ क्या जताए?",
            ("Responsible representation", "ज़िम्मेदार प्रतिनिधित्व"),
            ("Strong Bahujan advocacy", "मज़बूत बहुजन पैरवी"),
            ("Constitutional authority", "संवैधानिक अधिकार"),
            ("Empathy toward constituents", "क्षेत्र के लोगों के प्रति सहानुभूति"),
            ("Firmness when demanding justice or government action", "न्याय या सरकारी कार्रवाई माँगते समय दृढ़ता"),
        ),
        _q(
            "What should your CTA generally be?",
            "आपका आह्वान आम तौर पर कैसा हो?",
            ("Inform people about action taken", "लोगों को की गई कार्रवाई की जानकारी दें"),
            ("Demand action from authorities", "अधिकारियों से कार्रवाई की माँग करें"),
            ("Invite affected people to raise concerns", "प्रभावित लोगों को अपनी चिंताएँ उठाने के लिए आमंत्रित करें"),
            ("Build public support around the issue", "मुद्दे पर जनसमर्थन जुटाएँ"),
            ("Encourage democratic and community participation", "लोकतांत्रिक और सामुदायिक भागीदारी को बढ़ावा दें"),
        ),
    ],
}


def question_party(party_name: str | None) -> str:
    """"inc" or "bsp" for a party with a question set, otherwise ""."""
    p = (party_name or "").lower()
    if "indian national congress" in p or "(inc)" in p:
        return "inc"
    if "bahujan samaj" in p or "(bsp)" in p:
        return "bsp"
    return ""


def group_for_position(position_id: str | None) -> str:
    """The position group a stored party_position belongs to, or ""."""
    from backend.pipeline.party_roles import ROLES

    role = ROLES.get((position_id or "").strip())
    return str(role.get("group") or "") if role else ""


def question_id(party: str, group: str, number: int) -> str:
    return f"pos_{party}_{GROUP_SLUGS[group]}_q{number}"


def question_ids_for(party: str, group: str) -> list[str]:
    """Ids of the set for this party and group, in order. Empty when there is none."""
    questions = POSITION_QUESTIONS.get((party, group)) or []
    return [question_id(party, group, i) for i in range(1, len(questions) + 1)]


def validate() -> list[str]:
    """Authoring problems in the table above. Empty means it is sound."""
    problems: list[str] = []
    for (party, group), questions in POSITION_QUESTIONS.items():
        where = f"{party}/{group}"
        if group not in GROUP_SLUGS:
            problems.append(f"{where}: unknown group")
        if len(questions) != 5:
            problems.append(f"{where}: {len(questions)} questions, expected 5")
        for i, q in enumerate(questions, start=1):
            opts = q["options"]
            if len(opts) != 5:
                problems.append(f"{where} q{i}: {len(opts)} options, expected 5")
            if any(not en.strip() or not hi.strip() for en, hi in opts):
                problems.append(f"{where} q{i}: an option is missing its English or Hindi")
            if len({en for en, _ in opts}) != len(opts):
                problems.append(f"{where} q{i}: duplicate English option")
            if not q["en"].strip() or not q["hi"].strip():
                problems.append(f"{where} q{i}: question text missing")
    return problems


def seed_documents() -> list[dict[str, Any]]:
    """One MongoDB question document per question, ready to upsert."""
    docs: list[dict[str, Any]] = []
    for (party, group), questions in POSITION_QUESTIONS.items():
        for number, q in enumerate(questions, start=1):
            docs.append(
                {
                    "question_id": question_id(party, group, number),
                    "question_text": q["en"],
                    "question_text_hi": q["hi"],
                    "options": [en for en, _ in q["options"]],
                    "options_hi": [hi for _, hi in q["options"]],
                    "category": CATEGORY,
                    "party": party,
                    "position_group": group,
                    "display_order": number,
                    "answer_type": "single_select",
                    # Never required. The batch save refuses to store anything
                    # while a required question is unanswered, and every user
                    # answers five of these seventy at most.
                    "is_required": False,
                    "is_active": True,
                    "version": 1,
                }
            )
    return docs


# Which part of the post each question governs, per set, in question order.
#
# Most sets run opening, middle, attack, voice, close. The exceptions are real
# rather than tidy: both grassroots sets ask about emotional tone before they
# ask how hard to challenge, and three sets ask how to handle disagreement or
# criticism of the party, which is a stance to take rather than an attack.
#
# This was left to the model at first, told that each question's wording said
# which part it governed. It did not act on it. Across eight posts on one story
# the answers visibly changed how the post closed and never once changed how it
# opened. So the mapping is stated here, and every rendered line carries its
# part, instead of asking the model to infer it.
_DEFAULT_PARTS = ("opening", "middle", "attack", "voice", "close")

PARTS: dict[tuple[str, str], tuple[str, ...]] = {key: _DEFAULT_PARTS for key in POSITION_QUESTIONS}
PARTS.update(
    {
        ("inc", "Grassroots"): ("opening", "middle", "voice", "attack", "close"),
        ("bsp", "Grassroots"): ("opening", "middle", "voice", "attack", "close"),
        ("inc", "Elected office"): ("opening", "middle", "stance", "voice", "close"),
        ("bsp", "Elected office"): ("opening", "middle", "stance", "voice", "close"),
        ("bsp", "District"): ("opening", "middle", "stance", "voice", "close"),
    }
)

# Order of appearance in the rendered block, which is the order of the post.
_PART_ORDER = ("opening", "middle", "attack", "stance", "voice", "close")

_PART_LABELS = {
    "opening": "OPENING, the first sentence leads with this",
    "middle": "MIDDLE, this decides what the body contains and what it leaves out",
    "attack": "ATTACK, the move the post makes against its target",
    "stance": "STANCE, how the post handles criticism or disagreement",
    "voice": "VOICE, the register throughout",
    "close": "CLOSE, the last sentence does this",
}

_PART_BY_ID: dict[str, str] = {
    question_id(party, group, number): part
    for (party, group), parts in PARTS.items()
    for number, part in enumerate(parts, start=1)
}


def validate_parts() -> list[str]:
    """Problems in the part mapping. Empty means every question has a known part."""
    problems: list[str] = []
    for (party, group), questions in POSITION_QUESTIONS.items():
        parts = PARTS.get((party, group), ())
        if len(parts) != len(questions):
            problems.append(f"{party}/{group}: {len(parts)} parts for {len(questions)} questions")
        unknown = [p for p in parts if p not in _PART_LABELS]
        if unknown:
            problems.append(f"{party}/{group}: unknown part(s) {unknown}")
    return problems


def render_preferences(question_docs: Iterable[dict[str, Any]], answers: dict[str, Any]) -> str:
    """
    The answered questions as prompt lines, in the order of the post they shape.

    Each line names the part of the post it governs, states the answer as the
    instruction for that part, and keeps the question after it in brackets:
    the answer alone can be read more than one way, and "Strong opposition
    voice" does not say by itself whether it answered what voice to use or how
    to criticise.
    """
    rows: list[tuple[int, int, str, str, str]] = []
    for doc in question_docs:
        qid = str(doc.get("question_id"))
        answer = answers.get(qid)
        if not (isinstance(answer, str) and answer.strip()):
            continue
        part = _PART_BY_ID.get(qid, "middle")
        rank = _PART_ORDER.index(part) if part in _PART_ORDER else len(_PART_ORDER)
        question = str(doc.get("question_text") or "").strip()
        rows.append((rank, int(doc.get("display_order") or 0), part, answer.strip(), question))
    rows.sort()
    return "\n".join(
        f"- {_PART_LABELS.get(part, part.upper())}: {answer} (asked: {question})"
        for _, _, part, answer, question in rows
    )

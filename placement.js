/* Level test (Einstufungstest). Six questions per level; a level counts as passed with 4 of 6 correct.
   The test starts at A1 and stops at the first level that isn't passed.
   "listen": the browser reads this text aloud and it is hidden until the answer is checked. answer = index of the right option. */
window.AD_PLACEMENT = {
A1: [
  { q: "„Wie heißen Sie?“ – Was antworten Sie?", options: ["Ich bin 25 Jahre alt.", "Ich heiße Anna.", "Ich komme aus Spanien."], answer: 1, en: "What's your name?" },
  { q: "Ich ___ aus Indien.", options: ["kommst", "kommt", "komme"], answer: 2, en: "Verb ending for „ich“" },
  { q: "Montag, Dienstag, ___", options: ["Mittwoch", "März", "Morgen"], answer: 0, en: "Days of the week" },
  { q: "Das ist ___ Büro.", options: ["mein", "meine", "meinen"], answer: 0, en: "das Büro → mein" },
  { listen: "Der Kurs beginnt um neun Uhr.", q: "Wann beginnt der Kurs?", options: ["Um 9 Uhr", "Um 10 Uhr", "Um 19 Uhr"], answer: 0, en: "Listening" },
  { text: "Hallo Tom, ich bin krank. Ich komme heute nicht. Lisa", q: "Was ist richtig?", options: ["Tom ist krank.", "Lisa kommt heute nicht.", "Lisa kommt später."], answer: 1, en: "Reading" }
],
A2: [
  { q: "Gestern ___ ich lange gearbeitet.", options: ["bin", "habe", "hatte"], answer: 1, en: "Perfekt with haben" },
  { q: "Ich lerne Deutsch, ___ ich in Deutschland arbeiten möchte.", options: ["weil", "denn", "aber"], answer: 0, en: "Verb at the end → weil" },
  { q: "Ich habe morgen einen ___ beim Arzt.", options: ["Rechnung", "Termin", "Urlaub"], answer: 1, en: "Vocabulary" },
  { q: "Ich gebe ___ Kollegin das Dokument.", options: ["die", "der", "den"], answer: 1, en: "Dativ: die Kollegin → der Kollegin" },
  { listen: "Achtung, eine Durchsage: Der Zug nach Köln fährt heute nicht von Gleis drei, sondern von Gleis fünf.", q: "Von welchem Gleis fährt der Zug?", options: ["Gleis 3", "Gleis 5", "Gleis 8"], answer: 1, en: "Listening" },
  { text: "Liebe Frau Weber, leider kann ich am Freitag nicht zum Meeting kommen. Ich habe einen Termin beim Bürgeramt. Können wir das Meeting auf Montag verschieben? Viele Grüße, Paul", q: "Was möchte Paul?", options: ["Das Meeting absagen", "Das Meeting auf Montag verschieben", "Am Montag zum Bürgeramt gehen"], answer: 1, en: "Reading" }
],
B1: [
  { q: "Wenn ich mehr Zeit ___, würde ich einen Kurs machen.", options: ["habe", "hätte", "hatte"], answer: 1, en: "Konjunktiv II" },
  { q: "Das ist die Kollegin, ___ ich gestern geholfen habe.", options: ["die", "der", "den"], answer: 1, en: "Relative pronoun, helfen + Dativ" },
  { q: "Ich interessiere mich ___ die Stelle.", options: ["für", "an", "auf"], answer: 0, en: "sich interessieren für" },
  { q: "Bitte schicken Sie Ihre ___ bis Freitag.", options: ["Kündigungsfrist", "Feierabend", "Bewerbungsunterlagen"], answer: 2, en: "Vocabulary" },
  { q: "Nachdem ich die E-Mail ___ hatte, rief ich den Kunden an.", options: ["geschrieben", "schreiben", "schrieb"], answer: 0, en: "Plusquamperfekt" },
  { listen: "Liebe Kolleginnen und Kollegen, wegen Bauarbeiten bleibt unser Parkplatz bis Ende Mai geschlossen. Bitte nutzen Sie das Parkhaus am Bahnhof. Die Kosten übernimmt die Firma.", q: "Was stimmt?", options: ["Man muss das Parkhaus selbst bezahlen.", "Die Firma bezahlt das Parkhaus.", "Der Parkplatz ist erst ab Ende Mai geschlossen."], answer: 1, en: "Listening" }
],
B2: [
  { q: "Der Antrag muss bis Ende des Monats ___ werden.", options: ["einreichen", "eingereicht", "eingereichte"], answer: 1, en: "Passiv mit Modalverb" },
  { q: "___ der hohen Kosten hat die Firma das Projekt gestoppt.", options: ["Wegen", "Weil", "Obwohl"], answer: 0, en: "Präposition + Genitiv" },
  { q: "Er tut so, als ___ er alles wüsste.", options: ["wenn", "dass", "ob"], answer: 2, en: "als ob + Konjunktiv II" },
  { q: "In der ___ kann man mit zwei Wochen Frist kündigen.", options: ["Probezeit", "Elternzeit", "Gleitzeit"], answer: 0, en: "Vocabulary" },
  { q: "„Ich halte kurz Rücksprache mit meiner Chefin.“ bedeutet:", options: ["I'll complain to my boss.", "I'll quickly check with my boss.", "I'll take over from my boss."], answer: 1, en: "Meaning" },
  { listen: "Zwar ist das neue System deutlich schneller, die Mitarbeitenden müssen jedoch erst geschult werden, bevor es im Juli eingeführt werden kann.", q: "Was ist die Voraussetzung für die Einführung im Juli?", options: ["Schulungen für die Mitarbeitenden", "Ein schnelleres System", "Neue Mitarbeitende"], answer: 0, en: "Listening" }
],
C1: [
  { q: "Ich möchte zu ___ geben, dass der Zeitplan sehr knapp ist.", options: ["verstehen", "bedenken", "wissen"], answer: 1, en: "zu bedenken geben" },
  { q: "Die Maßnahme hat sich als wirkungslos ___.", options: ["erwiesen", "bewiesen", "gemacht"], answer: 0, en: "sich als … erweisen" },
  { q: "„Dem kann ich nur bedingt zustimmen.“ bedeutet:", options: ["I fully agree.", "I can't decide.", "I only partly agree."], answer: 2, en: "Meaning" },
  { q: "___ der Tatsache, dass die Kosten steigen, halten wir am Projekt fest.", options: ["Ungeachtet", "Infolge", "Anhand"], answer: 0, en: "Genitiv-Präposition" },
  { q: "Hätte ich das gewusst, ___ ich anders entschieden.", options: ["würde", "habe", "hätte"], answer: 2, en: "Konjunktiv II Vergangenheit" },
  { listen: "Die Kritik richtet sich weniger gegen das Ziel der Reform als vielmehr gegen die Art und Weise, wie sie umgesetzt wird.", q: "Wogegen richtet sich die Kritik vor allem?", options: ["Gegen das Ziel der Reform", "Gegen die Umsetzung der Reform", "Gegen die Kosten der Reform"], answer: 1, en: "Listening" }
]
};
